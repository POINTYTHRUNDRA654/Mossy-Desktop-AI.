"""
OpenCV Vision Service — port 8005
Game screen analysis: screenshots, HUD detection, OCR, game state detection.
"""
import base64
import io
import json
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import mss
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    from skimage.metrics import structural_similarity as ssim
    SKIMAGE_AVAILABLE = True
except ImportError:
    SKIMAGE_AVAILABLE = False

from PIL import Image


def decode_image(b64_str: str):
    data = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    if CV2_AVAILABLE:
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    return np.array(img)


def encode_image(img_array) -> str:
    if CV2_AVAILABLE:
        _, buf = cv2.imencode(".png", img_array)
        return base64.b64encode(buf.tobytes()).decode()
    pil = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@app.get("/health")
async def health():
    cv_ver = cv2.__version__ if CV2_AVAILABLE else "unavailable"
    return {
        "status": "healthy",
        "service": "opencv-vision",
        "opencv_version": cv_ver,
        "mss_available": MSS_AVAILABLE,
        "tesseract_available": TESSERACT_AVAILABLE,
    }


class RegionModel(BaseModel):
    x: int = 0
    y: int = 0
    w: int = 1920
    h: int = 1080


class ScreenshotRequest(BaseModel):
    region: Optional[RegionModel] = None


@app.post("/screenshot")
async def screenshot(req: ScreenshotRequest):
    if not MSS_AVAILABLE:
        return {"status": "unavailable", "message": "mss not installed. Run: pip install mss"}
    try:
        with mss.mss() as sct:
            mon = req.region
            monitor = {
                "top": mon.y if mon else 0,
                "left": mon.x if mon else 0,
                "width": mon.w if mon else sct.monitors[1]["width"],
                "height": mon.h if mon else sct.monitors[1]["height"],
            }
            shot = sct.grab(monitor)
            img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {
                "status": "ok",
                "image_base64": b64,
                "width": shot.width,
                "height": shot.height,
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


class ImageRequest(BaseModel):
    image_base64: str


@app.post("/analyze-hud")
async def analyze_hud(req: ImageRequest):
    if not CV2_AVAILABLE:
        return {"status": "unavailable", "message": "opencv-python not installed"}
    try:
        img = decode_image(req.image_base64)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        color_ranges = {
            "health": ([0, 100, 100], [10, 255, 255]),
            "mana":   ([100, 100, 100], [130, 255, 255]),
            "stamina": ([35, 100, 100], [85, 255, 255]),
            "xp":     ([20, 100, 100], [35, 255, 255]),
        }

        elements = []
        for bar_type, (low, high) in color_ranges.items():
            mask = cv2.inRange(hsv, np.array(low), np.array(high))
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 200:
                    continue
                x, y, w, h = cv2.boundingRect(cnt)
                aspect = w / max(h, 1)
                if aspect < 3:
                    continue
                elements.append({
                    "type": bar_type,
                    "bounds": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                    "color": bar_type,
                    "value": round(min(w / img.shape[1] * 100, 100), 1),
                })

        return {"status": "ok", "elements": elements}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/ocr-text")
async def ocr_text(req: ImageRequest):
    if not CV2_AVAILABLE:
        return {"status": "unavailable", "message": "opencv-python not installed"}
    try:
        img = decode_image(req.image_base64)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        if TESSERACT_AVAILABLE:
            pil_img = Image.fromarray(thresh)
            text = pytesseract.image_to_string(pil_img)
            return {"status": "ok", "text": text.strip(), "engine": "tesseract"}
        else:
            return {
                "status": "stub",
                "text": "[pytesseract not installed — run: pip install pytesseract]",
                "engine": "none",
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


class CompareRequest(BaseModel):
    image_a_base64: str
    image_b_base64: str


@app.post("/compare-images")
async def compare_images(req: CompareRequest):
    if not CV2_AVAILABLE:
        return {"status": "unavailable", "message": "opencv-python not installed"}
    try:
        img_a = decode_image(req.image_a_base64)
        img_b = decode_image(req.image_b_base64)

        h = min(img_a.shape[0], img_b.shape[0])
        w = min(img_a.shape[1], img_b.shape[1])
        img_a = cv2.resize(img_a, (w, h))
        img_b = cv2.resize(img_b, (w, h))

        gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY)

        if SKIMAGE_AVAILABLE:
            score, _ = ssim(gray_a, gray_b, full=True)
        else:
            diff = cv2.absdiff(gray_a, gray_b)
            score = 1.0 - (float(diff.mean()) / 255.0)

        return {"status": "ok", "similarity": round(float(score), 4)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class GameStateRequest(BaseModel):
    image_base64: str
    game: Optional[str] = None


@app.post("/detect-game-state")
async def detect_game_state(req: GameStateRequest):
    if not CV2_AVAILABLE:
        return {"status": "unavailable", "message": "opencv-python not installed"}
    try:
        img = decode_image(req.image_base64)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        brightness = float(hsv[:, :, 2].mean())
        saturation = float(hsv[:, :, 1].mean())

        hist = cv2.calcHist([hsv], [0], None, [8], [0, 180])
        hist = hist.flatten() / hist.sum()
        dominant_colors = [{"hue_bin": int(i * 22.5), "weight": round(float(v), 3)} for i, v in enumerate(hist)]
        dominant_colors.sort(key=lambda x: x["weight"], reverse=True)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(edges.mean()) / 255.0

        if brightness < 30:
            state = "loading"
        elif edge_density < 0.02 and saturation < 20:
            state = "menu"
        elif edge_density > 0.15:
            state = "gameplay"
        elif saturation < 30:
            state = "cutscene"
        else:
            state = "gameplay"

        return {
            "status": "ok",
            "brightness": round(brightness, 2),
            "saturation": round(saturation, 2),
            "dominant_colors": dominant_colors[:5],
            "edge_density": round(edge_density, 4),
            "estimated_state": state,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8005)
