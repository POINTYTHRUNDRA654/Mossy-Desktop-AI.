# Mossy Brain — Setup Guide

> **Everything downloads to your D: drive.** No C: drive space is consumed
> by model weights, cache files, or datasets.  All large files land under
> `D:\Mossy-AI\` automatically.

---

## D: Drive Layout

```
D:\Mossy-AI\
├── huggingface\           ← HuggingFace model cache (Gemma 4 weights live here)
│   ├── hub\               ← Downloaded model shards (~18 GB for Gemma 4 9B)
│   └── datasets\          ← Cached HF datasets used for fine-tuning
├── models\                ← Saved / fine-tuned LoRA adapters
│   └── gemma4-finetuned\  ← Output of a fine-tuning run
├── data\
│   ├── chroma_db\         ← RAG vector index (LlamaIndex + Chroma)
│   └── jobs\              ← Fine-tune job status files
├── memory\
│   └── long_term.json     ← Mossy's persistent cross-session memory
├── torch\                 ← PyTorch model hub cache
└── pip_cache\             ← pip wheel/download cache
```

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | NVIDIA 8 GB VRAM | RTX 3060 12 GB+ |
| VRAM (inference) | 8 GB | 12 GB |
| VRAM (fine-tuning) | 12 GB | 16 GB+ |
| Disk (D: drive) | 30 GB free | 60 GB free |
| Python | 3.10 | 3.11 |
| CUDA | 12.0+ | 12.1+ |

---

## Setup Instructions

### 1. Create the D: drive folders (one-time)

```cmd
mkdir D:\Mossy-AI
mkdir D:\Mossy-AI\python-venv
```

### 2. Install Python Virtual Environment on D: drive

```cmd
cd path\to\Mossy-Desktop-AI\python

:: Create the venv on D: so even pip packages don't go to C:
python -m venv D:\Mossy-AI\python-venv

:: Activate it
D:\Mossy-AI\python-venv\Scripts\activate
```

### 3. Install PyTorch with CUDA 12.1 (downloads to D: pip cache)

```cmd
:: Set pip cache to D: before installing
set PIP_CACHE_DIR=D:\Mossy-AI\pip_cache

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 4. Install all other dependencies

```cmd
pip install unsloth
pip install -r requirements.txt
```

> First install may take 15–25 minutes. All wheels are cached to
> `D:\Mossy-AI\pip_cache` so re-installs are instant.

### 5. Verify CUDA / GPU

```cmd
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0)); print('VRAM:', round(torch.cuda.get_device_properties(0).total_memory/1e9,1), 'GB')"
```

### 6. Authenticate with HuggingFace (one-time)

Visit **https://huggingface.co/google/gemma-4-9b** and click **"Agree and access"**
to accept the model license.

Then log in securely using the HuggingFace CLI (credentials are stored in your
user profile, not in command history or environment variables):

```cmd
pip install huggingface_hub
huggingface-cli login
```

You will be prompted to paste your access token from https://huggingface.co/settings/tokens.
The token is stored in `~/.cache/huggingface/token` (not in plain text on screen).

### 7. Run the Application

```cmd
:: Terminal 1 (from repo root)
npm run electron:dev

:: The Electron app will automatically start the Python brain service.
:: On first launch, Gemma 4 (~18 GB) will download to D:\Mossy-AI\huggingface\hub
:: This takes 15–30 minutes depending on your internet connection.
```

---

## Verify D: Drive Is Being Used

Once the app is running, open **The Planner** or any module and check:

```
GET http://127.0.0.1:8000/config
```

This returns all active paths. You should see:
```json
{
  "mossy_data_root": "D:\\Mossy-AI",
  "hf_home": "D:\\Mossy-AI\\huggingface",
  "transformers_cache": "D:\\Mossy-AI\\huggingface\\hub",
  ...
}
```

Or use the `gemma:config` IPC channel from any component:
```ts
const cfg = await window.electronAPI?.gemmaConfig();
```

---

## Changing the D: Drive Location

If you want a different root (e.g., `E:\AI` or a network drive):

**Option A — Before starting the app**, set the environment variable:
```cmd
set MOSSY_DATA_ROOT=E:\MyAI
npm run electron:dev
```

**Option B — Permanent (Windows)**: add `MOSSY_DATA_ROOT=D:\Mossy-AI` to
System Properties → Environment Variables → System variables.

---

## Intelligence Features

| Feature | Endpoint | IPC Channel |
|---------|----------|-------------|
| Inference (Gemma 4) | `POST /infer` | `gemma:run-inference` |
| Reasoning chains | `POST /chain` | `gemma:chain` |
| Chain-of-thought | `POST /chain-of-thought` | `gemma:chain-of-thought` |
| Goal planning | `POST /plan` | `gemma:plan` |
| Self-reflection | `POST /reflect` | `gemma:reflect` |
| RAG document Q&A | `POST /rag-query` | `gemma:rag-query` |
| **Web search** | `POST /tools/web-search` | `gemma:web-search` |
| **Long-term memory** | `GET/POST/DELETE /memory` | `gemma:memory-*` |
| Safe code execution | `POST /tools/execute` | `gemma:tools-execute` |
| Fine-tune (LoRA) | `POST /fine-tune/start` | `gemma:start-fine-tune` |
| Config / paths | `GET /config` | `gemma:config` |

---

## Long-Term Memory

Mossy can remember facts across sessions.  Memories are stored in
`D:\Mossy-AI\memory\long_term.json` and **automatically injected** into
every inference prompt so she "knows" them without being told again.

```ts
// Save a memory
await window.electronAPI?.ipcInvoke('gemma:memory-add', {
  key: 'user_name',
  value: 'The user prefers detailed technical answers.'
});

// Read all memories
const { memory } = await window.electronAPI?.ipcInvoke('gemma:memory-get');
```

---

## Web Search (No API Key)

Mossy can search DuckDuckGo and synthesise results into a natural language
answer.  No account or API key required.

```ts
const result = await window.electronAPI?.ipcInvoke('gemma:web-search', {
  query: 'latest NVIDIA GPU drivers 2025',
  max_results: 5,
});
// result.synthesis — Mossy's answer based on search results
// result.topics   — raw search snippets
```

---

## Fine-Tuning on D: Drive

All fine-tuned models are saved to `D:\Mossy-AI\models\gemma4-finetuned`
by default.  To use a fine-tuned model, load it:

```ts
await window.electronAPI?.ipcInvoke('gemma:load-model-advanced', {
  model_name: 'D:\\Mossy-AI\\models\\gemma4-finetuned',
  load_in_4bit: true,
});
```

---

## Performance Tips (NVIDIA)

| Config | VRAM | Speed | Quality |
|--------|------|-------|---------|
| Gemma 4 9B · 4-bit · Unsloth | 8 GB | Fast | Excellent |
| Gemma 4 9B · 4-bit · Rank 8 fine-tune | 10 GB | Medium | Very good |
| Gemma 4 9B · 4-bit · Rank 16 fine-tune | 12 GB | Good | Best |
| Flash Attention 2 (RTX 30xx+) | same | 2–3× faster | same |

---

## Troubleshooting

### Downloads still going to C:
- Check `GET http://127.0.0.1:8000/config` and verify `mossy_data_root` is `D:\Mossy-AI`
- Make sure you are using the **`D:\Mossy-AI\python-venv`** virtual environment, not the system Python

### "Model won't load — out of space"
- Run `du -sh D:\Mossy-AI\huggingface\hub\*` to see what's taking space
- Use a smaller model: `unsloth/gemma-3-4b-it` (~5 GB) instead of `google/gemma-4-9b`

### "CUDA not detected"
```cmd
nvidia-smi         ← should show your GPU
nvcc --version     ← should show CUDA 12.x
```
If missing, install CUDA Toolkit 12.1+ from https://developer.nvidia.com/cuda-downloads

### "pip still installing to C:"
Make sure `D:\Mossy-AI\python-venv\Scripts\activate` is active **and**
`PIP_CACHE_DIR=D:\Mossy-AI\pip_cache` is set before running `pip install`.

---

## References

- Unsloth: https://github.com/unslothai/unsloth
- Gemma 4: https://ai.google.dev/gemma
- HuggingFace cache docs: https://huggingface.co/docs/huggingface_hub/guides/manage-cache
- CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
- DuckDuckGo API: https://duckduckgo.com/api

