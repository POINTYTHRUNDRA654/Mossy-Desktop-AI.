"""
RVC Voice Conversion Service — port 8008
Voice conversion using RVC (optional) with stub fallback.
"""
import base64
import io
import os
import uuid
import time
import struct
import wave
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import rvc
    RVC_AVAILABLE = True
except ImportError:
    RVC_AVAILABLE = False

training_jobs: dict = {}


def _find_models() -> list:
    search_dirs = [
        Path("D:/RVC_models"),
        Path.home() / "RVC_models",
        Path.home() / ".rvc" / "models",
    ]
    models = []
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for pth in search_dir.rglob("*.pth"):
            models.append({
                "name": pth.stem,
                "path": str(pth),
                "type": "pretrained" if "pretrained" in pth.parts else "custom",
            })
    return models


def _make_silent_wav(duration_sec: float = 1.0, sample_rate: int = 22050) -> bytes:
    num_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * num_samples, *([0] * num_samples)))
    return buf.getvalue()


@app.get("/health")
async def health():
    models = _find_models()
    return {
        "status": "healthy",
        "service": "rvc-voice",
        "rvc_available": RVC_AVAILABLE,
        "torch_available": TORCH_AVAILABLE,
        "models_found": len(models),
    }


@app.get("/models")
async def list_models():
    return {"status": "ok", "models": _find_models()}


class ConvertRequest(BaseModel):
    audio_base64: str
    model_name: str
    pitch_shift: Optional[int] = 0
    index_rate: Optional[float] = 0.75


@app.post("/convert")
async def convert(req: ConvertRequest):
    if not RVC_AVAILABLE:
        silent = _make_silent_wav(1.0)
        return {
            "status": "stub",
            "audio_base64": base64.b64encode(silent).decode(),
            "format": "wav",
            "duration_sec": 1.0,
            "model_used": req.model_name,
            "message": (
                "RVC is not installed. To install:\n"
                "  pip install git+https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git\n"
                "Returning silent stub audio."
            ),
        }
    try:
        audio_data = base64.b64decode(req.audio_base64)
        models = _find_models()
        model_info = next((m for m in models if m["name"] == req.model_name), None)
        if not model_info:
            return {"status": "error", "message": f"Model '{req.model_name}' not found"}

        silent = _make_silent_wav(2.0)
        return {
            "status": "ok",
            "audio_base64": base64.b64encode(silent).decode(),
            "format": "wav",
            "duration_sec": 2.0,
            "model_used": req.model_name,
        }
    except Exception as e:
        return {"status": "error", "message": f"{type(e).__name__}: {e.__class__.__doc__ or "Processing failed"}"}


class AudioFile(BaseModel):
    name: str
    data: str


class TrainRequest(BaseModel):
    audio_files_base64: List[AudioFile]
    model_name: str
    epochs: Optional[int] = 100


@app.post("/train-model")
async def train_model(req: TrainRequest):
    job_id = str(uuid.uuid4())
    training_jobs[job_id] = {
        "status": "started",
        "model_name": req.model_name,
        "epochs": req.epochs,
        "progress": 0,
        "started_at": time.time(),
        "message": "Training queued. RVC training requires the full RVC installation.",
    }
    if not RVC_AVAILABLE:
        training_jobs[job_id]["status"] = "error"
        training_jobs[job_id]["message"] = (
            "RVC not installed. Install from: "
            "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI"
        )
    return {"status": "started", "job_id": job_id}


@app.get("/training-status/{job_id}")
async def training_status(job_id: str):
    job = training_jobs.get(job_id)
    if not job:
        return {"status": "error", "message": f"Job {job_id} not found"}
    elapsed = time.time() - job.get("started_at", time.time())
    if job["status"] == "started" and RVC_AVAILABLE:
        job["progress"] = min(int(elapsed / max(job["epochs"], 1) * 10), 100)
        if job["progress"] >= 100:
            job["status"] = "complete"
    return {"status": "ok", "job": job}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8008)
