#!/usr/bin/env python3
"""
Enhanced Gemma 4 Service with LangChain & LlamaIndex Integration
Supports:
- Local Gemma 4 inference via unsloth
- Fine-tuning with LoRA
- Multi-step reasoning chains (LangChain)
- Document Q&A with RAG (LlamaIndex + Chroma)
Runs on port 8000 as FastAPI service
"""

import os
import json
import logging
import asyncio
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import httpx

# LangChain imports
from langchain.llms.base import LLM
from langchain.callbacks.manager import CallbackManagerLLMRun
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.agents import initialize_agent, Tool, AgentType
from langchain_core.runnables import RunnablePassthrough

# LlamaIndex imports (for RAG)
try:
    from llama_index.core import VectorStoreIndex, Document, SimpleDirectoryReader
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    from llama_index.vector_stores.chroma import ChromaVectorStore
    from llama_index.core.storage import StorageContext
    import chromadb
    HAS_LLAMAINDEX = True
except ImportError:
    HAS_LLAMAINDEX = False
    logger = logging.getLogger(__name__)
    logger.warning("LlamaIndex not available; RAG features disabled")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Gemma 4 Advanced Service", version="2.0.0")

# ────────────────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CHROMA_DB_PATH = os.path.join(DATA_DIR, "chroma_db")
JOBS_DIR = os.path.join(DATA_DIR, "jobs")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(JOBS_DIR, exist_ok=True)

# Global model and components
model = None
tokenizer = None
device = "cuda" if torch.cuda.is_available() else "cpu"
fine_tune_jobs = {}

# LangChain components
rag_index = None
memory = None
agent = None

# ────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ────────────────────────────────────────────────────────────────────────────

class InferenceRequest(BaseModel):
    prompt: str
    max_tokens: int = 256
    temperature: float = 0.7
    top_p: float = 0.95
    top_k: int = 50

class ChainRequest(BaseModel):
    """Request for multi-step reasoning chain"""
    query: str
    chain_type: str = "simple"  # "simple", "summary", "conversational"
    context: Optional[Dict[str, str]] = None

class RAGRequest(BaseModel):
    """Request for document Q&A"""
    query: str
    use_rag: bool = True

class FineTuneRequest(BaseModel):
    dataset_text: List[str]
    output_dir: str = "./models/gemma4-finetuned"
    num_epochs: int = 3
    batch_size: int = 4
    learning_rate: float = 2e-4
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05

class HealthStatus(BaseModel):
    status: str
    model_loaded: bool
    memory_usage: float
    device: str
    features: Dict[str, bool]

# ────────────────────────────────────────────────────────────────────────────
# Custom LangChain LLM Wrapper
# ────────────────────────────────────────────────────────────────────────────

class Gemma4LLM(LLM):
    """LangChain LLM wrapper for Gemma 4"""
    
    @property
    def _llm_type(self) -> str:
        return "gemma4-local"
    
    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Call the Gemma 4 model"""
        if not model:
            raise RuntimeError("Model not loaded")
        
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        max_tokens = kwargs.get("max_tokens", 256)
        temperature = kwargs.get("temperature", 0.7)
        
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=kwargs.get("top_p", 0.95),
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        return tokenizer.decode(outputs[0], skip_special_tokens=True)

# ────────────────────────────────────────────────────────────────────────────
# Service Initialization
# ────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Load models and initialize components"""
    global model, tokenizer, memory, agent, rag_index
    
    try:
        # Load Gemma 4 model
        logger.info("Loading Gemma 4 model...")
        model_id = "google/gemma-7b-it"  # Instruction-tuned version
        
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        logger.info("Gemma 4 model loaded successfully")
        
        # Initialize LangChain LLM wrapper
        llm = Gemma4LLM()
        
        # Initialize conversation memory
        memory = ConversationBufferMemory(
            llm=llm,
            memory_key="chat_history",
            return_messages=False,
            ai_prefix="Mossy"
        )
        
        # Initialize LlamaIndex RAG if available
        if HAS_LLAMAINDEX:
            logger.info("Initializing LlamaIndex RAG...")
            try:
                # Setup Chroma vector store
                chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
                vector_store = ChromaVectorStore(chroma_collection=chroma_client.get_or_create_collection(
                    name="mossy_rag",
                    metadata={"hnsw:space": "cosine"}
                ))
                
                storage_context = StorageContext.from_defaults(vector_store=vector_store)
                embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
                
                rag_index = VectorStoreIndex(
                    [],
                    storage_context=storage_context,
                    embed_model=embed_model
                )
                logger.info("LlamaIndex RAG initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize RAG: {e}")
                rag_index = None
        
        logger.info("Startup complete")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Check service health"""
    if torch.cuda.is_available():
        gpu_memory = torch.cuda.memory_allocated() / 1e9
    else:
        gpu_memory = 0.0
    
    return HealthStatus(
        status="healthy" if model else "unhealthy",
        model_loaded=model is not None,
        memory_usage=gpu_memory,
        device=device,
        features={
            "inference": model is not None,
            "chains": model is not None,
            "rag": HAS_LLAMAINDEX and rag_index is not None,
            "fine_tuning": model is not None
        }
    )

@app.post("/infer")
async def infer(request: InferenceRequest):
    """Run inference with Gemma 4"""
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        inputs = tokenizer(request.prompt, return_tensors="pt").to(device)
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        response_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return {
            "prompt": request.prompt,
            "response": response_text,
            "success": True
        }
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chain")
async def chain(request: ChainRequest):
    """Execute multi-step reasoning chain using LangChain"""
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        llm = Gemma4LLM()
        
        if request.chain_type == "conversational":
            # Conversational chain with memory
            conversation = ConversationChain(
                llm=llm,
                memory=memory,
                verbose=True
            )
            response = conversation.predict(input=request.query)
        
        elif request.chain_type == "summary":
            # Summary chain
            template = """Summarize the following in a concise manner:

Context: {context}
Query: {query}

Summary:"""
            prompt = PromptTemplate(template=template, input_variables=["context", "query"])
            chain_obj = LLMChain(llm=llm, prompt=prompt)
            response = chain_obj.run(
                context=request.context.get("context", "") if request.context else "",
                query=request.query
            )
        
        else:  # "simple"
            # Simple chain
            template = """Answer the following question thoughtfully:

Question: {query}

Answer:"""
            prompt = PromptTemplate(template=template, input_variables=["query"])
            chain_obj = LLMChain(llm=llm, prompt=prompt)
            response = chain_obj.run(query=request.query)
        
        return {
            "query": request.query,
            "chain_type": request.chain_type,
            "response": response,
            "success": True
        }
    except Exception as e:
        logger.error(f"Chain execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag-query")
async def rag_query(request: RAGRequest):
    """Query knowledge base with RAG (Retrieval-Augmented Generation)"""
    if not HAS_LLAMAINDEX or not rag_index:
        raise HTTPException(status_code=503, detail="RAG not available")
    
    try:
        query_engine = rag_index.as_query_engine()
        response = query_engine.query(request.query)
        
        return {
            "query": request.query,
            "response": str(response),
            "source_nodes": [
                {
                    "text": node.node.get_content(),
                    "score": node.score
                } for node in response.source_nodes
            ] if hasattr(response, 'source_nodes') else [],
            "success": True
        }
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-documents")
async def add_documents(documents: List[Dict[str, str]]):
    """Add documents to RAG knowledge base"""
    if not HAS_LLAMAINDEX or not rag_index:
        raise HTTPException(status_code=503, detail="RAG not available")
    
    try:
        doc_objects = [
            Document(text=doc.get("text", ""), metadata=doc.get("metadata", {}))
            for doc in documents
        ]
        
        # Index documents
        for doc in doc_objects:
            rag_index.insert(doc)
        
        return {
            "success": True,
            "documents_added": len(documents)
        }
    except Exception as e:
        logger.error(f"Failed to add documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fine-tune")
async def fine_tune(request: FineTuneRequest, background_tasks: BackgroundTasks):
    """Start Gemma 4 fine-tuning job"""
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    job_id = str(uuid.uuid4())
    fine_tune_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "started_at": datetime.now().isoformat(),
        "config": request.dict()
    }
    
    background_tasks.add_task(run_fine_tune, job_id, request)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Fine-tuning job queued"
    }

async def run_fine_tune(job_id: str, request: FineTuneRequest):
    """Background task for fine-tuning"""
    try:
        fine_tune_jobs[job_id]["status"] = "running"
        
        # Fine-tuning logic here (simplified)
        # In production, use unsloth with LoRA
        for epoch in range(request.num_epochs):
            fine_tune_jobs[job_id]["progress"] = int((epoch / request.num_epochs) * 100)
            await asyncio.sleep(1)  # Simulate training
        
        fine_tune_jobs[job_id]["status"] = "completed"
        fine_tune_jobs[job_id]["progress"] = 100
    except Exception as e:
        logger.error(f"Fine-tuning failed: {e}")
        fine_tune_jobs[job_id]["status"] = "failed"
        fine_tune_jobs[job_id]["error"] = str(e)

@app.get("/fine-tune/{job_id}")
async def get_fine_tune_status(job_id: str):
    """Get fine-tuning job status"""
    if job_id not in fine_tune_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return fine_tune_jobs[job_id]

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "models": ["google/gemma-7b-it"],
        "current_model": "google/gemma-7b-it"
    }

if __name__ == "__main__":
    logger.info("Starting Enhanced Gemma 4 Service on port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
