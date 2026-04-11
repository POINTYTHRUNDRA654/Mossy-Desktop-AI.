"""
Gemma 4 Fine-tuning Service
Provides REST API for fine-tuning, inference, and model management
"""

import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from uvicorn import run as run_server

# Fine-tuning infrastructure
from transformers import AutoTokenizer, AutoModelForCausalLM
from unsloth import FastLanguageModel
from peft import get_peft_model, LoraConfig, TaskType
from datasets import Dataset, load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

app = FastAPI(title="Mossy Gemma 4 Fine-tuning Service")

# CORS middleware for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ────────────────────────────────────────────────────────────────


class FineTuneConfig(BaseModel):
    """Configuration for fine-tuning job"""

    model_name: str = "google/gemma-4-9b"
    dataset_name: Optional[str] = None
    dataset_text: Optional[List[Dict[str, str]]] = None  # List of {"text": "..."}
    output_dir: str = "./gemma4_finetuned"
    num_epochs: int = 3
    batch_size: int = 4
    learning_rate: float = 2e-4
    max_seq_length: int = 2048
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05


class InferenceRequest(BaseModel):
    """Request for model inference"""

    prompt: str
    model_path: str = "google/gemma-4-9b"
    max_tokens: int = 512
    temperature: float = 0.7


class InferenceResponse(BaseModel):
    """Response from model inference"""

    text: str
    model: str


class FineTuneStatus(BaseModel):
    """Status of fine-tuning job"""

    job_id: str
    status: str  # "pending", "running", "completed", "failed"
    progress: float
    message: str


# Global state
jobs: Dict[str, dict] = {}
current_model = None
current_tokenizer = None

# ─── Fine-tuning Functions ────────────────────────────────────────────────


def load_model_and_tokenizer(model_name: str):
    """Load Gemma 4 model with unsloth optimizations"""
    global current_model, current_tokenizer

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=2048,
        dtype=torch.float16,
        load_in_4bit=True,
    )

    current_model = model
    current_tokenizer = tokenizer
    return model, tokenizer


def prepare_lora_model(model, config: FineTuneConfig):
    """Prepare model for LoRA fine-tuning"""
    lora_config = LoraConfig(
        r=config.lora_rank,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=["q_proj", "v_proj"],
    )

    model = get_peft_model(model, lora_config)
    return model


def prepare_dataset(config: FineTuneConfig) -> Dataset:
    """Prepare training dataset"""
    if config.dataset_text:
        # Use provided text data
        texts = [item["text"] for item in config.dataset_text]
        dataset = Dataset.from_dict({"text": texts})
    elif config.dataset_name:
        # Load from Hugging Face
        dataset = load_dataset(config.dataset_name, split="train")
    else:
        raise ValueError("Either dataset_name or dataset_text must be provided")

    return dataset


async def fine_tune_gemma4(job_id: str, config: FineTuneConfig):
    """Execute fine-tuning job"""
    try:
        jobs[job_id]["status"] = "running"
        jobs[job_id]["progress"] = 0.0

        jobs[job_id]["message"] = "Loading model..."
        model, tokenizer = load_model_and_tokenizer(config.model_name)
        jobs[job_id]["progress"] = 0.1

        jobs[job_id]["message"] = "Preparing LoRA configuration..."
        model = prepare_lora_model(model, config)
        jobs[job_id]["progress"] = 0.2

        jobs[job_id]["message"] = "Loading dataset..."
        dataset = prepare_dataset(config)
        jobs[job_id]["progress"] = 0.3

        jobs[job_id]["message"] = "Starting training..."

        training_args = TrainingArguments(
            output_dir=config.output_dir,
            num_train_epochs=config.num_epochs,
            per_device_train_batch_size=config.batch_size,
            gradient_accumulation_steps=2,
            learning_rate=config.learning_rate,
            warmup_steps=100,
            weight_decay=0.01,
            logging_steps=10,
            save_steps=50,
            save_total_limit=2,
            fp16=torch.cuda.is_available(),
        )

        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=dataset,
            args=training_args,
            dataset_text_field="text",
            max_seq_length=config.max_seq_length,
        )

        trainer.train()

        jobs[job_id]["progress"] = 0.95
        jobs[job_id]["message"] = "Saving model..."

        # Save model and tokenizer
        model.save_pretrained(config.output_dir)
        tokenizer.save_pretrained(config.output_dir)

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 1.0
        jobs[job_id]["message"] = (
            f"Fine-tuning completed. Model saved to {config.output_dir}"
        )

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["message"] = f"Error: {str(e)}"


# ─── API Endpoints ────────────────────────────────────────────────────────


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cuda_available": torch.cuda.is_available(),
        "device": str(torch.device("cuda" if torch.cuda.is_available() else "cpu")),
    }


@app.post("/fine-tune/start")
async def start_fine_tune(config: FineTuneConfig, background_tasks: BackgroundTasks):
    """Start a fine-tuning job"""
    import uuid

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "progress": 0.0,
        "message": "Initializing...",
        "config": config.model_dump(),
    }

    background_tasks.add_task(fine_tune_gemma4, job_id, config)

    return {
        "job_id": job_id,
        "status": "submitted",
        "message": "Fine-tuning job submitted",
    }


@app.get("/fine-tune/status/{job_id}")
async def get_fine_tune_status(job_id: str):
    """Get status of a fine-tuning job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    return FineTuneStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
    )


@app.post("/inference")
async def run_inference(request: InferenceRequest):
    """Run inference with loaded model"""
    global current_model, current_tokenizer

    if current_model is None:
        # Load default model
        model, tokenizer = load_model_and_tokenizer(request.model_path)
    else:
        model, tokenizer = current_model, current_tokenizer

    try:
        inputs = tokenizer(request.prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=request.max_tokens,
                temperature=request.temperature,
                do_sample=True,
                top_p=0.95,
            )

        text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        return InferenceResponse(text=text, model=request.model_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models/available")
async def list_available_models():
    """List available models"""
    return {
        "models": [
            "google/gemma-4-9b",
            "google/gemma-2-9b",
            "google/gemma-1.1-7b-it",
        ]
    }


@app.post("/models/load/{model_name}")
async def load_model(model_name: str):
    """Load a specific model"""
    try:
        load_model_and_tokenizer(model_name)
        return {"status": "success", "model": model_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_server(app, host="127.0.0.1", port=8000, log_level="info")
