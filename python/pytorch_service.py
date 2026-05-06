"""
PyTorch Integration
Load and run custom PyTorch models for inference
"""

import sys
import torch
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from uvicorn import run as run_server

app = FastAPI(title="Mossy PyTorch Inference Service")

# ─── Types ────────────────────────────────────────────────────────────────

class ModelConfig(BaseModel):
    """PyTorch model configuration"""
    model_path: str
    model_type: str  # 'classification', 'segmentation', 'detection', 'custom'
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    dtype: str = 'float32'

class InferenceRequest(BaseModel):
    """Inference request"""
    model_path: str
    input_data: Dict[str, Any]  # Input tensor data
    return_logits: bool = False

class InferenceResponse(BaseModel):
    """Inference response"""
    output: Dict[str, Any]
    shape: List[int]
    dtype: str
    inference_time_ms: float

# ─── Global State ──────────────────────────────────────────────────────

loaded_models: Dict[str, torch.nn.Module] = {}
model_configs: Dict[str, ModelConfig] = {}

# ─── Model Loading ────────────────────────────────────────────────────────

@app.post("/load-model")
async def load_model(config: ModelConfig):
    """Load a PyTorch model"""
    try:
        model_key = config.model_path
        
        # Load checkpoint
        checkpoint = torch.load(config.model_path, map_location=config.device)
        
        # Handle different checkpoint formats
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            model = checkpoint
        else:
            model = checkpoint
        
        # Move to device
        if isinstance(model, torch.nn.Module):
            model = model.to(config.device)
            model.eval()
        
        loaded_models[model_key] = model
        model_configs[model_key] = config
        
        return {
            "status": "success",
            "model": model_key,
            "device": config.device,
            "dtype": str(model.parameters().__next__().dtype) if isinstance(model, torch.nn.Module) else config.dtype
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/unload-model/{model_id}")
async def unload_model(model_id: str):
    """Unload a model from memory"""
    if model_id in loaded_models:
        del loaded_models[model_id]
        del model_configs[model_id]
        return {"status": "success", "message": f"Unloaded {model_id}"}
    return {"status": "error", "message": f"Model {model_id} not found"}

# ─── Inference ────────────────────────────────────────────────────────────

@app.post("/infer")
async def run_inference(request: InferenceRequest):
    """Run inference on loaded model"""
    try:
        if request.model_path not in loaded_models:
            raise HTTPException(status_code=404, detail=f"Model {request.model_path} not loaded")
        
        model = loaded_models[request.model_path]
        config = model_configs[request.model_path]
        
        # Convert input to tensors
        input_tensors = {}
        for key, value in request.input_data.items():
            if isinstance(value, list):
                input_tensors[key] = torch.tensor(value, device=config.device, dtype=getattr(torch, config.dtype.lower()))
            else:
                input_tensors[key] = torch.tensor([value], device=config.device)
        
        # Run inference
        import time
        start_time = time.time()
        
        with torch.no_grad():
            if isinstance(model, torch.nn.Module):
                outputs = model(**input_tensors)
            else:
                # Handle other model types
                outputs = input_tensors
        
        inference_time = (time.time() - start_time) * 1000
        
        # Convert output to JSON-serializable format
        if isinstance(outputs, torch.Tensor):
            output_dict = {
                "output": outputs.cpu().tolist(),
                "shape": list(outputs.shape),
                "dtype": str(outputs.dtype)
            }
        elif isinstance(outputs, dict):
            output_dict = {}
            for key, val in outputs.items():
                if isinstance(val, torch.Tensor):
                    output_dict[key] = val.cpu().tolist()
                else:
                    output_dict[key] = val
        else:
            output_dict = {"output": str(outputs)}
        
        return InferenceResponse(
            output=output_dict,
            shape=list(outputs.shape) if isinstance(outputs, torch.Tensor) else [],
            dtype=str(outputs.dtype) if isinstance(outputs, torch.Tensor) else "unknown",
            inference_time_ms=inference_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Model Discovery ──────────────────────────────────────────────────────

@app.get("/models")
async def list_loaded_models():
    """List currently loaded models"""
    return {
        "models": list(loaded_models.keys()),
        "count": len(loaded_models)
    }

@app.get("/discover-models/{path}")
async def discover_models(path: str):
    """Discover PyTorch model files in directory"""
    try:
        p = Path(path)
        if not p.exists():
            return {"models": [], "error": f"Path {path} does not exist"}
        
        model_files = list(p.glob('**/*.pt')) + list(p.glob('**/*.pth')) + list(p.glob('**/*.ckpt'))
        
        return {
            "models": [str(f) for f in model_files],
            "count": len(model_files)
        }
    except Exception as e:
        return {"models": [], "error": str(e)}

# ─── System Info ──────────────────────────────────────────────────────────

@app.get("/system-info")
async def get_system_info():
    """Get PyTorch and CUDA info"""
    return {
        "pytorch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "cuda_version": torch.version.cuda,
        "cudnn_version": torch.backends.cudnn.version(),
        "device_count": torch.cuda.device_count(),
        "current_device": torch.cuda.current_device() if torch.cuda.is_available() else -1,
        "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "gpu_memory_allocated": torch.cuda.memory_allocated() / 1e9 if torch.cuda.is_available() else 0,
        "gpu_memory_reserved": torch.cuda.memory_reserved() / 1e9 if torch.cuda.is_available() else 0,
    }

# ─── Health Check ─────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "pytorch": True,
        "cuda_available": torch.cuda.is_available(),
    }

# ─── Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_server(
        app,
        host="127.0.0.1",
        port=8001,  # Different port from Gemma service
        log_level="info"
    )
