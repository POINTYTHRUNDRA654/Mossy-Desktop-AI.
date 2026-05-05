"""
Real-ESRGAN Texture Upscaling Service — port 8009
Upscales game textures 2×–4× using AI super-resolution.

GitHub:      https://github.com/xinntao/Real-ESRGAN
HuggingFace: https://huggingface.co/nateraw/real-esrgan (RealESRGAN_x4.pth)
             https://huggingface.co/models?search=esrgan

Install:
    pip install realesrgan basicsr facexlib gfpgan
    pip install huggingface_hub   # for automatic model download
"""
import base64
import io
import os
import time
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# ── Optional dependencies ─────────────────────────────────────────────────
try:
    import torch
    TORCH_AVAILABLE = True
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
except ImportError:
    TORCH_AVAILABLE = False
    DEVICE = "cpu"

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    REALESRGAN_AVAILABLE = True
except ImportError:
    REALESRGAN_AVAILABLE = False

try:
    from huggingface_hub import hf_hub_download
    HF_HUB_AVAILABLE = True
except ImportError:
    HF_HUB_AVAILABLE = False

# ── Model cache ───────────────────────────────────────────────────────────
MODELS_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "esrgan_models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

_upsampler_cache: dict = {}

# ── Known Real-ESRGAN model configs ───────────────────────────────────────
MODEL_CONFIGS = {
    "RealESRGAN_x4plus": {
        "scale": 4,
        "hf_repo": "nateraw/real-esrgan",
        "hf_file": "RealESRGAN_x4plus.pth",
        "description": "Universal 4× upscaling (photos & textures)",
    },
    "RealESRGAN_x2plus": {
        "scale": 2,
        "hf_repo": "nateraw/real-esrgan",
        "hf_file": "RealESRGAN_x2plus.pth",
        "description": "2× upscaling — faster, less VRAM",
    },
    "RealESRGAN_x4plus_anime_6B": {
        "scale": 4,
        "hf_repo": "nateraw/real-esrgan",
        "hf_file": "RealESRGAN_x4plus_anime_6B.pth",
        "description": "4× anime-style art & cartoon textures",
    },
}


def _load_upsampler(model_name: str = "RealESRGAN_x4plus"):
    """Load or retrieve cached Real-ESRGAN upsampler."""
    if model_name in _upsampler_cache:
        return _upsampler_cache[model_name]

    if not REALESRGAN_AVAILABLE:
        return None

    cfg = MODEL_CONFIGS.get(model_name, MODEL_CONFIGS["RealESRGAN_x4plus"])
    model_path = MODELS_DIR / cfg["hf_file"]

    # Auto-download from HuggingFace if model not present
    if not model_path.exists():
        if HF_HUB_AVAILABLE:
            try:
                downloaded = hf_hub_download(
                    repo_id=cfg["hf_repo"],
                    filename=cfg["hf_file"],
                    local_dir=str(MODELS_DIR),
                )
                model_path = Path(downloaded)
            except Exception:
                return None
        else:
            return None

    try:
        scale = cfg["scale"]
        # RRDBNet architecture for x4plus (23 blocks) vs anime_6B (6 blocks)
        num_block = 6 if "anime_6B" in model_name else 23
        model = RRDBNet(
            num_in_ch=3, num_out_ch=3, num_feat=64,
            num_block=num_block, num_grow_ch=32, scale=scale,
        )
        upsampler = RealESRGANer(
            scale=scale,
            model_path=str(model_path),
            model=model,
            tile=512,          # tile size to avoid OOM on large textures
            tile_pad=10,
            pre_pad=0,
            half=TORCH_AVAILABLE and torch.cuda.is_available(),  # fp16 on GPU
            device=torch.device(DEVICE) if TORCH_AVAILABLE else None,
        )
        _upsampler_cache[model_name] = upsampler
        return upsampler
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "esrgan-upscaler",
        "realesrgan_available": REALESRGAN_AVAILABLE,
        "torch_available": TORCH_AVAILABLE,
        "hf_hub_available": HF_HUB_AVAILABLE,
        "device": DEVICE,
        "models_dir": str(MODELS_DIR),
        "github": "https://github.com/xinntao/Real-ESRGAN",
        "huggingface": "https://huggingface.co/nateraw/real-esrgan",
    }


@app.get("/models")
async def list_models():
    models_with_status = []
    for name, cfg in MODEL_CONFIGS.items():
        model_path = MODELS_DIR / cfg["hf_file"]
        models_with_status.append({
            "name": name,
            "scale": cfg["scale"],
            "description": cfg["description"],
            "downloaded": model_path.exists(),
            "hf_repo": cfg["hf_repo"],
            "hf_file": cfg["hf_file"],
        })
    return {"models": models_with_status}


class UpscaleRequest(BaseModel):
    image_base64: str
    model: Optional[str] = "RealESRGAN_x4plus"
    scale: Optional[int] = 4  # 2 or 4
    output_format: Optional[str] = "PNG"  # PNG or JPEG


@app.post("/upscale")
async def upscale_texture(req: UpscaleRequest):
    """
    Upscale a game texture using Real-ESRGAN.
    Input/output are base64-encoded images.
    Models auto-downloaded from HuggingFace on first use.
    """
    if not PIL_AVAILABLE:
        return {"status": "unavailable", "message": "Pillow not installed. Run: pip install Pillow"}

    if not REALESRGAN_AVAILABLE:
        return {
            "status": "unavailable",
            "message": "Real-ESRGAN not installed. Run: pip install realesrgan basicsr facexlib gfpgan",
            "github": "https://github.com/xinntao/Real-ESRGAN",
            "huggingface": "https://huggingface.co/nateraw/real-esrgan",
        }

    try:
        # Decode input image
        img_data = base64.b64decode(req.image_base64)
        pil_img = Image.open(io.BytesIO(img_data)).convert("RGB")
        original_size = pil_img.size

        import numpy as np
        img_np = np.array(pil_img)

        model_name = req.model or "RealESRGAN_x4plus"
        upsampler = _load_upsampler(model_name)
        if upsampler is None:
            return {
                "status": "error",
                "message": f"Failed to load model '{model_name}'. Check that the model file exists or HuggingFace is reachable.",
            }

        start = time.time()
        output, _ = upsampler.enhance(img_np, outscale=req.scale or 4)
        elapsed = round(time.time() - start, 2)

        # Encode output
        out_pil = Image.fromarray(output)
        buf = io.BytesIO()
        fmt = (req.output_format or "PNG").upper()
        out_pil.save(buf, format=fmt)
        out_b64 = base64.b64encode(buf.getvalue()).decode()

        return {
            "status": "ok",
            "image_base64": out_b64,
            "format": fmt,
            "original_size": {"w": original_size[0], "h": original_size[1]},
            "upscaled_size": {"w": out_pil.width, "h": out_pil.height},
            "scale_used": req.scale or 4,
            "model_used": model_name,
            "processing_time_sec": elapsed,
            "device": DEVICE,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


class BatchUpscaleRequest(BaseModel):
    images: list  # list of {name: str, image_base64: str}
    model: Optional[str] = "RealESRGAN_x4plus"
    scale: Optional[int] = 4
    output_format: Optional[str] = "PNG"


@app.post("/upscale-batch")
async def upscale_batch(req: BatchUpscaleRequest):
    """Batch-upscale multiple textures in one request."""
    results = []
    for item in req.images:
        single = UpscaleRequest(
            image_base64=item.get("image_base64", ""),
            model=req.model,
            scale=req.scale,
            output_format=req.output_format,
        )
        result = await upscale_texture(single)
        results.append({"name": item.get("name", "unknown"), **result})
    return {"status": "ok", "results": results, "count": len(results)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8009)
