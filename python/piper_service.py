"""
Piper TTS Service — port 8006
Local text-to-speech using Piper or espeak fallback.
"""
import base64
import io
import subprocess
import tempfile
import os
import struct
import wave
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

DEFAULT_VOICES = [
    {"name": "en_US-amy-medium",    "language": "en_US", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"},
    {"name": "en_US-joe-medium",     "language": "en_US", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx"},
    {"name": "en_US-lessac-medium",  "language": "en_US", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"},
    {"name": "en_US-ryan-high",      "language": "en_US", "quality": "high",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx"},
    {"name": "en_GB-alba-medium",    "language": "en_GB", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx"},
    {"name": "en_GB-semaine-medium", "language": "en_GB", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/semaine/medium/en_GB-semaine-medium.onnx"},
    {"name": "de_DE-thorsten-medium","language": "de_DE", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx"},
    {"name": "fr_FR-upmc-medium",    "language": "fr_FR", "quality": "medium",
     "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx"},
]


def _piper_available() -> bool:
    try:
        result = subprocess.run(["piper", "--version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def _espeak_available() -> bool:
    try:
        result = subprocess.run(["espeak", "--version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def _make_silent_wav(duration_ms: int = 500, sample_rate: int = 22050) -> bytes:
    num_samples = int(sample_rate * duration_ms / 1000)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * num_samples, *([0] * num_samples)))
    return buf.getvalue()


@app.get("/health")
async def health():
    piper_ok = _piper_available()
    return {
        "status": "healthy",
        "service": "piper-tts",
        "piper_available": piper_ok,
        "espeak_available": _espeak_available(),
        "voices_available": len(DEFAULT_VOICES),
    }


@app.get("/voices")
async def voices():
    return {"voices": DEFAULT_VOICES}


class SynthesizeRequest(BaseModel):
    text: str
    voice: Optional[str] = "en_US-amy-medium"
    speed: Optional[float] = 1.0


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    voice_used = req.voice or "en_US-amy-medium"

    if _piper_available():
        try:
            onnx_path = os.path.expanduser(f"~/piper-voices/{voice_used}.onnx")
            if not os.path.exists(onnx_path):
                onnx_path = voice_used
            proc = subprocess.run(
                ["piper", "--model", onnx_path, "--output_raw"],
                input=req.text.encode(),
                capture_output=True,
                timeout=30,
            )
            if proc.returncode == 0 and proc.stdout:
                raw_pcm = proc.stdout
                buf = io.BytesIO()
                with wave.open(buf, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(22050)
                    wf.writeframes(raw_pcm)
                audio_b64 = base64.b64encode(buf.getvalue()).decode()
                return {
                    "status": "ok",
                    "audio_base64": audio_b64,
                    "format": "wav",
                    "sample_rate": 22050,
                    "voice_used": voice_used,
                    "engine": "piper",
                }
        except Exception as e:
            pass

    if _espeak_available():
        try:
            proc = subprocess.run(
                ["espeak", "-v", "en", "-s", str(int(150 * (req.speed or 1.0))),
                 "--stdout", req.text],
                capture_output=True,
                timeout=30,
            )
            if proc.returncode == 0 and proc.stdout:
                audio_b64 = base64.b64encode(proc.stdout).decode()
                return {
                    "status": "ok",
                    "audio_base64": audio_b64,
                    "format": "wav",
                    "sample_rate": 22050,
                    "voice_used": "espeak-en",
                    "engine": "espeak",
                }
        except Exception as e:
            pass

    silent = _make_silent_wav()
    return {
        "status": "stub",
        "audio_base64": base64.b64encode(silent).decode(),
        "format": "wav",
        "sample_rate": 22050,
        "voice_used": "silent-stub",
        "engine": "none",
        "message": "Neither piper nor espeak is installed. Install piper-tts: pip install piper-tts",
    }


class DownloadVoiceRequest(BaseModel):
    voice: str


@app.post("/download-voice")
async def download_voice(req: DownloadVoiceRequest):
    voice = next((v for v in DEFAULT_VOICES if v["name"] == req.voice), None)
    if not voice:
        return {"status": "error", "message": f"Unknown voice: {req.voice}"}
    return {
        "status": "ok",
        "voice": req.voice,
        "onnx_url": voice["url"],
        "config_url": voice["url"].replace(".onnx", ".onnx.json"),
        "instructions": f"wget {voice['url']} -O ~/piper-voices/{req.voice}.onnx",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8006)
