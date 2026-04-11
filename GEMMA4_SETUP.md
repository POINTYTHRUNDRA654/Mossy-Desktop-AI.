# Gemma 4 Integration Guide

Mossy's. Desktop AIS, New Brain now includes **Gemma 4 fine-tuning capabilities**. This guide walks you through setup and usage.

## Overview

The Gemma 4 integration provides:
- **Local Model Inference**: Run Gemma 4 locally without cloud API costs
- **Fine-Tuning**: Customize Gemma 4 with your own data using LoRA (Low-Rank Adaptation)
- **GPU-Optimized Training**: Uses `unsloth` for efficient fine-tuning on limited VRAM
- **REST API Backend**: Python FastAPI service communicates with Electron app

## System Requirements

- **GPU**: NVIDIA GPU with CUDA (RTX 3060+ recommended for fine-tuning)
- **VRAM**: 
  - 8GB minimum for inference
  - 16GB+ recommended for fine-tuning
- **Python**: 3.10 or higher
- **Disk Space**: 20GB+ (for model weights)

## Setup Instructions

### 1. Install Python Dependencies

Set up a Python virtual environment in the `python/` directory:

```bash
cd python
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Note**: The first installation may take 10-15 minutes due to PyTorch and Transformers compilation.

### 2. Verify CUDA/GPU Setup

Ensure PyTorch can access your GPU:

```bash
python -c "import torch; print('GPU Available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0))"
```

If GPU is not detected, install CUDA toolkit: https://developer.nvidia.com/cuda-downloads

### 3. Download Gemma 4 Model

The model will be auto-downloaded on first use. Accept the model license at:
https://huggingface.co/google/gemma-4-9b

### 4. Run the Application

```bash
# Terminal 1: Start React dev server + Electron
npm run electron:dev

# Terminal 2: (Optional, for manual testing)
# Start Python service directly
cd python
source venv/bin/activate
python gemma_service.py
```

The Electron app will auto-spawn the Python service on port 8000.

## Usage

### Switching to Gemma 4

1. Open Settings/API Key Setup
2. Select **"Gemma 4 (Local Fine-Tuning)"** as provider
3. Service auto-starts on first use

### Fine-Tuning a Model

1. Open the **Gemma 4 Fine-Tuner** component
2. Paste training examples (separate with blank lines):
   ```
   User: What is machine learning?
   Assistant: Machine learning is a subset of AI...
   
   User: How does neural networks work?
   Assistant: Neural networks are inspired by biological neurons...
   ```
3. Adjust hyperparameters if needed:
   - **Epochs**: Number of training passes (3-5 recommended)
   - **Batch Size**: 4-8 for 16GB VRAM
   - **Learning Rate**: 2e-4 (standard for LoRA)
   - **LoRA Rank**: 8-16 (higher = more capacity but slower)

4. Click **"Start Fine-Tuning"**
5. Monitor progress in the status panel

### Using Fine-Tuned Models

After fine-tuning completes:
1. The model is saved to `./gemma4_finetuned` 
2. Go back to chat and select it as the model path
3. Chat will now use your fine-tuned version

## Architecture

```
Electron App (React)
    ↓
Electron IPC Bridge (gemma:* handlers)
    ↓
Python FastAPI Service (port 8000)
    ↓
Gemma 4 Model + LoRA Library
    ↓
NVIDIA GPU (CUDA)
```

### IPC Handlers

The Electron bridge exposes:
- `gemma:health-check` - Service status
- `gemma:start-fine-tune` - Begin fine-tuning job
- `gemma:fine-tune-status` - Poll job progress
- `gemma:run-inference` - Generate text
- `gemma:list-models` - Available models
- `gemma:load-model` - Load specific model

## Troubleshooting

### "Python service failed to start"
- Check Python 3.10+ is installed
- Verify `python/requirements.txt` installed successfully
- Check `python` is in your PATH

### "CUDA not detected"
- Install NVIDIA CUDA Toolkit 12.0+
- Restart system after CUDA install
- Run `nvidia-smi` to verify GPU visibility

### "Out of Memory (OOM) error"
- Reduce `batch_size` to 2-4
- Reduce `lora_rank` to 8
- Enable CPU offloading in config
- Use smaller model (`gemma-2-9b` instead of `gemma-4-9b`)

### "Fine-tuning very slow"
- Verify GPU usage: `nvidia-smi` (should show 80%+ utilization)
- Check for CPU bottleneck: System Monitor
- Reduce `num_epochs` for testing
- Use smaller dataset for iteration

### "Model won't load"
- First-time loads download 10-30GB (takes 10-20 min)
- Check internet connection and disk space
- Try manually: `huggingface-cli download google/gemma-4-9b`

## Advanced Configuration

Edit `python/gemma_service.py` to:
- Change default model (`model_name`)
- Adjust max token limits
- Add custom inference parameters
- Enable LoRA merging on save

## Performance Tips

| Configuration | VRAM | Speed | Quality |
|---|---|---|---|
| Rank 8, BS 2 | 8GB | Slow | Good |
| Rank 16, BS 4 | 12GB | Medium | Better |
| Rank 32, BS 8 | 16GB | Fast | Best |

## File Structure

```
python/
├── requirements.txt           # Python dependencies
├── gemma_service.py          # FastAPI service (main)
└── venv/                      # Virtual environment

utils/
├── apiKey.ts                 # Provider + config management
└── aiClient.ts               # AI client factory

components/
└── Gemma4FineTuner.tsx       # UI for fine-tuning
```

## Next Steps

1. **Fine-tune for your use case** - Gather domain-specific data
2. **Merge LoRA weights** - For production, merge adapters into base model
3. **Deploy to edge** - Export quantized model for other devices
4. **Monitor quality** - Evaluate fine-tuned outputs vs. base model

## References

- Unsloth: https://github.com/unslothai/unsloth
- Gemma: https://ai.google.dev/gemma
- LoRA: https://arxiv.org/abs/2106.09685
- FastAPI: https://fastapi.tiangolo.com/

---

**Questions?** Check the logs in `python/gemma_service.py` output or enable debug mode in Electron DevTools (F12).
