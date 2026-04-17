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
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

# ────────────────────────────────────────────────────────────────────────────
# D: DRIVE REDIRECTION — set ALL cache env vars before any library imports.
# Everything large (model weights, HF cache, datasets, Torch, pip) goes to
# D:\Mossy-AI  so the C: drive is never filled up.
# Override via MOSSY_DATA_ROOT env var if you want a different location.
# ────────────────────────────────────────────────────────────────────────────

_DATA_ROOT = Path(os.environ.get(
    "MOSSY_DATA_ROOT",
    # Default: D:\Mossy-AI on Windows, ~/Mossy-AI on macOS/Linux
    r"D:\Mossy-AI" if sys.platform == "win32" else str(Path.home() / "Mossy-AI"),
))

# HuggingFace / Transformers cache
os.environ.setdefault("HF_HOME",              str(_DATA_ROOT / "huggingface"))
os.environ.setdefault("HF_HUB_CACHE",         str(_DATA_ROOT / "huggingface" / "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE",   str(_DATA_ROOT / "huggingface" / "hub"))
os.environ.setdefault("HF_DATASETS_CACHE",    str(_DATA_ROOT / "huggingface" / "datasets"))

# PyTorch model hub cache
os.environ.setdefault("TORCH_HOME",           str(_DATA_ROOT / "torch"))

# pip download/wheel cache
os.environ.setdefault("PIP_CACHE_DIR",        str(_DATA_ROOT / "pip_cache"))

# Unsloth uses HF_HOME automatically; no extra setting needed.

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
# Paths — everything on D: drive
# ────────────────────────────────────────────────────────────────────────────

BASE_DIR    = _DATA_ROOT
MODELS_DIR  = _DATA_ROOT / "models"
DATA_DIR    = _DATA_ROOT / "data"
CHROMA_DIR  = _DATA_ROOT / "data" / "chroma_db"
JOBS_DIR    = _DATA_ROOT / "data" / "jobs"
MEMORY_DIR  = _DATA_ROOT / "memory"
MEMORY_FILE = MEMORY_DIR / "long_term.json"

for d in (MODELS_DIR, DATA_DIR, CHROMA_DIR, JOBS_DIR, MEMORY_DIR):
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
# Long-term memory helpers — persisted to D:\Mossy-AI\memory\long_term.json
# ────────────────────────────────────────────────────────────────────────────

def _load_memory() -> Dict[str, str]:
    """Load the persistent key→value memory from disk."""
    try:
        if MEMORY_FILE.exists():
            return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}

def _save_memory(mem: Dict[str, str]) -> None:
    """Persist memory to disk."""
    try:
        MEMORY_FILE.write_text(json.dumps(mem, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        logger.warning(f"Could not save memory: {exc}")

def _memory_block() -> str:
    """Return a formatted memory string to prepend to prompts (empty string if no memories)."""
    mem = _load_memory()
    if not mem:
        return ""
    lines = "\n".join(f"  - {k}: {v}" for k, v in mem.items())
    return f"[Mossy's memory from past sessions]\n{lines}\n"

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
    output_dir: str = str(_DATA_ROOT / "models" / "gemma4-finetuned")
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

class MemoryAddRequest(BaseModel):
    key: str
    value: str

class WebSearchRequest(BaseModel):
    query: str
    max_results: int = 5

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
              top_p: float = 0.95, top_k: int = 50,
              inject_memory: bool = True) -> str:
    if model is None:
        raise RuntimeError("Model not loaded. Call /models/load first.")

    # Prepend long-term memory so Mossy "remembers" across sessions
    if inject_memory:
        mem = _memory_block()
        if mem:
            prompt = mem + "\n" + prompt

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
# Safe Python tool execution — subprocess-isolated, no exec() in main process
# ────────────────────────────────────────────────────────────────────────────

# Preamble prepended to every snippet to block dangerous imports.
# Note: this provides best-effort restriction for simple calculation scripts.
# Do not use for untrusted third-party code; use a container for that.
_SANDBOX_PREAMBLE = textwrap.dedent("""
import builtins as _b
_ALLOWED = {
    'abs','all','any','bin','bool','chr','dict','divmod','enumerate',
    'filter','float','format','frozenset','getattr','hasattr','hash',
    'hex','id','int','isinstance','issubclass','iter','len','list','map',
    'max','min','next','oct','ord','pow','print','range','repr','reversed',
    'round','set','slice','sorted','str','sum','tuple','type','vars','zip',
}
for _k in list(vars(_b).keys()):
    if _k not in _ALLOWED and not _k.startswith('__'):
        try:
            delattr(_b, _k)
        except (AttributeError, TypeError):
            pass
import sys as _sys
_sys.modules['os'] = None
_sys.modules['subprocess'] = None
_sys.modules['socket'] = None
_sys.modules['importlib'] = None
_sys.modules['ctypes'] = None
_sys.modules['pickle'] = None
del _b, _ALLOWED, _k, _sys
""").strip()

@app.post("/tools/execute")
async def execute_tool(request: ToolExecuteRequest):
    """
    Execute a small Python snippet in a subprocess with hard time/resource limits.
    The subprocess is isolated: dangerous modules are blocked before the snippet runs.
    This is for local computation (math, data transforms, logic) only.
    """
    timeout = max(1, min(request.timeout_seconds, 15))
    # Wrap the snippet: preamble + user code, then print the 'result' variable if set
    wrapper = (
        _SANDBOX_PREAMBLE + "\n"
        + request.code + "\n"
        + "if 'result' in dir(): print('__result__:', result)\n"
    )

    try:
        proc = subprocess.run(
            [sys.executable, "-c", wrapper],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout = proc.stdout or ""
        stderr = proc.stderr or ""

        # Extract result value if present
        result_val = None
        filtered_lines = []
        for line in stdout.splitlines():
            if line.startswith("__result__: "):
                result_val = line[len("__result__: "):]
            else:
                filtered_lines.append(line)
        stdout = "\n".join(filtered_lines)

        return {
            "stdout": stdout,
            "stderr": stderr,
            "result": result_val,
            "success": proc.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out", "result": None, "success": False}
    except Exception as exc:
        # Do not expose internal tracebacks to caller
        logger.error(f"Tool execution error: {exc}")
        return {"stdout": "", "stderr": "Execution error", "result": None, "success": False}

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
# Long-term memory endpoints
# ────────────────────────────────────────────────────────────────────────────

@app.get("/memory")
async def get_memory():
    """Return all stored long-term memory key-value pairs."""
    return {"memory": _load_memory(), "memory_file": str(MEMORY_FILE)}

@app.post("/memory/add")
async def add_memory(req: MemoryAddRequest):
    """Store a key→value fact in Mossy's long-term memory (persisted to D: drive)."""
    mem = _load_memory()
    mem[req.key.strip()] = req.value.strip()
    _save_memory(mem)
    return {"success": True, "key": req.key, "total_memories": len(mem)}

@app.delete("/memory/{key}")
async def delete_memory(key: str):
    """Remove one key from long-term memory."""
    mem = _load_memory()
    removed = mem.pop(key, None)
    _save_memory(mem)
    return {"success": removed is not None, "key": key, "total_memories": len(mem)}

@app.delete("/memory")
async def clear_memory():
    """Wipe all long-term memory."""
    _save_memory({})
    return {"success": True, "message": "All memory cleared"}

# ────────────────────────────────────────────────────────────────────────────
# Web search tool — DuckDuckGo Instant Answer API (no API key, no cost)
# ────────────────────────────────────────────────────────────────────────────

@app.post("/tools/web-search")
async def web_search(request: WebSearchRequest):
    """
    Search the web using DuckDuckGo's free Instant Answer API.
    Returns a summary + list of related topics.  No API key required.
    Also optionally asks the model to synthesise the results into an answer.
    """
    try:
        query_encoded = urllib.parse.quote_plus(request.query)
        url = f"https://api.duckduckgo.com/?q={query_encoded}&format=json&no_redirect=1&no_html=1"

        req_obj = urllib.request.Request(url, headers={"User-Agent": "Mossy-AI/3.0"})
        with urllib.request.urlopen(req_obj, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        abstract   = data.get("Abstract", "")
        answer     = data.get("Answer", "")
        definition = data.get("Definition", "")

        # Related topics as a list of short blurbs
        topics: List[str] = []
        for item in data.get("RelatedTopics", [])[:request.max_results]:
            if isinstance(item, dict):
                text = item.get("Text", "")
                if text:
                    topics.append(text)

        # Build a readable summary
        summary_parts = [p for p in (answer, abstract, definition) if p]
        summary = " ".join(summary_parts) if summary_parts else "No instant answer found."

        # Optionally synthesise with the model if loaded
        synthesis = None
        if model is not None and (summary_parts or topics):
            context = summary + "\n" + "\n".join(topics[:3])
            synth_prompt = (
                f"You are Mossy, an AI assistant. Using only the search results below, "
                f"answer the question: {request.query}\n\nSearch results:\n{context}\n\nAnswer:"
            )
            synthesis = _generate(synth_prompt, max_tokens=400, temperature=0.4,
                                   inject_memory=False)

        return {
            "query":     request.query,
            "summary":   summary,
            "topics":    topics,
            "synthesis": synthesis,
            "success":   True,
        }
    except Exception as exc:
        logger.error(f"Web search error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

# ────────────────────────────────────────────────────────────────────────────
# Config / path info endpoint
# ────────────────────────────────────────────────────────────────────────────

@app.get("/config")
async def get_config():
    """
    Show where everything is stored on disk.
    Useful for verifying the D: drive layout is correct.
    """
    return {
        "mossy_data_root":     str(_DATA_ROOT),
        "models_dir":          str(MODELS_DIR),
        "data_dir":            str(DATA_DIR),
        "chroma_db_dir":       str(CHROMA_DIR),
        "memory_file":         str(MEMORY_FILE),
        "hf_home":             os.environ.get("HF_HOME"),
        "hf_hub_cache":        os.environ.get("HF_HUB_CACHE"),
        "transformers_cache":  os.environ.get("TRANSFORMERS_CACHE"),
        "hf_datasets_cache":   os.environ.get("HF_DATASETS_CACHE"),
        "torch_home":          os.environ.get("TORCH_HOME"),
        "pip_cache_dir":       os.environ.get("PIP_CACHE_DIR"),
        "current_model":       current_model_id,
        "memory_count":        len(_load_memory()),
    }

# ────────────────────────────────────────────────────────────────────────────
# Entry point
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Starting Mossy Brain Service on port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
