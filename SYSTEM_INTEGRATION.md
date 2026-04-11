# Mossy System Integration Guide

**Mossy's. Desktop AIS, New Brain** integrates with all AI and development tools on your system.

## 🎮 Detected Tools on Your System

### GPU & CUDA
✅ **NVIDIA RTX GPU** (Compute Capability 7.5)
- Driver: 591.86
- CUDA Versions: 12.8, 12.9, 13.0, 13.1, 13.2
- cuDNN: Version 9
- Full NVIDIA Texture Tools suite

### AI Frameworks
✅ **Gemma 4** - Fine-tuning with LoRA (local, 8GB-16GB VRAM)
✅ **PyTorch** (D:\PyTorch) - Deep learning inference  
✅ **ComfyUI/Stable Diffusion** - Image generation
✅ **Ollama** - Local LLM inference (alternative)

### Development Stack
✅ **Node.js** - Frontend development
✅ **Git** - Version control
✅ **Docker Desktop** - Containerization
✅ **Java Development Kit 23**
✅ **.NET SDK 9.0** - C# development
✅ **Visual Studio 2022** - IDE
✅ **Anaconda/miniconda** - Python environment management

## 🚀 Integration Features

### 1. **Gemma 4 Fine-Tuning** (Port 8000)
**What it does**: Train custom LLM adapters with LoRA
```
Service: python/gemma_service.py
IPC Handlers:
  - gemma:health-check
  - gemma:start-fine-tune
  - gemma:fine-tune-status
  - gemma:run-inference
  - gemma:list-models
  - gemma:load-model
```

### 2. **PyTorch Inference Engine** (Port 8001)
**What it does**: Load and run custom PyTorch models
```
Service: python/pytorch_service.py
IPC Handlers:
  - pytorch:health-check
  - pytorch:load-model
  - pytorch:infer
  - pytorch:list-loaded-models
  - pytorch:discover-models
  - pytorch:system-info
```

**Supports**:
- Classification models
- Image segmentation
- Object detection
- Custom architectures
- Checkpoint loading (.pt, .pth, .ckpt)

### 3. **ComfyUI Image Generation** (Auto-detect)
**What it does**: Generate images via Stable Diffusion UI

```
IPC Handlers:
  - comfyui:health-check
  - comfyui:generate-image
  - comfyui:list-models
```

**Setup**:
1. Launch ComfyUI from C:\Users\{user}\AppData\Roaming\ComfyUI or D:\ComfyUI
2. Default endpoint: `http://127.0.0.1:8188` (auto-detected)
3. Mossy will connect automatically

### 4. **System Tools Discovery**
**What it does**: Auto-detect all installed development tools

```
IPC Handler: system:detect-tools

Returns:
{
  gpu: { available, driver, computeCapability, deviceName },
  frameworks: [ { name, path, type } ],
  dockerAvailable: boolean,
  gitAvailable: boolean,
  pythonVersions: [ { path, version, isVenv } ]
}
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────┐
│         Mossy React UI (TypeScript)             │
├─────────────────────────────────────────────────┤
│         Electron IPC Bridge (Node.js)           │
├─────────────────────────────────────────────────┤
│    Python FastAPI Services (Multi-Worker)      │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ Gemma 4  │ PyTorch │ ComfyUI  │  System  │  │
│  │ Port8000 │ Port8001│ Port8188 │  Native  │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
├─────────────────────────────────────────────────┤
│   NVIDIA GPU (CUDA 12.8+) + cuDNN 9             │
└─────────────────────────────────────────────────┘
```

## 🎯 Common Workflows

### Text Generation + Fine-tuning
```
1. Chat with base Gemma 4
2. Collect training examples
3. Fine-tune with ComfyUI dataset
4. Deploy fine-tuned model
5. Chat uses updated model
```

### Image + Text Pipeline
```
1. Generate image prompt with Gemma 4
2. Send to ComfyUI
3. Display result in Mossy
4. Train Gemma to improve prompts
```

### Custom Model Inference
```
1. Place PyTorch model in D:\models
2. Use pytorch:discover-models to find it
3. Load with pytorch:load-model
4. Run inference via pytorch:infer
5. Display results in UI
```

## 💾 File Locations

```
D:\PyTorch/              Custom PyTorch models
D:\models/               Model checkpoint storage
D:\Stable Diffusion/     ComfyUI installations (if present)
D:\Mossy/                Mossy application
C:\Program Files\NVIDIA GPU Computing Toolkit/  CUDA installations
docker                   Docker images/containers
```

## 📝 Configuration

### Environment Variables (Optional)
```bash
# Python services
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512  # Memory management
TORCH_HOME=D:\models                            # Model cache
HF_HOME=C:\Users\{user}\.cache\huggingface     # Hugging Face cache
```

### Service Ports
- **8000**: Gemma 4 fine-tuning service
- **8001**: PyTorch inference service
- **8188**: ComfyUI (auto-detected, configurable)
- **3000**: React dev server
- **11434**: Ollama (if running)

## 🛠️ Troubleshooting

### "Port already in use"
```powershell
# Find process using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# Kill process
Stop-Process -Id <PID> -Force
```

### "PyTorch service won't start"
```bash
cd python
pip install -r requirements.txt --upgrade
# If CUDA issues:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### "ComfyUI not detected"
```bash
# Start ComfyUI manually
cd C:\Users\{user}\AppData\Roaming\ComfyUI
python main.py
```

### "Out of VRAM"
```
Reduce batch size or model size:
- Gemma: Use gemma-2-9b instead of gemma-4-9b
- PyTorch: Use int8 quantization
- ComfyUI: Use lower resolution (512x512)
```

## 📈 Performance Tips

| Task | VRAM | Time | Optimization |
|------|------|------|--------------|
| Gemma 4 Inference | 4GB | <100ms | Already optimized |
| Fine-tune 100 examples | 16GB | 5-10min | Batch size 4, 3 epochs |
| PyTorch inference | 2GB | 50-500ms | Model size dependent |
| Stable Diffusion | 8GB | 20-60s | 512x512, 20 steps |

## 🔄 Updating Tools

### Update Python Packages
```bash
cd python
pip install -r requirements.txt --upgrade
```

### Update CUDA/cuDNN
Visit: https://developer.nvidia.com/cuda-downloads

### Update ComfyUI
Replace C:\Users\{user}\AppData\Roaming\ComfyUI with latest

## 📚 Additional Resources

- **Gemma**: https://ai.google.dev/gemma
- **PyTorch**: https://pytorch.org
- **ComfyUI**: https://github.com/comfyanonymous/ComfyUI
- **Unsloth**: https://github.com/unslothai/unsloth
- **NVIDIA CUDA**: https://developer.nvidia.com/cuda-toolkit

## 🔐 Privacy

All processing happens locally:
- ✅ Gemma 4 - Local inference only
- ✅ PyTorch - On-device only
- ✅ ComfyUI - Offline generation
- ✅ Ollama - Private LLMs
- ⚠️ Gemini - Requires API key (cloud)

---

**Need help?** Check logs in:
- `python/gemma_service.py` output
- `python/pytorch_service.py` output
- VS Code DevTools (F12 in Mossy)
