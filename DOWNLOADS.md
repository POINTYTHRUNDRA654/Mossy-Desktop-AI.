# Mossy AI Assistant — Complete Downloads & Prerequisites

This document outlines all external tools, models, and frameworks required for full functionality.

---

## 🎯 Quick Summary

| Category | Item | Required? | Download Time |
|----------|------|-----------|----------------|
| **Runtime** | Node.js 18+ | ✅ Yes | 2 min |
| **Runtime** | Python 3.10+ | ✅ Yes | 5 min |
| **Runtime** | Ollama (local AI) | ⭕ Optional | 3 min |
| **Runtime** | NVIDIA GPU Driver | ⭕ Optional (GPU acceleration) | 10-20 min |
| **ML Framework** | PyTorch with CUDA | ⭕ Optional (inference, training) | 3-5 GB / 15 min |
| **Models** | Ollama Models (gemma3, llama3.2) | ⭕ Optional (local LLM) | 2-7 GB / 10-30 min |
| **External API** | Google Gemini API Key | ⭕ Optional (cloud AI) | 1 min |
| **3D Tools** | Blender 4.0+ | ⭕ Optional (3D workflows) | 300 MB / 10 min |
| **3D Tools** | NVIDIA Omniverse Blender Addons | ⭕ Optional (Omniverse rendering) | 50-100 MB / 3 min |
| **3D Tools** | NVIDIA Materializer | ⭕ Optional (AI material gen) | 500 MB - 2 GB / 5-15 min |
| **3D Tools** | NVIDIA ShaderMap4 | ⭕ Optional (shader generation) | 300-500 MB / 5 min |
| **3D Tools** | NVIDIA Texture Tools | ⭕ Optional (texture compression) | 100 MB / 2 min |
| **Image Tools** | Photopea | ⭕ Optional (web image editor) | Browser-based / instant |
| **Image Tools** | ComfyUI | ⭕ Optional (image generation) | 3-5 GB / varies |

---

## 🔴 Required Downloads

### 1. Node.js 18+ (React + Electron)
**Download**: https://nodejs.org/  
**Why**: Builds the desktop app and web interface  
**Size**: ~150 MB  
**Time**: 2-5 minutes  

```bash
# Verify installation
node --version    # Should be v18.0.0+
npm --version     # Should be v9.0.0+
```

### 2. Python 3.10+ (AI Services)
**Download**: https://www.python.org/downloads/  
**Why**: Runs AI microservices (Gemma, Whisper, Chroma, etc.)  
**Size**: ~100 MB  
**Time**: 3-5 minutes  

```bash
# Verify installation
python --version  # Should be 3.10+
pip --version     # Should be v23.0+
```

---

## 🟡 Strongly Recommended Downloads

### 3. Ollama (Local AI Engine)
**Download**: https://ollama.com/  
**Why**: Run LLMs locally without internet or API key  
**Size**: 100 MB (app) + models (2-7 GB each)  
**Time**: 3 min (app) + 10-30 min (model pull)  

**First-time setup**:
```bash
# Install Ollama (follow platform instructions)
# Then pull a model
ollama pull gemma3              # ~4 GB, 10 min
# OR
ollama pull llama3.2            # ~3 GB, 8 min
```

**Why this option**: 
- ✅ Completely private — no data leaves your PC
- ✅ Free forever
- ✅ Works offline
- ✅ Mossy auto-detects and uses it

### 4. NVIDIA GPU Driver (GPU Acceleration)
**Download**: https://www.nvidia.com/Download/driverDetails.aspx  
**Why**: Run Ollama/PyTorch on GPU (50-100× faster)  
**Size**: 500 MB - 2 GB (varies by GPU model)  
**Time**: 10-20 minutes  

**Verify installation**:
```bash
nvidia-smi     # Shows GPU, driver version, CUDA version
```

**If you don't have an NVIDIA GPU**: Skip this. Mossy will run on CPU (slower but functional).

### 5. PyTorch with CUDA 12.1 (Model Inference & Fine-Tuning)
**Download**: https://pytorch.org/  
**Why**: GPU-accelerated ML operations (inference, training)  
**Size**: 3-5 GB  
**Time**: 15-30 minutes  

**Installation**:
```bash
# Windows with NVIDIA GPU (CUDA 12.1)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Mac (CPU only)
pip install torch torchvision torchaudio

# Linux (CPU)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

**Verify**:
```bash
python -c "import torch; print(torch.cuda.is_available())"  # Should print True (GPU) or False (CPU)
```

---

## 🔵 Optional Downloads (Additional Features)

### 6. Blender 4.0+ (3D Workflows)
**Download**: https://www.blender.org/download/  
**Why**: Generate Python scripts for Blender automation  
**Size**: 250-300 MB  
**Time**: 5-10 minutes  

**Features Unlocked**:
- ✅ BlenderForge component
- ✅ Standard Blender script generation
- ✅ NVIDIA Omniverse addon support

### 7. Google Gemini API Key (Cloud AI Alternative)
**Get**: https://aistudio.google.com/app/apikey  
**Why**: Use Google's Gemini 2.0 Flash model in cloud  
**Cost**: Free tier (1,500 requests/day)  
**Time**: 1 minute  

**Features**:
- ✅ Better reasoning than local models
- ✅ Image generation support
- ✅ Live voice support (premium)

### 8. ComfyUI (Stable Diffusion Image Generation)
**Download/Clone**: https://github.com/comfyanonymous/ComfyUI  
**Why**: Generate images from text prompts  
**Size**: 3-5 GB (+ model files)  
**Time**: 30-60 minutes  

```bash
# Clone repository
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
# Then start: python main.py
```

### 9. NVIDIA Texture Tools (Texture Compression)
**Download**: https://developer.nvidia.com/texture-tools  
**Why**: GPU-accelerated texture compression (BC1-7, ASTC)  
**Size**: 100 MB  
**Time**: 2-5 minutes  

**Installation**:
```bash
# Windows: Download installer → run
# Extract to: D:\NVIDIA Texture Tools  (or your preferred location)
```

**Features**:
- ✅ TextureToolsEditor component
- ✅ Real-time compression feedback
- ✅ Multiple format support

### 10. NVIDIA Materializer (AI Material Generation)
**Download**: Request from NVIDIA Omniverse  
**Why**: AI-powered texture and material generation  
**Size**: 500 MB - 2 GB  
**Time**: 5-15 minutes  

**Installation**:
```bash
# Extract to: F:\Materialize_1.78  (or your preferred location)
```

**Features**:
- ✅ MaterializerEditor component
- ✅ AI-powered material workflows
- ✅ Texture generation from images

### 10.5 NVIDIA ShaderMap4 (Shader Generation)
**Download**: https://www.allegorithmic.com/products/shadermap  
**Why**: Generate normal maps, PBR textures, and procedural shaders  
**Size**: 300-500 MB  
**Time**: 3-5 minutes  

**Installation**:
```bash
# Windows: Download installer → run
# Extract/install to: C:\Program Files\ShaderMap4  (or your preferred location)
```

**Features**:
- ✅ ShaderMap4Editor component
- ✅ Real-time normal map generation
- ✅ PBR texture baking
- ✅ Procedural shader generation

### 10.75 Photopea (Web-Based Image Editor)
**Access**: https://www.photopea.com/  
**Why**: Browser-based Photoshop alternative for image editing  
**Size**: 0 MB (web-based)  
**Time**: Instant (browser)  

**Features**:
- ✅ PhotopeaEditor component
- ✅ Full PSD/PSB support
- ✅ AI-powered upscaling
- ✅ Layer blending and effects
- ✅ Works offline with browser storage

**Note**: Can be used directly in browser or embedded in Mossy

### 11. NVIDIA Omniverse Blender Addons
**Clone**: https://github.com/NVIDIA-Omniverse/blender_omniverse_addons  
**Why**: Professional 3D rendering and material workflows  
**Size**: 50-100 MB  
**Time**: 2-5 minutes  

```bash
# Clone to Mossy directory
git clone https://github.com/NVIDIA-Omniverse/blender_omniverse_addons.git
```

**Addons Included**:
- `omni_panel` - Material conversion, particle baking
- `omni_audio2face` - Character animation prep
- `omni_optimization_panel` - Scene optimization

### 12. Anaconda (Python Environment Management)
**Download**: https://www.anaconda.com/download  
**Why**: Manage multiple Python versions and environments  
**Size**: 500 MB  
**Time**: 5-10 minutes  

**Optional** — only needed if you want separate Python environments for different projects.

### 13. Docker (Containerization)
**Download**: https://www.docker.com/products/docker-desktop/  
**Why**: Run services in isolated containers  
**Size**: 500 MB - 2 GB  
**Time**: 5-10 minutes  

**Optional** — only needed for advanced deployment scenarios.

---

## 📦 Python Package Dependencies

All Python packages are listed in `python/requirements.txt`:

### Core ML Stack
```
torch>=2.2.0                    # PyTorch
torchvision>=0.17.0            # Computer vision
torchaudio>=2.2.0              # Audio processing
transformers>=4.40.0           # HuggingFace models
unsloth>=2024.3                # 2× faster fine-tuning
peft>=0.10.0                   # Parameter-efficient fine-tuning
```

### AI Services
```
fastapi>=0.111.0               # Web service framework
uvicorn[standard]>=0.29.0      # ASGI server
langchain>=0.2.0               # LLM orchestration
langgraph>=0.1.0               # Multi-agent workflows
llama-index>=0.10.0            # RAG framework
chromadb>=0.5.0                # Vector database
sentence-transformers>=3.0.0   # Embeddings
```

### Speech & Audio
```
faster-whisper>=1.0.0          # Speech-to-text (99 languages)
librosa>=0.10.0                # Audio analysis
piper-tts>=1.2.0               # Text-to-speech
```

### Computer Vision
```
opencv-python>=4.9.0           # Image processing
ultralytics>=8.2.0             # YOLOv8 object detection
realesrgan>=0.3.0              # Image upscaling
gfpgan>=1.3.8                  # Face enhancement
```

### Game Tools
```
mss>=9.0.0                     # Screenshot capture
pytesseract>=0.3.10            # OCR (game HUD text)
scikit-image>=0.22.0           # Image similarity
```

### 3D & Mesh
```
trimesh>=4.3.0                 # 3D mesh manipulation
```

**Total installation**: ~40 packages, 10-20 minutes (first run)

---

## 🚀 Installation Workflow

### Step 1: Required Software (20-30 minutes)
```bash
# 1. Install Node.js 18+
# 2. Install Python 3.10+
# 3. Clone or download Mossy

cd d:\Mossy\Mossy-Desktop-AI
```

### Step 2: Install Dependencies (10-20 minutes)
```bash
# Install JavaScript dependencies
npm install

# Install Python dependencies
cd python
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
cd ..
```

### Step 3: Start Application
```bash
# Development mode
npm run electron:dev

# OR production build
npm run electron:build
```

### Step 4: Optional — Install Extra Tools (30-60 minutes)
```bash
# Install Ollama + model
# https://ollama.com → download → run

# Optional: Install Blender, ComfyUI, etc. as needed
```

---

## 🔍 Verification Checklist

After installation, verify everything is working:

### ✅ Node.js & npm
```bash
node --version     # Should be v18.0.0+
npm --version      # Should be v9.0.0+
npm list           # Shows installed packages
```

### ✅ Python & PyTorch
```bash
python --version   # Should be 3.10+
python -c "import torch; print(torch.cuda.is_available())"  # GPU support
python -c "import numpy; print('NumPy OK')"
python -c "import transformers; print('Transformers OK')"
```

### ✅ Ollama (if installed)
```bash
ollama list        # Shows downloaded models
```

### ✅ NVIDIA Tools (if installed)
```bash
# Test Materializer
F:\Materialize_1.78\Materialize.exe --version

# Test Texture Tools
D:\NVIDIA Texture Tools\nvcompress.exe --help
```

### ✅ GPU Support
```bash
nvidia-smi         # Shows GPU model, driver, CUDA version
```

---

## ❌ Troubleshooting Downloads

### "pip install torch" fails
**Solution**: Use the correct index for your GPU:
```bash
# NVIDIA CUDA 12.1 (RTX 30xx, 40xx)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CPU only
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### "ollama pull gemma3" timeout
**Solution**: Check internet and disk space:
```bash
# Check connectivity
ping ollama.com

# Check disk space (need 5+ GB free)
df -h  (Mac/Linux)
dir C:  (Windows)

# Try smaller model
ollama pull gemma3:1b  # Lightweight version
```

### "npm install" fails
**Solution**: Clear cache and retry:
```bash
npm cache clean --force
npm install
```

### Models won't download
**Solution**: Check firewall and proxy:
```bash
# Test HuggingFace connectivity
python -c "from huggingface_hub import list_repo_files; print('OK')"

# If behind proxy, set environment:
set HTTP_PROXY=your_proxy_url
set HTTPS_PROXY=your_proxy_url
```

### GPU not detected
**Solution**: Verify driver and CUDA:
```bash
nvidia-smi          # Should show GPU model
python -c "import torch; print(torch.cuda.is_available())"  # Should be True
python -c "import torch; print(torch.cuda.get_device_name(0))"  # GPU name
```

---

## 📊 Typical Installation Sizes

| Component | Size | Time |
|-----------|------|------|
| Node.js | 150 MB | 3 min |
| Python 3.10+ | 100 MB | 3 min |
| npm packages | 500 MB - 1 GB | 5-10 min |
| Python packages | 2-5 GB | 10-20 min |
| PyTorch (CPU) | 500 MB | 5 min |
| PyTorch (GPU/CUDA) | 2-3 GB | 10-15 min |
| Ollama (app) | 100 MB | 2 min |
| Ollama gemma3 model | 4 GB | 10-15 min |
| Ollama llama3.2 model | 3 GB | 8-12 min |
| Blender 4.2 | 300 MB | 10 min |
| **Total (minimal)** | **~1-2 GB** | **20-30 min** |
| **Total (full setup)** | **~10-15 GB** | **60-90 min** |

---

## 🔗 All Download Links

### Essential
- **Node.js**: https://nodejs.org/
- **Python**: https://www.python.org/downloads/
- **Mossy Source**: https://github.com/POINTYTHRUNDRA654/Mossy-Desktop-AI

### AI & ML
- **Ollama**: https://ollama.com/
- **Ollama Models**: https://ollama.com/library
- **PyTorch**: https://pytorch.org/
- **Google Gemini API**: https://aistudio.google.com/app/apikey

### 3D & Graphics
- **Blender**: https://www.blender.org/download/
- **ComfyUI**: https://github.com/comfyanonymous/ComfyUI
- **NVIDIA Texture Tools**: https://developer.nvidia.com/texture-tools
- **NVIDIA Omniverse**: https://www.nvidia.com/en-us/omniverse/

### Drivers & Tools
- **NVIDIA GPU Driver**: https://www.nvidia.com/Download/driverDetails.aspx
- **Anaconda**: https://www.anaconda.com/download
- **Docker**: https://www.docker.com/products/docker-desktop/
- **Git**: https://git-scm.com/download

---

## 📝 Notes

- **All downloads are optional except Node.js and Python** — you can run Mossy with minimal setup
- **First run of services is slow** — models auto-download the first time you use them
- **GPU acceleration requires NVIDIA GPU + driver** — CPU-only mode is supported
- **Internet required for**: Ollama model download, Gemini API, HuggingFace models
- **Internet NOT required if using**: Local Ollama models, PyTorch inference, all other offline features

---

**Last Updated**: May 7, 2026  
**Status**: ✅ Complete and verified
