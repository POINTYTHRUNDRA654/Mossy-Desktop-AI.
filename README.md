<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mossy AI Assistant

Mossy: Your personal desktop AI companion for creative workflows, modding, and system integration.

View the original AI Studio app: https://ai.studio/apps/drive/1uEKBzDjU2KgB6zleJiVhy7QNGs4OwkjZ

---

## AI Engine Options

Mossy works with **two AI engines** — choose the one that fits you:

| | Ollama (Local) | Gemini API (Cloud) |
|---|---|---|
| **Cost** | Free forever | Free tier (1,500 req/day) |
| **Privacy** | Fully private — nothing leaves your PC | Calls Google's servers |
| **Internet** | Not required | Required |
| **Setup** | Install Ollama + pull a model | Get a free API key |
| **Quality** | Very good (Gemma 3, Llama 3.2) | Excellent (Gemini 2.0 Flash) |
| **Image gen** | ✗ (not yet) | ✓ |
| **Live voice** | Web Speech API (free, built-in) | Gemini Live (premium) |

On first launch, Mossy asks which engine you want to use. You can switch at any time from the sidebar.

---

## Quick Start — Local AI (Ollama, Free)

**Prerequisites:** [Ollama](https://ollama.com)

1. Install Ollama: https://ollama.com  
2. Pull a model (recommended):
   ```
   ollama pull gemma3
   ```
3. Launch Mossy — it auto-detects Ollama on `localhost:11434`.

> **Recommended models by PC spec:**
> | Model | RAM needed | Quality |
> |-------|-----------|---------|
> | `gemma3:1b` | ~2 GB | Fast / lightweight |
> | `gemma3:4b` | ~4 GB | Great balance |
> | `gemma3:9b` | ~6 GB | Best local quality |
> | `llama3.2` | ~3 GB | Very capable |
> | `mistral` | ~5 GB | Well-rounded |

---

## Quick Start — Gemini API (Cloud, Free Tier)

1. Get a **free** API key at https://aistudio.google.com/app/apikey  
2. Launch Mossy and choose **Gemini API** on first run.  
3. Enter your key — it's stored on this device only.

---

## Run Locally (Web / Dev)

```
npm install
npm run dev
```

No `.env.local` file needed — the API key and provider are configured at runtime through the app's own UI.

---

## Testing

Run the comprehensive test suite (59 tests):

```
npm test
```

Run with coverage report:

```
npm run test:coverage
```

---

## Desktop App — Run in Electron (Dev Preview)

```
npm run electron:dev
```

Starts the Vite dev server and opens Mossy in a native desktop window.

---

## Desktop App — Build Installer

```
npm run electron:build
```

Output installers are saved to the `release/` folder:

| Platform | Installer |
|----------|-----------|
| Windows  | `release/Mossy AI Assistant Setup x.x.x.exe` (NSIS, one-click install) |
| macOS    | `release/Mossy AI Assistant-x.x.x.dmg` |
| Linux    | `release/Mossy AI Assistant-x.x.x.AppImage` / `.deb` |

### Quick directory pack (no installer, fastest):
```
npm run electron:pack
```

---

## Desktop Bridge (Optional — Local File Access)

The **Neural Interconnect** tab (`/bridge`) lets Mossy read and write files on your PC.

1. Open the app → navigate to **Neural Interconnect**.  
2. Click **Get Server (.py)** and **Get Launcher (.bat)**.  
3. Save both files to a folder on your PC.  
4. Double-click `start_mossy.bat` (requires Python 3.10+).  
5. The bridge status indicator turns green when connected.
