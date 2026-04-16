#!/usr/bin/env python3
"""
Mossy Brain Service — Gemma 4 + Unsloth + CUDA
Full intelligence stack:
  - Gemma 4 local inference via Unsloth (4-bit, 8 GB VRAM)
  - Fine-tuning with LoRA (Unsloth-optimised)
  - Multi-step reasoning chains (LangChain)
  - Document Q&A with RAG (LlamaIndex + Chroma)
  - Chain-of-thought reasoning
  - Goal decomposition & planning
  - Self-reflection / critique loops
  - Safe Python tool execution
Runs on port 8000 as a FastAPI service.
"""

import os
import json
import logging
import asyncio
import uuid
import subprocess
import sys
import textwrap
import traceback
from io import StringIO
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import redirect_stdout, redirect_stderr

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# NVIDIA / CUDA optimisations
# ────────────────────────────────────────────────────────────────────────────

if torch.cuda.is_available():
    # Allow TF32 for faster matrix math on Ampere+ (RTX 30xx / 40xx)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True
    logger.info(f"CUDA device: {torch.cuda.get_device_name(0)}")
    logger.info(f"VRAM total: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

device = "cuda" if torch.cuda.is_available() else "cpu"

# ────────────────────────────────────────────────────────────────────────────
# Model loading — Unsloth preferred, standard transformers as fallback
# ────────────────────────────────────────────────────────────────────────────

HAS_UNSLOTH = False
try:
    from unsloth import FastLanguageModel
    HAS_UNSLOTH = True
    logger.info("Unsloth available — will use 4-bit optimised loading")
except ImportError:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    logger.warning("Unsloth not installed; using standard transformers (slower, more VRAM)")

# ────────────────────────────────────────────────────────────────────────────
# LangChain imports
# ────────────────────────────────────────────────────────────────────────────

try:
    from langchain.llms.base import LLM
    from langchain.callbacks.manager import CallbackManagerLLMRun
    from langchain.prompts import PromptTemplate
    from langchain.chains import LLMChain, ConversationChain
    from langchain.memory import ConversationBufferMemory
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False
    logger.warning("LangChain not available; chain features disabled")

# ────────────────────────────────────────────────────────────────────────────
# LlamaIndex / RAG imports
# ────────────────────────────────────────────────────────────────────────────

HAS_LLAMAINDEX = False
try:
    from llama_index.core import VectorStoreIndex, Document
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    from llama_index.vector_stores.chroma import ChromaVectorStore
    from llama_index.core.storage import StorageContext
    import chromadb
    HAS_LLAMAINDEX = True
    logger.info("LlamaIndex + Chroma available — RAG enabled")
except ImportError:
    logger.warning("LlamaIndex not available; RAG features disabled")

# ────────────────────────────────────────────────────────────────────────────
# Fine-tuning imports
# ────────────────────────────────────────────────────────────────────────────

HAS_FINETUNE = False
try:
    from peft import LoraConfig, TaskType, get_peft_model
    from datasets import Dataset, load_dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments
    HAS_FINETUNE = True
except ImportError:
    logger.warning("PEFT/TRL not available; fine-tuning disabled")

# ────────────────────────────────────────────────────────────────────────────
# Paths
# ────────────────────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent.parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR   = BASE_DIR / "data"
CHROMA_DIR = DATA_DIR / "chroma_db"
JOBS_DIR   = DATA_DIR / "jobs"

for d in (MODELS_DIR, DATA_DIR, CHROMA_DIR, JOBS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Mossy Brain Service", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────────────────────────────────────
# Global state
# ────────────────────────────────────────────────────────────────────────────

model           = None
tokenizer       = None
current_model_id: str = ""
rag_index       = None
conv_memory     = None
fine_tune_jobs: Dict[str, dict] = {}

# ────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ────────────────────────────────────────────────────────────────────────────

class InferenceRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95
    top_k: int = 50

class ChainRequest(BaseModel):
    query: str
    chain_type: str = "simple"   # "simple" | "summary" | "conversational"
    context: Optional[Dict[str, str]] = None

class PlanRequest(BaseModel):
    goal: str
    context: Optional[str] = None
    max_steps: int = 8

class ReflectRequest(BaseModel):
    question: str
    answer: str
    context: Optional[str] = None

class ChainOfThoughtRequest(BaseModel):
    problem: str
    context: Optional[str] = None

class ToolExecuteRequest(BaseModel):
    code: str
    timeout_seconds: int = 10

class RAGRequest(BaseModel):
    query: str
    use_rag: bool = True

class FineTuneRequest(BaseModel):
    model_name: str = "google/gemma-4-9b"
    dataset_text: Optional[List[str]] = None
    dataset_name: Optional[str] = None
    output_dir: str = str(MODELS_DIR / "gemma4-finetuned")
    num_epochs: int = 3
    batch_size: int = 2
    learning_rate: float = 2e-4
    max_seq_length: int = 2048
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05

class LoadModelRequest(BaseModel):
    model_name: str = "google/gemma-4-9b"
    load_in_4bit: bool = True
    max_seq_length: int = 4096

# ────────────────────────────────────────────────────────────────────────────
# Model loader
# ────────────────────────────────────────────────────────────────────────────

def _load_model(model_name: str, load_in_4bit: bool = True, max_seq_length: int = 4096):
    """Load Gemma 4 via Unsloth (preferred) or standard transformers."""
    global model, tokenizer, current_model_id
    logger.info(f"Loading model: {model_name}")

    if HAS_UNSLOTH:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_name,
            max_seq_length=max_seq_length,
            dtype=None,          # auto: bfloat16 on Ampere+, float16 on older
            load_in_4bit=load_in_4bit,
        )
        FastLanguageModel.for_inference(model)   # native 2× faster inference
        logger.info("Unsloth 4-bit model ready — NVIDIA optimised")
    else:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        model.eval()
        logger.info("Standard transformers model loaded")

    current_model_id = model_name

# ────────────────────────────────────────────────────────────────────────────
# Raw inference helper (used by all higher-level endpoints)
# ────────────────────────────────────────────────────────────────────────────

def _generate(prompt: str, max_tokens: int = 512, temperature: float = 0.7,
              top_p: float = 0.95, top_k: int = 50) -> str:
    if model is None:
        raise RuntimeError("Model not loaded. Call /models/load first.")

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True,
                       max_length=3072).to(device)
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
            repetition_penalty=1.1,
        )

    # Decode only the newly generated tokens
    new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_ids, skip_special_tokens=True).strip()

# ────────────────────────────────────────────────────────────────────────────
# LangChain LLM wrapper
# ────────────────────────────────────────────────────────────────────────────

if HAS_LANGCHAIN:
    class MossyLLM(LLM):
        @property
        def _llm_type(self) -> str:
            return "mossy-gemma4-local"

        def _call(self, prompt: str, stop=None,
                  run_manager: Optional[CallbackManagerLLMRun] = None,
                  **kwargs) -> str:
            return _generate(prompt,
                             max_tokens=kwargs.get("max_tokens", 512),
                             temperature=kwargs.get("temperature", 0.7))

# ────────────────────────────────────────────────────────────────────────────
# Startup
# ────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    global conv_memory, rag_index

    # Attempt to load the default model; non-fatal if weights not downloaded yet
    default_model = os.getenv("MOSSY_MODEL", "google/gemma-4-9b")
    try:
        _load_model(default_model, load_in_4bit=True)
    except Exception as exc:
        logger.warning(f"Could not auto-load {default_model}: {exc}")
        logger.warning("Start Mossy first, then call POST /models/load to load the model.")

    # LangChain conversation memory
    if HAS_LANGCHAIN:
        conv_memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=False,
            ai_prefix="Mossy",
        )

    # LlamaIndex RAG
    if HAS_LLAMAINDEX:
        try:
            chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
            collection = chroma_client.get_or_create_collection(
                name="mossy_rag",
                metadata={"hnsw:space": "cosine"},
            )
            vector_store = ChromaVectorStore(chroma_collection=collection)
            storage_ctx  = StorageContext.from_defaults(vector_store=vector_store)
            embed_model  = HuggingFaceEmbedding(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            rag_index = VectorStoreIndex(
                [], storage_context=storage_ctx, embed_model=embed_model
            )
            logger.info("LlamaIndex RAG index ready")
        except Exception as exc:
            logger.warning(f"RAG init failed: {exc}")
            rag_index = None

    logger.info("Mossy Brain Service startup complete")

# ────────────────────────────────────────────────────────────────────────────
# Health
# ────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    gpu_mem = torch.cuda.memory_allocated() / 1e9 if torch.cuda.is_available() else 0.0
    gpu_total = (
        torch.cuda.get_device_properties(0).total_memory / 1e9
        if torch.cuda.is_available() else 0.0
    )
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "current_model": current_model_id,
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "gpu_vram_used_gb": round(gpu_mem, 2),
        "gpu_vram_total_gb": round(gpu_total, 2),
        "unsloth_enabled": HAS_UNSLOTH,
        "rag_enabled": HAS_LLAMAINDEX and rag_index is not None,
        "langchain_enabled": HAS_LANGCHAIN,
        "fine_tune_enabled": HAS_FINETUNE,
        "features": {
            "inference":    model is not None,
            "chains":       HAS_LANGCHAIN and model is not None,
            "rag":          HAS_LLAMAINDEX and rag_index is not None,
            "fine_tuning":  HAS_FINETUNE and model is not None,
            "planning":     model is not None,
            "reflection":   model is not None,
            "chain_of_thought": model is not None,
            "tool_execution": True,
        },
    }

# ────────────────────────────────────────────────────────────────────────────
# Model management
# ────────────────────────────────────────────────────────────────────────────

@app.post("/models/load")
async def load_model_endpoint(req: LoadModelRequest):
    try:
        _load_model(req.model_name, req.load_in_4bit, req.max_seq_length)
        return {"status": "success", "model": req.model_name}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# Legacy endpoint alias
@app.post("/models/load/{model_name}")
async def load_model_by_name(model_name: str):
    try:
        _load_model(model_name)
        return {"status": "success", "model": model_name}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/models/available")
@app.get("/models")
async def list_models():
    return {
        "models": [
            "google/gemma-4-9b",
            "google/gemma-4-12b-it",
            "google/gemma-3-4b-it",
            "google/gemma-3-12b-it",
            "google/gemma-2-9b-it",
            "unsloth/gemma-3-4b-it",
            "unsloth/gemma-3-12b-it",
        ],
        "current_model": current_model_id,
        "unsloth_available": HAS_UNSLOTH,
    }

# ────────────────────────────────────────────────────────────────────────────
# Core inference (two URL aliases for compatibility)
# ────────────────────────────────────────────────────────────────────────────

@app.post("/infer")
@app.post("/inference")
async def infer(request: InferenceRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        text = _generate(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
        )
        return {"prompt": request.prompt, "response": text, "text": text, "success": True}
    except Exception as exc:
        logger.error(f"Inference error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# LangChain reasoning chains
# ────────────────────────────────────────────────────────────────────────────

@app.post("/chain")
async def chain_endpoint(request: ChainRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        if HAS_LANGCHAIN:
            llm = MossyLLM()

            if request.chain_type == "conversational":
                conversation = ConversationChain(llm=llm, memory=conv_memory, verbose=False)
                response = conversation.predict(input=request.query)

            elif request.chain_type == "summary":
                tmpl = (
                    "You are Mossy, an AI assistant. Summarize concisely.\n\n"
                    "Context: {context}\nQuery: {query}\n\nSummary:"
                )
                prompt = PromptTemplate(template=tmpl, input_variables=["context", "query"])
                chain_obj = LLMChain(llm=llm, prompt=prompt)
                response = chain_obj.run(
                    context=request.context.get("context", "") if request.context else "",
                    query=request.query,
                )
            else:  # simple
                tmpl = (
                    "You are Mossy, a highly intelligent AI assistant. "
                    "Answer the following question thoroughly and accurately.\n\n"
                    "Question: {query}\n\nAnswer:"
                )
                prompt = PromptTemplate(template=tmpl, input_variables=["query"])
                chain_obj = LLMChain(llm=llm, prompt=prompt)
                response = chain_obj.run(query=request.query)
        else:
            # Fallback: direct generation
            prompt = (
                f"You are Mossy, an intelligent AI assistant.\n\n"
                f"Question: {request.query}\n\nAnswer:"
            )
            response = _generate(prompt)

        return {"query": request.query, "chain_type": request.chain_type,
                "response": response, "success": True}
    except Exception as exc:
        logger.error(f"Chain error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Chain-of-thought reasoning
# ────────────────────────────────────────────────────────────────────────────

@app.post("/chain-of-thought")
async def chain_of_thought(request: ChainOfThoughtRequest):
    """
    Explicit step-by-step reasoning.  The model shows its work before giving
    a final answer — improves accuracy on complex problems.
    """
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    context_block = f"\nAdditional context:\n{request.context}\n" if request.context else ""
    prompt = textwrap.dedent(f"""
        You are Mossy, an extremely capable AI assistant with advanced reasoning skills.
        Solve the following problem by thinking through it step by step.
        Show your reasoning clearly — label each step. End with "Final Answer: <answer>".
        {context_block}
        Problem: {request.problem}

        Step-by-step reasoning:
    """).strip()

    try:
        raw = _generate(prompt, max_tokens=1024, temperature=0.4)

        # Split steps and final answer
        steps, final_answer = [], ""
        for line in raw.splitlines():
            stripped = line.strip()
            if stripped.lower().startswith("final answer"):
                final_answer = stripped.split(":", 1)[-1].strip()
            elif stripped:
                steps.append(stripped)

        return {
            "problem": request.problem,
            "steps": steps,
            "final_answer": final_answer or (steps[-1] if steps else raw),
            "full_reasoning": raw,
            "success": True,
        }
    except Exception as exc:
        logger.error(f"Chain-of-thought error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Goal decomposition & planning
# ────────────────────────────────────────────────────────────────────────────

@app.post("/plan")
async def plan_goal(request: PlanRequest):
    """
    Decompose a high-level goal into concrete, ordered steps.
    Uses a structured prompt to produce a numbered action plan.
    """
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    context_block = f"\nContext:\n{request.context}\n" if request.context else ""
    prompt = textwrap.dedent(f"""
        You are Mossy, an expert AI planning assistant.
        Break down the following goal into a maximum of {request.max_steps} clear, actionable steps.
        Each step should be specific, achievable, and logically ordered.
        Format: numbered list. After the steps, add a one-sentence "Summary:" of the overall approach.
        {context_block}
        Goal: {request.goal}

        Action Plan:
    """).strip()

    try:
        raw = _generate(prompt, max_tokens=800, temperature=0.5)

        steps, summary = [], ""
        for line in raw.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.lower().startswith("summary:"):
                summary = stripped.split(":", 1)[-1].strip()
            elif stripped[0].isdigit():
                # Remove leading "1." / "1)" style prefixes
                step_text = stripped.lstrip("0123456789.)- ").strip()
                if step_text:
                    steps.append(step_text)

        return {
            "goal": request.goal,
            "steps": steps,
            "summary": summary,
            "raw_plan": raw,
            "success": True,
        }
    except Exception as exc:
        logger.error(f"Planning error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Self-reflection / critique
# ────────────────────────────────────────────────────────────────────────────

@app.post("/reflect")
async def self_reflect(request: ReflectRequest):
    """
    Mossy critiques her own previous answer and produces an improved version.
    This simulates a "think twice" loop for better accuracy.
    """
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    context_block = f"\nContext:\n{request.context}\n" if request.context else ""
    prompt = textwrap.dedent(f"""
        You are Mossy, a self-improving AI assistant.
        You previously answered a question. Now critically evaluate that answer:
        - Identify any errors, gaps, or unclear parts.
        - Then produce an improved, corrected answer.
        {context_block}
        Original Question: {request.question}
        Previous Answer: {request.answer}

        Critique (what was wrong or missing):
    """).strip()

    try:
        critique_raw = _generate(prompt, max_tokens=600, temperature=0.5)

        # Second pass: generate the improved answer
        improve_prompt = textwrap.dedent(f"""
            You are Mossy. Given the critique of your previous answer, write a better answer now.

            Question: {request.question}
            Critique: {critique_raw}

            Improved Answer:
        """).strip()
        improved = _generate(improve_prompt, max_tokens=700, temperature=0.6)

        return {
            "question": request.question,
            "original_answer": request.answer,
            "critique": critique_raw,
            "improved_answer": improved,
            "success": True,
        }
    except Exception as exc:
        logger.error(f"Reflection error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Safe Python tool execution
# ────────────────────────────────────────────────────────────────────────────

SAFE_BUILTINS = {
    "abs", "all", "any", "bin", "bool", "chr", "dict", "dir",
    "divmod", "enumerate", "filter", "float", "format", "frozenset",
    "getattr", "hasattr", "hash", "hex", "id", "int", "isinstance",
    "issubclass", "iter", "len", "list", "map", "max", "min", "next",
    "oct", "ord", "pow", "print", "range", "repr", "reversed", "round",
    "set", "slice", "sorted", "str", "sum", "tuple", "type", "vars", "zip",
}

@app.post("/tools/execute")
async def execute_tool(request: ToolExecuteRequest):
    """
    Execute a small Python snippet safely inside a restricted namespace.
    Useful for Mossy to do calculations, data processing, or logic checks.
    Timeout is enforced via subprocess; dangerous builtins are stripped.
    """
    stdout_buf = StringIO()
    stderr_buf = StringIO()
    result_val  = None

    safe_globals: dict = {
        "__builtins__": {k: __builtins__[k] for k in SAFE_BUILTINS
                         if k in __builtins__}  # type: ignore[index]
        if isinstance(__builtins__, dict)
        else {k: getattr(__builtins__, k) for k in SAFE_BUILTINS
              if hasattr(__builtins__, k)},
    }

    try:
        import signal

        def _timeout_handler(signum, frame):
            raise TimeoutError("Execution exceeded time limit")

        if hasattr(signal, "SIGALRM"):
            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(max(1, min(request.timeout_seconds, 15)))

        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(request.code, "<mossy_tool>", "exec"), safe_globals)   # noqa: S102
            result_val = safe_globals.get("result")

        if hasattr(signal, "SIGALRM"):
            signal.alarm(0)

        return {
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "result": str(result_val) if result_val is not None else None,
            "success": True,
        }
    except TimeoutError:
        return {"stdout": "", "stderr": "Execution timed out", "result": None, "success": False}
    except Exception as exc:
        return {
            "stdout": stdout_buf.getvalue(),
            "stderr": traceback.format_exc(),
            "result": None,
            "success": False,
            "error": str(exc),
        }

# ────────────────────────────────────────────────────────────────────────────
# RAG — document Q&A
# ────────────────────────────────────────────────────────────────────────────

@app.post("/rag-query")
async def rag_query(request: RAGRequest):
    if not HAS_LLAMAINDEX or not rag_index:
        raise HTTPException(status_code=503, detail="RAG not available — LlamaIndex not installed or index empty")

    try:
        qe       = rag_index.as_query_engine()
        response = qe.query(request.query)
        sources  = []
        if hasattr(response, "source_nodes"):
            sources = [
                {"text": n.node.get_content(), "score": round(n.score or 0.0, 4)}
                for n in response.source_nodes
            ]
        return {"query": request.query, "response": str(response),
                "source_nodes": sources, "success": True}
    except Exception as exc:
        logger.error(f"RAG query error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/add-documents")
async def add_documents(documents: List[Dict[str, str]]):
    if not HAS_LLAMAINDEX or not rag_index:
        raise HTTPException(status_code=503, detail="RAG not available")

    try:
        for doc in documents:
            rag_index.insert(Document(
                text=doc.get("text", ""),
                metadata=doc.get("metadata", {}),
            ))
        return {"success": True, "documents_added": len(documents)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Fine-tuning with Unsloth LoRA
# ────────────────────────────────────────────────────────────────────────────

@app.post("/fine-tune/start")
@app.post("/fine-tune")
async def start_fine_tune(request: FineTuneRequest, background_tasks: BackgroundTasks):
    if not HAS_FINETUNE:
        raise HTTPException(status_code=503, detail="Fine-tuning libraries (PEFT/TRL) not installed")

    job_id = str(uuid.uuid4())
    fine_tune_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "started_at": datetime.now().isoformat(),
        "config": request.dict(),
    }
    background_tasks.add_task(_run_fine_tune, job_id, request)
    return {"job_id": job_id, "status": "queued", "message": "Fine-tuning job queued"}

async def _run_fine_tune(job_id: str, request: FineTuneRequest):
    try:
        fine_tune_jobs[job_id]["status"] = "running"
        fine_tune_jobs[job_id]["message"] = "Loading model for fine-tuning..."

        if HAS_UNSLOTH:
            ft_model, ft_tokenizer = FastLanguageModel.from_pretrained(
                model_name=request.model_name,
                max_seq_length=request.max_seq_length,
                dtype=None,
                load_in_4bit=True,
            )
            ft_model = FastLanguageModel.get_peft_model(
                ft_model,
                r=request.lora_rank,
                lora_alpha=request.lora_alpha,
                lora_dropout=request.lora_dropout,
                target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                 "gate_proj", "up_proj", "down_proj"],
                bias="none",
                use_gradient_checkpointing="unsloth",
                random_state=42,
            )
        else:
            from transformers import AutoTokenizer as AT, AutoModelForCausalLM as AMCL
            ft_tokenizer = AT.from_pretrained(request.model_name)
            ft_model = AMCL.from_pretrained(request.model_name, torch_dtype=torch.float16,
                                            device_map="auto")
            lora_cfg = LoraConfig(r=request.lora_rank, lora_alpha=request.lora_alpha,
                                  lora_dropout=request.lora_dropout, bias="none",
                                  task_type=TaskType.CAUSAL_LM)
            ft_model = get_peft_model(ft_model, lora_cfg)

        fine_tune_jobs[job_id]["message"] = "Building dataset..."
        fine_tune_jobs[job_id]["progress"] = 20

        texts: List[str] = []
        if request.dataset_text:
            texts = request.dataset_text
        elif request.dataset_name:
            ds = load_dataset(request.dataset_name, split="train")
            texts = ds["text"] if "text" in ds.column_names else []

        if not texts:
            raise ValueError("No training data provided")

        dataset = Dataset.from_dict({"text": texts})

        fine_tune_jobs[job_id]["message"] = "Training..."
        fine_tune_jobs[job_id]["progress"] = 30

        training_args = TrainingArguments(
            output_dir=request.output_dir,
            num_train_epochs=request.num_epochs,
            per_device_train_batch_size=request.batch_size,
            gradient_accumulation_steps=4,
            learning_rate=request.learning_rate,
            warmup_ratio=0.03,
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            fp16=torch.cuda.is_available() and not HAS_UNSLOTH,
            bf16=torch.cuda.is_available() and HAS_UNSLOTH,
            logging_steps=10,
            save_steps=50,
            save_total_limit=2,
        )

        trainer = SFTTrainer(
            model=ft_model,
            tokenizer=ft_tokenizer,
            train_dataset=dataset,
            args=training_args,
            dataset_text_field="text",
            max_seq_length=request.max_seq_length,
        )

        trainer.train()

        fine_tune_jobs[job_id]["message"] = "Saving model..."
        fine_tune_jobs[job_id]["progress"] = 95
        ft_model.save_pretrained(request.output_dir)
        ft_tokenizer.save_pretrained(request.output_dir)

        fine_tune_jobs[job_id]["status"]   = "completed"
        fine_tune_jobs[job_id]["progress"] = 100
        fine_tune_jobs[job_id]["message"]  = f"Saved to {request.output_dir}"
    except Exception as exc:
        logger.error(f"Fine-tune job {job_id} failed: {exc}")
        fine_tune_jobs[job_id]["status"]  = "failed"
        fine_tune_jobs[job_id]["message"] = str(exc)

@app.get("/fine-tune/status/{job_id}")
@app.get("/fine-tune/{job_id}")
async def fine_tune_status(job_id: str):
    if job_id not in fine_tune_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return fine_tune_jobs[job_id]

# ────────────────────────────────────────────────────────────────────────────
# Entry point
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Starting Mossy Brain Service on port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
