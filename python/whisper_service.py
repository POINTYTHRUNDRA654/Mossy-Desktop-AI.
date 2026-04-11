#!/usr/bin/env python3
"""
Whisper Speech-to-Text Service
Provides fast, accurate speech recognition on GPU using faster-whisper library.
Runs as FastAPI service on port 8002.
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile
import uuid

# Try to import faster-whisper, fall back to OpenAI Whisper
try:
    from faster_whisper import WhisperModel
    USE_FASTER_WHISPER = True
except ImportError:
    try:
        import whisper as openai_whisper
        USE_FASTER_WHISPER = False
    except ImportError:
        USE_FASTER_WHISPER = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper Speech-to-Text Service", version="1.0.0")

# Global model instance
whisper_model = None
device = "cuda"  # Use GPU for faster processing
model_name = "base"  # Options: tiny, base, small, medium, large

# ────────────────────────────────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────────────────────────────────

class TranscriptionRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None  # ISO-639-1 code (e.g., "en", "es")
    beam_size: Optional[int] = None
    best_of: Optional[int] = None
    temperature: Optional[float] = None
    vad_filter: Optional[bool] = True

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    segments: List[Dict[str, Any]]
    duration: float
    success: bool

class HealthStatus(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    device: str
    library: str

# ────────────────────────────────────────────────────────────────────────────
# Service Initialization
# ────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Load whisper model on service startup"""
    global whisper_model
    try:
        if USE_FASTER_WHISPER:
            logger.info(f"Loading faster-whisper model: {model_name} on {device}")
            whisper_model = WhisperModel(
                model_name, 
                device=device, 
                compute_type="int8_float16"  # Optimized for NVIDIA GPUs
            )
            logger.info("faster-whisper model loaded successfully")
        elif USE_FASTER_WHISPER is False:
            logger.info(f"Loading OpenAI Whisper model: {model_name}")
            whisper_model = openai_whisper.load_model(model_name, device=device)
            logger.info("OpenAI Whisper model loaded successfully")
        else:
            logger.error("Neither faster-whisper nor whisper available")
    except Exception as e:
        logger.error(f"Failed to load whisper model: {e}")
        whisper_model = None

# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Check service health and model status"""
    library = "faster-whisper" if USE_FASTER_WHISPER else ("openai-whisper" if USE_FASTER_WHISPER is False else "unavailable")
    return HealthStatus(
        status="healthy" if whisper_model else "unhealthy",
        model_loaded=whisper_model is not None,
        model_name=model_name,
        device=device,
        library=library
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: TranscriptionRequest):
    """Transcribe audio file to text"""
    if not whisper_model:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")
    
    if not os.path.exists(request.audio_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {request.audio_path}")
    
    try:
        if USE_FASTER_WHISPER:
            segments, info = whisper_model.transcribe(
                request.audio_path,
                language=request.language,
                beam_size=request.beam_size or 5,
                best_of=request.best_of or 5,
                temperature=request.temperature or 0.0,
                vad_filter=request.vad_filter
            )
            # Convert segments to list format
            segments_list = [
                {
                    "id": i,
                    "seek": seg.seek,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "tokens": seg.tokens,
                    "temperature": seg.temperature,
                    "avg_logprob": seg.avg_logprob,
                    "compression_ratio": seg.compression_ratio,
                    "no_speech_prob": seg.no_speech_prob
                }
                for i, seg in enumerate(segments)
            ]
            full_text = "".join([seg.text for seg in segments_list])
            
            return TranscriptionResponse(
                text=full_text,
                language=info.language,
                segments=segments_list,
                duration=info.duration,
                success=True
            )
        else:
            # OpenAI Whisper fallback
            result = whisper_model.transcribe(
                request.audio_path,
                language=request.language,
                temperature=request.temperature or 0.0
            )
            return TranscriptionResponse(
                text=result["text"],
                language=result["language"],
                segments=result.get("segments", []),
                duration=result.get("duration", 0),
                success=True
            )
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.post("/transcribe-bytes")
async def transcribe_bytes(file: UploadFile = File(...), language: Optional[str] = None):
    """Transcribe audio file from upload bytes"""
    if not whisper_model:
        raise HTTPException(status_code=503, detail="Whisper model not loaded")
    
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            if USE_FASTER_WHISPER:
                segments, info = whisper_model.transcribe(
                    tmp_path,
                    language=language,
                    vad_filter=True
                )
                full_text = "".join([seg.text for seg in segments])
                return JSONResponse({
                    "text": full_text,
                    "language": info.language,
                    "success": True
                })
            else:
                result = openai_whisper.transcribe(tmp_path, language=language)
                return JSONResponse({
                    "text": result["text"],
                    "language": result["language"],
                    "success": True
                })
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception as e:
        logger.error(f"Transcription from bytes failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.get("/models")
async def list_models():
    """List available Whisper models"""
    return {
        "available_models": ["tiny", "base", "small", "medium", "large"],
        "current_model": model_name,
        "library": "faster-whisper" if USE_FASTER_WHISPER else "openai-whisper"
    }

@app.post("/set-model")
async def set_model(model: str):
    """Switch to different Whisper model (requires reload)"""
    global whisper_model, model_name
    if model not in ["tiny", "base", "small", "medium", "large"]:
        raise HTTPException(status_code=400, detail="Invalid model name")
    
    try:
        model_name = model
        if USE_FASTER_WHISPER:
            whisper_model = WhisperModel(model, device=device, compute_type="int8_float16")
        else:
            whisper_model = openai_whisper.load_model(model, device=device)
        return {"status": "success", "model": model_name}
    except Exception as e:
        logger.error(f"Failed to load model {model}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting Whisper Speech-to-Text Service on port 8002")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
