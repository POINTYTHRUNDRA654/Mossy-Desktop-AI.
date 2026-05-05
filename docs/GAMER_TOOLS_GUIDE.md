# Mossy Gamer Tools — Setup & Usage Guide

## Overview

Mossy Gamer Tools adds 11 specialized tools for game modders, indie developers, and power users.

| Tool | Route | Service | Port |
|---|---|---|---|
| Gamer Hub | `/gamer-hub` | — | — |
| Script Forge | `/game-scripts` | Ollama | 11434 |
| Game Vision | `/game-vision` | opencv_service | 8005 |
| Steam Library | `/steam` | Steam Web API | — |
| Mod Browser | `/mod-browser` | Nexus Mods API | — |
| Load Order | `/load-order` | LOOT CLI | — |
| Blender Forge | `/blender-forge` | Ollama / Gemma | — |
| Godot Forge | `/godot-forge` | Ollama / Gemma | — |
| Map Forge | `/map-forge` | Built-in | — |
| 3D Asset Forge | `/asset-forge` | triposr_service | 8007 |
| Voice Forge | `/voice-forge` | rvc_service | 8008 |

---

## 1. Script Forge & Blender/Godot Forge (Ollama)

**Requires:** Ollama running locally.

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull DeepSeek Coder V2
ollama pull deepseek-coder-v2

# Start Ollama (runs on port 11434)
ollama serve
```

**Supported languages:** Papyrus, Lua, GDScript, Python (bpy), AutoHotkey, C# (Unity)

---

## 2. Game Vision (OpenCV Vision Service — Port 8005)

**Requires:** Python with OpenCV, mss, and optionally pytesseract.

```bash
pip install opencv-python mss pytesseract scikit-image Pillow

# Optional: Install Tesseract OCR engine for text extraction
# Windows: https://github.com/UB-Mannheim/tesseract/wiki
# Linux:   sudo apt install tesseract-ocr
# macOS:   brew install tesseract
```

The service starts automatically when you use Game Vision. It runs at `http://127.0.0.1:8005`.

**Endpoints:**
- `GET /health` — service status + OpenCV version
- `POST /screenshot` — captures screen (with optional region)
- `POST /analyze-hud` — detects colored health/mana/stamina bars
- `POST /ocr-text` — extracts visible text via Tesseract
- `POST /compare-images` — structural similarity score 0–1
- `POST /detect-game-state` — estimates menu/gameplay/cutscene/loading

---

## 3. Steam Library (Steam Web API)

**Requires:** A Steam API key and your 64-bit Steam ID.

1. Get your API key: https://steamcommunity.com/dev/apikey
2. Find your 64-bit Steam ID: https://steamid.io/
3. Enter both in the Steam Library panel — they're saved to `localStorage`.

No backend service needed — requests go directly from the Electron main process.

---

## 4. Mod Browser (Nexus Mods API)

**Requires:** A Nexus Mods API key (free account).

1. Log in to https://www.nexusmods.com/
2. Go to **Users → My Account → API Keys**
3. Generate a **Personal API Key**
4. Paste it into the Mod Browser panel

Supported games: Skyrim SE, Fallout 4, Fallout New Vegas, Cyberpunk 2077, Baldur's Gate 3, Starfield.

---

## 5. Load Order Analyzer (LOOT)

**Requires:** LOOT installed on your system.

```
# Windows
winget install LOOT.LOOT
# Default path: C:\Program Files\LOOT\LOOT.exe

# Linux
sudo snap install loot
```

Set the LOOT executable path in the panel. The AI explanation uses Gemma (or the active AI provider).

**Supported games:** TES5 (Skyrim LE), SSE (Skyrim SE), FO3, FNV, FO4, FO4VR, TES5VR

---

## 6. Map Forge

No external services required. Generates Tiled-compatible JSON maps client-side using a procedural dungeon algorithm.

**To use the output:**
1. Install Tiled: https://www.mapeditor.org/
2. Open the downloaded `.json` file in Tiled
3. Assign your tileset to replace the `.tsx` reference

---

## 7. 3D Asset Forge (TripoSR — Port 8007)

**Requires:** TripoSR (optional — a stub cube is returned if not installed).

```bash
# Install TripoSR
pip install git+https://github.com/VAST-AI-Research/TripoSR.git

# Install trimesh for mesh export
pip install trimesh

# CUDA GPU strongly recommended for inference
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

**Tips:**
- Images with a single object on a clean/white background produce the best results
- Resolution 128 is a good balance of quality vs speed
- Output OBJ files can be opened directly in Blender via File → Import → Wavefront (.obj)

**Output directory:** `python/data/triposr_outputs/`

---

## 8. Voice Forge (RVC — Port 8008)

**Requires:** RVC (optional — stub audio is returned if not installed).

```bash
# Install RVC
pip install git+https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git

# Install audio libraries
pip install soundfile librosa
```

**Model files:**
- Place `.pth` model files in `~/RVC_models/` (Linux/macOS) or `D:/RVC_models/` (Windows)
- The service scans these directories on startup

**Pretrained models:** Download from Hugging Face — search for "RVC pretrained models"

---

## Port Reference

| Port | Service | Script |
|------|---------|--------|
| 8000 | Gemma AI | `gemma_service_enhanced.py` |
| 8001 | PyTorch | `pytorch_service.py` |
| 8002 | Whisper STT | `whisper_service.py` |
| 8003 | ChromaDB | `chroma_service.py` |
| 8004 | Agent Collaboration | `agent_collaboration_service.py` |
| 8005 | OpenCV Vision | `opencv_service.py` |
| 8006 | Piper TTS | `piper_service.py` |
| 8007 | TripoSR 3D | `triposr_service.py` |
| 8008 | RVC Voice | `rvc_service.py` |
| 11434 | Ollama | (external) |

---

## Quick Start Commands

```bash
# Install all gamer tool dependencies at once
pip install opencv-python mss pytesseract scikit-image piper-tts trimesh soundfile librosa

# Optional heavy installs
pip install git+https://github.com/VAST-AI-Research/TripoSR.git
pip install git+https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git

# Start Ollama for script generation
ollama serve &
ollama pull deepseek-coder-v2
```

---

## Troubleshooting

### "Service Offline" badge showing
The Python service starts automatically on first use. If it stays offline:
1. Check the Electron DevTools console for errors
2. Try running the service manually: `python python/opencv_service.py`
3. Check if the port is already in use: `lsof -i :8005`

### Steam API returns empty
- Ensure your Steam profile is **public** (not private)
- Double-check your 64-bit Steam ID (not the vanity URL)

### Nexus search returns no results
- The search API may have rate limits — wait a minute and try again
- Verify your API key at https://www.nexusmods.com/users/myaccount

### LOOT path not found
- On Windows, LOOT is typically at `C:\Program Files\LOOT\LOOT.exe`
- Try running LOOT manually first to ensure it's set up for your game

### TripoSR returns stub cube
- TripoSR is not installed — see installation steps above
- After installing, restart the app to reload the service

---

## Links

- [LOOT](https://loot.github.io/)
- [Tiled Map Editor](https://www.mapeditor.org/)
- [TripoSR](https://github.com/VAST-AI-Research/TripoSR)
- [RVC Project](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
- [Piper TTS](https://github.com/rhasspy/piper)
- [Ollama](https://ollama.ai/)
- [Steam Web API](https://developer.valvesoftware.com/wiki/Steam_Web_API)
- [Nexus Mods API](https://app.swaggerhub.com/apis-docs/NexusMods/nexus-mods_public_api/1.0)
