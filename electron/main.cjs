'use strict';

const { app, BrowserWindow, shell, session, Tray, Menu, nativeImage, ipcMain, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:3000';

let mainWindow = null;
let tray = null;

// Track whether we are doing a real quit vs. close-to-tray
app.isQuitting = false;

// ── Python Service Management ─────────────────────────────────────────────
let gemmaProcess = null;
let pytorchProcess = null;
let whisperProcess = null;
let chromaProcess = null;
const GEMMA_SERVICE_PORT = 8000;
const PYTORCH_SERVICE_PORT = 8001;
const WHISPER_SERVICE_PORT = 8002;
const CHROMA_SERVICE_PORT = 8003;
const GEMMA_SERVICE_URL = `http://127.0.0.1:${GEMMA_SERVICE_PORT}`;
const PYTORCH_SERVICE_URL = `http://127.0.0.1:${PYTORCH_SERVICE_PORT}`;
const WHISPER_SERVICE_URL = `http://127.0.0.1:${WHISPER_SERVICE_PORT}`;
const CHROMA_SERVICE_URL = `http://127.0.0.1:${CHROMA_SERVICE_PORT}`;

function startPythonService(serviceType = 'gemma') {
  const serviceMap = {
    'gemma': { var: () => gemmaProcess, set: (p) => { gemmaProcess = p; }, script: 'gemma_service_enhanced.py' },
    'pytorch': { var: () => pytorchProcess, set: (p) => { pytorchProcess = p; }, script: 'pytorch_service.py' },
    'whisper': { var: () => whisperProcess, set: (p) => { whisperProcess = p; }, script: 'whisper_service.py' },
    'chroma': { var: () => chromaProcess, set: (p) => { chromaProcess = p; }, script: 'chroma_service.py' },
    'opencv': { var: () => opencvProcess, set: (p) => { opencvProcess = p; }, script: 'opencv_service.py' },
    'piper': { var: () => piperProcess, set: (p) => { piperProcess = p; }, script: 'piper_service.py' },
    'triposr': { var: () => triposrProcess, set: (p) => { triposrProcess = p; }, script: 'triposr_service.py' },
    'rvc': { var: () => rvcProcess, set: (p) => { rvcProcess = p; }, script: 'rvc_service.py' },
    // New: Real-ESRGAN texture upscaling (xinntao/Real-ESRGAN on GitHub)
    'esrgan': { var: () => esrganProcess, set: (p) => { esrganProcess = p; }, script: 'esrgan_service.py' },
    // New: WolvenKit CLI automation (WolvenKit/WolvenKit on GitHub)
    'wolvenkit': { var: () => wolvenKitProcess, set: (p) => { wolvenKitProcess = p; }, script: 'wolvenkit_service.py' },
    // New: Fallout 4 modding services
    'fo4edit':      { var: () => fo4editProcess,     set: (p) => { fo4editProcess = p; },     script: 'fo4edit_service.py' },
    'ba2':          { var: () => ba2Process,         set: (p) => { ba2Process = p; },         script: 'ba2_service.py' },
    'papyrus':      { var: () => papyrusProcess,     set: (p) => { papyrusProcess = p; },     script: 'papyrus_service.py' },
    'fomod':        { var: () => fomodProcess,       set: (p) => { fomodProcess = p; },       script: 'fomod_service.py' },
    // New: F4SE C++ plugin scaffolder (Jinja2 templates)
    'f4se':         { var: () => f4seProcess,        set: (p) => { f4seProcess = p; },        script: 'f4se_service.py' },
    // New: Blender cell-editor round-trip (ESP extraction + patch writing)
    'cell-editor':  { var: () => cellEditorProcess,  set: (p) => { cellEditorProcess = p; },  script: 'cell_editor_service.py' },
  };

  const svc = serviceMap[serviceType] || serviceMap['gemma'];
  if (svc.var()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const pythonDir = path.join(__dirname, '..', 'python');
    const pythonScript = path.join(pythonDir, svc.script);

    // ── D: drive environment — all large downloads go to D:\Mossy-AI ────────
    // On Windows defaults to D:\Mossy-AI; on other OS falls back to ~/Mossy-AI.
    const defaultRoot = process.platform === 'win32'
      ? 'D:\\Mossy-AI'
      : path.join(require('os').homedir(), 'Mossy-AI');
    const mossyDataRoot = process.env.MOSSY_DATA_ROOT || defaultRoot;
    const hfHome        = path.join(mossyDataRoot, 'huggingface');

    const pythonEnv = {
      ...process.env,
      MOSSY_DATA_ROOT:    mossyDataRoot,
      HF_HOME:            hfHome,
      HF_HUB_CACHE:       path.join(hfHome, 'hub'),
      TRANSFORMERS_CACHE: path.join(hfHome, 'hub'),
      HF_DATASETS_CACHE:  path.join(hfHome, 'datasets'),
      TORCH_HOME:         path.join(mossyDataRoot, 'torch'),
      PIP_CACHE_DIR:      path.join(mossyDataRoot, 'pip_cache'),
    };

    const proc = spawn('python', [pythonScript], {
      cwd: pythonDir,
      stdio: 'pipe',
      detached: false,
      env: pythonEnv,
    });

    svc.set(proc);

    const timeout = setTimeout(() => {
      resolve(); // Assume it's running after timeout
    }, 30000);

    proc.stdout?.on('data', (data) => {
      console.log(`[${serviceType} Service] ${data}`);
      if (data.includes('Uvicorn running on')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr?.on('data', (data) => {
      console.error(`[${serviceType} Service Error] ${data}`);
    });

    proc.on('error', (err) => {
      console.error(`Failed to start ${serviceType} service:`, err);
      if (isGemma) gemmaProcess = null;
      else pytorchProcess = null;
      reject(err);
    });
  });
}

function stopPythonServices() {
  if (gemmaProcess) {
    gemmaProcess.kill();
    gemmaProcess = null;
  }
  if (pytorchProcess) {
    pytorchProcess.kill();
    pytorchProcess = null;
  }
  if (whisperProcess) {
    whisperProcess.kill();
    whisperProcess = null;
  }
  if (chromaProcess) {
    chromaProcess.kill();
    chromaProcess = null;
  }
  if (agentCollabProcess) {
    agentCollabProcess.kill();
    agentCollabProcess = null;
  }
  if (opencvProcess) { opencvProcess.kill(); opencvProcess = null; }
  if (piperProcess) { piperProcess.kill(); piperProcess = null; }
  if (triposrProcess) { triposrProcess.kill(); triposrProcess = null; }
  if (rvcProcess) { rvcProcess.kill(); rvcProcess = null; }
  if (esrganProcess) { esrganProcess.kill(); esrganProcess = null; }
  if (wolvenKitProcess) { wolvenKitProcess.kill(); wolvenKitProcess = null; }
  if (fo4editProcess)     { fo4editProcess.kill();     fo4editProcess = null; }
  if (ba2Process)         { ba2Process.kill();         ba2Process = null; }
  if (papyrusProcess)     { papyrusProcess.kill();     papyrusProcess = null; }
  if (fomodProcess)       { fomodProcess.kill();       fomodProcess = null; }
  if (f4seProcess)        { f4seProcess.kill();        f4seProcess = null; }
  if (cellEditorProcess)  { cellEditorProcess.kill();  cellEditorProcess = null; }
}

// ── Auto-launch at OS startup ──────────────────────────────────────────────
function setAutoLaunch(enable) {
  if (process.platform === 'linux') return; // Linux handled per-distro
  app.setLoginItemSettings({
    openAtLogin: enable,
    name: 'Mossy\'s. Desktop AIS, New Brain',
    args: enable ? ['--hidden'] : [],
  });
}

function getAutoLaunch() {
  if (process.platform === 'linux') return false;
  return app.getLoginItemSettings().openAtLogin;
}

// ── IPC handlers (called from renderer via preload) ───────────────────────
ipcMain.handle('get-auto-launch', () => getAutoLaunch());
ipcMain.handle('set-auto-launch', (_, enable) => { setAutoLaunch(enable); return enable; });
ipcMain.handle('window-minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window-hide', () => { mainWindow?.hide(); });

// ── Secure credential storage (Electron safeStorage — OS keychain) ────────
// Replaces storing API keys in localStorage (plaintext).
// Components call: window.electronAPI.ipcInvoke('secrets:set', { key, value })
//                  window.electronAPI.ipcInvoke('secrets:get', { key })
const SECRETS_FILE = path.join(
  process.env.MOSSY_DATA_ROOT || (process.platform === 'win32' ? 'D:\\Mossy-AI' : require('os').homedir() + '/Mossy-AI'),
  'secrets.enc'
);

async function readSecrets() {
  try {
    const raw = await fs.promises.readFile(SECRETS_FILE);
    if (!safeStorage.isEncryptionAvailable()) return JSON.parse(raw.toString('utf8'));
    return JSON.parse(safeStorage.decryptString(raw));
  } catch { return {}; }
}

async function writeSecrets(obj) {
  await fs.promises.mkdir(path.dirname(SECRETS_FILE), { recursive: true });
  const text = JSON.stringify(obj);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  await fs.promises.writeFile(SECRETS_FILE, data);
}

ipcMain.handle('secrets:set', async (_, { key, value }) => {
  try {
    const store = await readSecrets();
    store[key] = value;
    await writeSecrets(store);
    return { status: 'ok' };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('secrets:get', async (_, { key }) => {
  try {
    const store = await readSecrets();
    return { status: 'ok', value: store[key] ?? null };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('secrets:delete', async (_, { key }) => {
  try {
    const store = await readSecrets();
    delete store[key];
    await writeSecrets(store);
    return { status: 'ok' };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('bridge-scan', async (_, { base = 'D:\\', depth = 3, maxEntries = 4000, includeExe = true } = {}) => {
  const normalizedBase = path.resolve(base);
  if (!normalizedBase.toLowerCase().startsWith('d:')) {
    return { status: 'error', message: 'Scanning is limited to D: drive for safety.' };
  }

  const results = [];
  const errors = [];

  const walk = async (dir, currentDepth) => {
    if (results.length >= maxEntries) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxEntries) break;
        const full = path.join(dir, entry.name);
        const isDir = entry.isDirectory();
        const isExe = !isDir && includeExe && entry.name.toLowerCase().endsWith('.exe');
        results.push({ path: full, isDir, isExe });
        if (isDir && currentDepth < depth) {
          await walk(full, currentDepth + 1);
        }
      }
    } catch (err) {
      errors.push({ path: dir, message: String(err) });
    }
  };

  await walk(normalizedBase, 0);
  return { status: 'ok', results, errors, truncated: results.length >= maxEntries };
});

// ── Gemma 4 Fine-tuning IPC Handlers ───────────────────────────────────────
ipcMain.handle('gemma:health-check', async () => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:start-fine-tune', async (_, config) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/fine-tune/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:fine-tune-status', async (_, jobId) => {
  try {
    const response = await fetch(`${GEMMA_SERVICE_URL}/fine-tune/status/${jobId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:run-inference', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:list-models', async () => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/models/available`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:load-model', async (_, modelName) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/models/load/${encodeURIComponent(modelName)}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── PyTorch Model IPC Handlers ────────────────────────────────────────────
ipcMain.handle('pytorch:health-check', async () => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('pytorch:load-model', async (_, config) => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/load-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('pytorch:infer', async (_, request) => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('pytorch:list-loaded-models', async () => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('pytorch:discover-models', async (_, dirPath) => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/discover-models/${encodeURIComponent(dirPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('pytorch:system-info', async () => {
  try {
    await startPythonService('pytorch');
    const response = await fetch(`${PYTORCH_SERVICE_URL}/system-info`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── ComfyUI IPC Handlers ────────────────────────────────────────────────────
ipcMain.handle('comfyui:health-check', async (_, endpoint) => {
  try {
    const response = await fetch(`${endpoint}/system_stats`, { signal: AbortSignal.timeout(3000) });
    return { status: response.ok ? 'healthy' : 'error' };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('comfyui:generate-image', async (_, { endpoint, ...request }) => {
  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('comfyui:list-models', async (_, endpoint) => {
  try {
    const response = await fetch(`${endpoint}/api/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { models: [] };
    const data = await response.json();
    return { models: data.models || [] };
  } catch (err) {
    return { models: [], error: String(err) };
  }
});

// ── System Tools IPC Handlers ────────────────────────────────────────────────
ipcMain.handle('system:detect-tools', async () => {
  try {
    const { execSync } = require('child_process');
    const tools = {
      gpu: {
        available: false,
        driver: '',
        computeCapability: '',
        deviceName: '',
      },
      frameworks: [],
      dockerAvailable: false,
      gitAvailable: false,
    };

    try {
      const output = execSync('nvidia-smi --query-gpu=driver_version,compute_cap,name --format=csv,noheader', { encoding: 'utf-8' });
      const parts = output.trim().split(',').map(s => s.trim());
      if (parts.length >= 3) {
        tools.gpu = {
          available: true,
          driver: parts[0],
          computeCapability: parts[1],
          deviceName: parts[2],
        };
      }
    } catch { }

    try {
      execSync('docker --version', { stdio: 'pipe' });
      tools.dockerAvailable = true;
    } catch { }

    try {
      execSync('git --version', { stdio: 'pipe' });
      tools.gitAvailable = true;
    } catch { }

    return tools;
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Whisper Speech-to-Text IPC Handlers ───────────────────────────────────
ipcMain.handle('whisper:health-check', async () => {
  try {
    await startPythonService('whisper');
    const response = await fetch(`${WHISPER_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('whisper:transcribe', async (_, request) => {
  try {
    await startPythonService('whisper');
    const response = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('whisper:set-model', async (_, model) => {
  try {
    await startPythonService('whisper');
    const response = await fetch(`${WHISPER_SERVICE_URL}/set-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('whisper:list-models', async () => {
  try {
    await startPythonService('whisper');
    const response = await fetch(`${WHISPER_SERVICE_URL}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Chroma Vector DB IPC Handlers ─────────────────────────────────────────
ipcMain.handle('chroma:health-check', async () => {
  try {
    await startPythonService('chroma');
    const response = await fetch(`${CHROMA_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('chroma:add-document', async (_, document) => {
  try {
    await startPythonService('chroma');
    const response = await fetch(`${CHROMA_SERVICE_URL}/add-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('chroma:search', async (_, query) => {
  try {
    await startPythonService('chroma');
    const response = await fetch(`${CHROMA_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('chroma:delete-document', async (_, docId) => {
  try {
    await startPythonService('chroma');
    const response = await fetch(`${CHROMA_SERVICE_URL}/document/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('chroma:clear', async (_, collection) => {
  try {
    await startPythonService('chroma');
    const response = await fetch(`${CHROMA_SERVICE_URL}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collection || 'mossy_knowledge_base' }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Enhanced Gemma Chain & RAG IPC Handlers ───────────────────────────────
ipcMain.handle('gemma:chain', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/chain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:rag-query', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/rag-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:add-documents', async (_, documents) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/add-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(documents),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── New Intelligence IPC Handlers ────────────────────────────────────────

ipcMain.handle('gemma:chain-of-thought', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/chain-of-thought`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:plan', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:reflect', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/reflect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:tools-execute', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:load-model-advanced', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/models/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Memory IPC Handlers ───────────────────────────────────────────────────

ipcMain.handle('gemma:memory-get', async () => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/memory`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:memory-add', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/memory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:memory-delete', async (_, key) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/memory/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('gemma:memory-clear', async () => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/memory`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Web Search IPC Handler ─────────────────────────────────────────────────

ipcMain.handle('gemma:web-search', async (_, request) => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/tools/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Config / path info IPC Handler ────────────────────────────────────────

ipcMain.handle('gemma:config', async () => {
  try {
    await startPythonService('gemma');
    const response = await fetch(`${GEMMA_SERVICE_URL}/config`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── Multi-Agent Collaboration IPC Handlers ────────────────────────────────
const AGENT_COLLAB_PORT = 8004;
const AGENT_COLLAB_SERVICE = `http://127.0.0.1:${AGENT_COLLAB_PORT}`;

// Start agent collaboration service if not running
let agentCollabProcess = null;

// ── Gamer Tools Service Management ──────────────────────────────────────
let opencvProcess = null;
let piperProcess = null;
let triposrProcess = null;
let rvcProcess = null;
let esrganProcess = null;
let wolvenKitProcess = null;
// ── Fallout 4 Modding Services ────────────────────────────────────────────
let fo4editProcess     = null;
let ba2Process         = null;
let papyrusProcess     = null;
let fomodProcess       = null;
let f4seProcess        = null;
let cellEditorProcess  = null;
const OPENCV_SERVICE_PORT      = 8005;
const PIPER_SERVICE_PORT       = 8006;
const TRIPOSR_SERVICE_PORT     = 8007;
const RVC_SERVICE_PORT         = 8008;
const ESRGAN_SERVICE_PORT      = 8009;
const WOLVENKIT_SERVICE_PORT   = 8010;
const FO4EDIT_SERVICE_PORT     = 8012;
const BA2_SERVICE_PORT         = 8013;
const PAPYRUS_SERVICE_PORT     = 8014;
const FOMOD_SERVICE_PORT       = 8015;
const F4SE_SERVICE_PORT        = 8016;
const CELL_EDITOR_SERVICE_PORT = 8017;
const OPENCV_SERVICE_URL       = `http://127.0.0.1:${OPENCV_SERVICE_PORT}`;
const PIPER_SERVICE_URL        = `http://127.0.0.1:${PIPER_SERVICE_PORT}`;
const TRIPOSR_SERVICE_URL      = `http://127.0.0.1:${TRIPOSR_SERVICE_PORT}`;
const RVC_SERVICE_URL          = `http://127.0.0.1:${RVC_SERVICE_PORT}`;
const ESRGAN_SERVICE_URL       = `http://127.0.0.1:${ESRGAN_SERVICE_PORT}`;
const WOLVENKIT_SERVICE_URL    = `http://127.0.0.1:${WOLVENKIT_SERVICE_PORT}`;
const FO4EDIT_SERVICE_URL      = `http://127.0.0.1:${FO4EDIT_SERVICE_PORT}`;
const BA2_SERVICE_URL          = `http://127.0.0.1:${BA2_SERVICE_PORT}`;
const PAPYRUS_SERVICE_URL      = `http://127.0.0.1:${PAPYRUS_SERVICE_PORT}`;
const FOMOD_SERVICE_URL        = `http://127.0.0.1:${FOMOD_SERVICE_PORT}`;
const F4SE_SERVICE_URL         = `http://127.0.0.1:${F4SE_SERVICE_PORT}`;
const CELL_EDITOR_SERVICE_URL  = `http://127.0.0.1:${CELL_EDITOR_SERVICE_PORT}`;

function startAgentCollaborationService() {
  if (agentCollabProcess) return Promise.resolve();

  return new Promise((resolve) => {
    const pythonDir = path.join(__dirname, '..', 'python');
    const pythonScript = path.join(pythonDir, 'agent_collaboration_service.py');

    agentCollabProcess = spawn('python', [pythonScript], {
      cwd: pythonDir,
      stdio: 'pipe',
      detached: false,
    });

    const timeout = setTimeout(() => resolve(), 30000);

    agentCollabProcess.stdout?.on('data', (data) => {
      console.log(`[Agent Collab] ${data}`);
      if (data.includes('Starting on port')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    agentCollabProcess.stderr?.on('data', (data) => {
      console.error(`[Agent Collab Error] ${data}`);
    });
  });
}

ipcMain.handle('agent:discover', async () => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/agents/discover`);
    return await response.json();
  } catch (err) {
    return { error: String(err), agents: {} };
  }
});

ipcMain.handle('agent:query', async (_, { fromAgent, toAgent, question, context }) => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/agents/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_agent: fromAgent,
        to_agent: toAgent,
        question: question,
        context: context,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('agent:knowledge-search', async (_, { query, n_results }) => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, n_results: n_results || 5 }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('agent:knowledge-add', async (_, { topic, content, tags, confidence }) => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/knowledge/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic,
        content: content,
        agent: 'desktop-ai',
        tags: tags || [],
        confidence: confidence || 0.8,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('agent:validate-answer', async (_, { question, answer, answeringAgent }) => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/agents/validate-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        answer: answer,
        answering_agent: answeringAgent,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('agent:get-stats', async () => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/stats`);
    return await response.json();
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.handle('agent:trigger-improvement', async () => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/improve/all`, {
      method: 'POST',
    });
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('agent:get-learning-history', async (_, agentName) => {
  try {
    await startAgentCollaborationService();
    const response = await fetch(`${AGENT_COLLAB_SERVICE}/agents/${agentName}/learning-history`);
    return await response.json();
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

// ── OpenCV Vision IPC Handlers ──────────────────────────────────────────
ipcMain.handle('vision:health-check', async () => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('vision:screenshot', async (_, args) => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/screenshot`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('vision:analyze-hud', async (_, args) => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/analyze-hud`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('vision:ocr-text', async (_, args) => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/ocr-text`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('vision:detect-game-state', async (_, args) => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/detect-game-state`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Piper TTS IPC Handlers ───────────────────────────────────────────────
ipcMain.handle('piper:health-check', async () => {
  try {
    await startPythonService('piper');
    const response = await fetch(`${PIPER_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('piper:voices', async () => {
  try {
    await startPythonService('piper');
    const response = await fetch(`${PIPER_SERVICE_URL}/voices`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('piper:synthesize', async (_, args) => {
  try {
    await startPythonService('piper');
    const response = await fetch(`${PIPER_SERVICE_URL}/synthesize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── TripoSR 3D IPC Handlers ─────────────────────────────────────────────
ipcMain.handle('triposr:health-check', async () => {
  try {
    await startPythonService('triposr');
    const response = await fetch(`${TRIPOSR_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('triposr:generate-mesh', async (_, args) => {
  try {
    await startPythonService('triposr');
    const response = await fetch(`${TRIPOSR_SERVICE_URL}/generate-mesh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('triposr:outputs', async () => {
  try {
    await startPythonService('triposr');
    const response = await fetch(`${TRIPOSR_SERVICE_URL}/outputs`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── RVC Voice Conversion IPC Handlers ──────────────────────────────────
ipcMain.handle('rvc:health-check', async () => {
  try {
    await startPythonService('rvc');
    const response = await fetch(`${RVC_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('rvc:models', async () => {
  try {
    await startPythonService('rvc');
    const response = await fetch(`${RVC_SERVICE_URL}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('rvc:convert', async (_, args) => {
  try {
    await startPythonService('rvc');
    const response = await fetch(`${RVC_SERVICE_URL}/convert`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('rvc:train-model', async (_, args) => {
  try {
    await startPythonService('rvc');
    const response = await fetch(`${RVC_SERVICE_URL}/train-model`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('rvc:training-status', async (_, jobId) => {
  try {
    const response = await fetch(`${RVC_SERVICE_URL}/training-status/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Ollama Code Generation IPC Handlers ─────────────────────────────────
const OLLAMA_URL = 'http://127.0.0.1:11434';
ipcMain.handle('ollama:health-check', async () => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'healthy', models: data.models?.map(m => m.name) || [] };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ollama:code-gen', async (_, { model, system_prompt, prompt }) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'deepseek-coder-v2',
        system: system_prompt || 'You are an expert game developer and modder. Generate clean, well-commented code.',
        prompt: prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', code: data.response, model_used: data.model };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ollama:list-models', async () => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', models: data.models || [] };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Steam Web API IPC Handlers ───────────────────────────────────────────
const STEAM_API_BASE = 'https://api.steampowered.com';
ipcMain.handle('steam:get-library', async (_, { apiKey, steamId }) => {
  try {
    const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', games: data.response?.games || [], count: data.response?.game_count || 0 };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('steam:get-achievements', async (_, { apiKey, steamId, appId }) => {
  try {
    const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&appid=${encodeURIComponent(appId)}&l=en&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', achievements: data.playerstats?.achievements || [], game_name: data.playerstats?.gameName || '' };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('steam:get-recent', async (_, { apiKey, steamId }) => {
  try {
    const url = `${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&count=10&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', games: data.response?.games || [] };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('steam:get-player', async (_, { apiKey, steamId }) => {
  try {
    const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}&format=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const player = data.response?.players?.[0];
    return { status: 'ok', player: player || null };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Nexus Mods API IPC Handlers ──────────────────────────────────────────
const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';
ipcMain.handle('nexus:search', async (_, { apiKey, game, query, page }) => {
  try {
    const searchUrl = `https://search.nexusmods.com/mods?terms=${encodeURIComponent(query)}&game_id=${encodeURIComponent(game)}&blocked_tags=&blocked_authors=&include_adult=0&page_size=20&page=${page || 0}`;
    const response = await fetch(searchUrl, {
      headers: { apikey: apiKey, 'Application-Name': 'MossyAI', 'Application-Version': '1.0.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', results: data.results || [], total: data.total || 0 };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('nexus:get-mod', async (_, { apiKey, game, modId }) => {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/games/${encodeURIComponent(game)}/mods/${encodeURIComponent(modId)}.json`, {
      headers: { apikey: apiKey, 'Application-Name': 'MossyAI', 'Application-Version': '1.0.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', mod: data };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('nexus:trending', async (_, { apiKey, game }) => {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/games/${encodeURIComponent(game)}/mods/trending.json`, {
      headers: { apikey: apiKey, 'Application-Name': 'MossyAI', 'Application-Version': '1.0.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { status: 'ok', mods: data };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── LOOT Load Order IPC Handlers ─────────────────────────────────────────
ipcMain.handle('loot:analyze', async (_, { lootPath, game, modsDir }) => {
  try {
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const lootExe = lootPath || (process.platform === 'win32' ? 'C:\\Program Files\\LOOT\\LOOT.exe' : 'loot');
    const args = ['--game', game || 'Skyrim', '--game-path', modsDir || ''];
    const { stdout, stderr } = await execFileAsync(lootExe, args, { timeout: 60000 });
    return { status: 'ok', output: stdout, warnings: stderr };
  } catch (err) {
    return { status: 'error', message: String(err), output: '', warnings: '' };
  }
});
ipcMain.handle('loot:sort', async (_, { lootPath, game }) => {
  try {
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const lootExe = lootPath || (process.platform === 'win32' ? 'C:\\Program Files\\LOOT\\LOOT.exe' : 'loot');
    const { stdout } = await execFileAsync(lootExe, ['--game', game || 'Skyrim', '--auto-sort'], { timeout: 60000 });
    return { status: 'ok', output: stdout };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

    return { status: 'ok', output: stdout };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── YOLOv8 Object Detection via Vision service ──────────────────────────
ipcMain.handle('vision:detect-objects', async (_, args) => {
  try {
    await startPythonService('opencv');
    const response = await fetch(`${OPENCV_SERVICE_URL}/detect-objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Real-ESRGAN Texture Upscaling IPC Handlers ──────────────────────────
// GitHub: https://github.com/xinntao/Real-ESRGAN
// HuggingFace: https://huggingface.co/nateraw/real-esrgan
ipcMain.handle('esrgan:health-check', async () => {
  try {
    await startPythonService('esrgan');
    const response = await fetch(`${ESRGAN_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('esrgan:list-models', async () => {
  try {
    await startPythonService('esrgan');
    const response = await fetch(`${ESRGAN_SERVICE_URL}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('esrgan:upscale', async (_, args) => {
  try {
    await startPythonService('esrgan');
    const response = await fetch(`${ESRGAN_SERVICE_URL}/upscale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(180000), // upscaling can be slow on CPU
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('esrgan:upscale-batch', async (_, args) => {
  try {
    await startPythonService('esrgan');
    const response = await fetch(`${ESRGAN_SERVICE_URL}/upscale-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(600000), // batch can be very slow
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── WolvenKit CLI Automation IPC Handlers ──────────────────────────────
// GitHub: https://github.com/WolvenKit/WolvenKit
// Automates Cyberpunk 2077 and Witcher 3 mod workflows
ipcMain.handle('wolvenkit:health-check', async () => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:set-cli-path', async (_, { path: cliPath }) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/set-cli-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cliPath }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:extract', async (_, args) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:pack', async (_, args) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:convert', async (_, args) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:export', async (_, args) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('wolvenkit:search', async (_, args) => {
  try {
    await startPythonService('wolvenkit');
    const response = await fetch(`${WOLVENKIT_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── RTX Remix REST API IPC Handlers ─────────────────────────────────────
// GitHub: https://github.com/NVIDIAGameWorks/rtx-remix (MIT License)
// RTX Remix Toolkit exposes a local REST API when running.
// Default port is 8011; adjust if your RTX Remix uses a different port.
const RTX_REMIX_URL = 'http://127.0.0.1:8011';

ipcMain.handle('rtxremix:health-check', async () => {
  try {
    const response = await fetch(`${RTX_REMIX_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { status: 'healthy', ...(await response.json()) };
  } catch (err) { return { status: 'offline', message: 'RTX Remix Toolkit not running. Launch it from NVIDIA App or start it manually.' }; }
});

ipcMain.handle('rtxremix:list-assets', async () => {
  try {
    const response = await fetch(`${RTX_REMIX_URL}/assets`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('rtxremix:replace-asset', async (_, args) => {
  try {
    const response = await fetch(`${RTX_REMIX_URL}/assets/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

ipcMain.handle('rtxremix:capture-scene', async () => {
  try {
    const response = await fetch(`${RTX_REMIX_URL}/capture`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Fallout 4 Modding IPC Handlers ──────────────────────────────────────
// ── FO4Edit / xEdit conflict detection ──────────────────────────────────
ipcMain.handle('fo4edit:health-check', async () => {
  try { await startPythonService('fo4edit'); return await (await fetch(`${FO4EDIT_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fo4edit:set-path', async (_, args) => {
  try { await startPythonService('fo4edit'); return await (await fetch(`${FO4EDIT_SERVICE_URL}/set-path`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fo4edit:check-conflicts', async (_, args) => {
  try { await startPythonService('fo4edit'); const r = await fetch(`${FO4EDIT_SERVICE_URL}/check-conflicts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(120000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fo4edit:get-records', async (_, args) => {
  try { await startPythonService('fo4edit'); return await (await fetch(`${FO4EDIT_SERVICE_URL}/get-records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── BA2 / BSA Archive Handler ────────────────────────────────────────────
ipcMain.handle('ba2:health-check', async () => {
  try { await startPythonService('ba2'); return await (await fetch(`${BA2_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ba2:inspect', async (_, args) => {
  try { await startPythonService('ba2'); return await (await fetch(`${BA2_SERVICE_URL}/inspect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ba2:extract', async (_, args) => {
  try { await startPythonService('ba2'); const r = await fetch(`${BA2_SERVICE_URL}/extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(300000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ba2:create', async (_, args) => {
  try { await startPythonService('ba2'); const r = await fetch(`${BA2_SERVICE_URL}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(300000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('ba2:get-archive2-path', async () => {
  try { await startPythonService('ba2'); return await (await fetch(`${BA2_SERVICE_URL}/archive2-path`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── Papyrus Script Compiler / Validator ──────────────────────────────────
ipcMain.handle('papyrus:health-check', async () => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:compile', async (_, args) => {
  try { await startPythonService('papyrus'); const r = await fetch(`${PAPYRUS_SERVICE_URL}/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(60000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:validate', async (_, args) => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:generate-template', async (_, args) => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/generate-template`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:common-events', async () => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/common-events`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:snippet-library', async () => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/snippet-library`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('papyrus:set-compiler-path', async (_, args) => {
  try { await startPythonService('papyrus'); return await (await fetch(`${PAPYRUS_SERVICE_URL}/set-compiler-path`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── FOMOD Installer Builder ───────────────────────────────────────────────
ipcMain.handle('fomod:health-check', async () => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fomod:create-installer', async (_, args) => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/create-installer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fomod:validate', async (_, args) => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fomod:parse', async (_, args) => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fomod:templates', async () => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/templates`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fomod:ai-generate', async (_, args) => {
  try { await startPythonService('fomod'); return await (await fetch(`${FOMOD_SERVICE_URL}/ai-generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── fo4edit — new endpoints (construct parser, graph analysis, header diff) ──
ipcMain.handle('fo4edit:scan-record-types', async (_, args) => {
  try { await startPythonService('fo4edit'); return await (await fetch(`${FO4EDIT_SERVICE_URL}/scan-record-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fo4edit:diff-headers', async (_, args) => {
  try { await startPythonService('fo4edit'); return await (await fetch(`${FO4EDIT_SERVICE_URL}/diff-headers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fo4edit:analyze-load-order-graph', async (_, args) => {
  try { await startPythonService('fo4edit'); const r = await fetch(`${FO4EDIT_SERVICE_URL}/analyze-load-order-graph`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(60000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── ba2 — 7z extraction via py7zr ─────────────────────────────────────────
ipcMain.handle('ba2:extract-7z', async (_, args) => {
  try { await startPythonService('ba2'); const r = await fetch(`${BA2_SERVICE_URL}/extract-7z`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(300000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── f4se — C++ plugin scaffolder (Jinja2 templates, port 8016) ───────────
ipcMain.handle('f4se:health-check', async () => {
  try { await startPythonService('f4se'); return await (await fetch(`${F4SE_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('f4se:scaffold', async (_, args) => {
  try { await startPythonService('f4se'); return await (await fetch(`${F4SE_SERVICE_URL}/scaffold`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('f4se:hook-catalog', async () => {
  try { await startPythonService('f4se'); return await (await fetch(`${F4SE_SERVICE_URL}/hook-catalog`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('f4se:templates', async () => {
  try { await startPythonService('f4se'); return await (await fetch(`${F4SE_SERVICE_URL}/templates`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── cell-editor — Blender round-trip cell editing (port 8017) ────────────
ipcMain.handle('cell-editor:health-check', async () => {
  try { await startPythonService('cell-editor'); return await (await fetch(`${CELL_EDITOR_SERVICE_URL}/health`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('cell-editor:list-cells', async (_, args) => {
  try { await startPythonService('cell-editor'); return await (await fetch(`${CELL_EDITOR_SERVICE_URL}/list-cells`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('cell-editor:extract-cell', async (_, args) => {
  try { await startPythonService('cell-editor'); const r = await fetch(`${CELL_EDITOR_SERVICE_URL}/extract-cell`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(60000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('cell-editor:generate-patch-esp', async (_, args) => {
  try { await startPythonService('cell-editor'); const r = await fetch(`${CELL_EDITOR_SERVICE_URL}/generate-patch-esp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(60000) }); return await r.json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('cell-editor:blender-addon', async () => {
  try { await startPythonService('cell-editor'); return await (await fetch(`${CELL_EDITOR_SERVICE_URL}/blender-addon`)).json(); }
  catch (err) { return { status: 'error', message: String(err) }; }
});

// ── File / directory dialog helpers ───────────────────────────────────────
const { dialog } = require('electron');
ipcMain.handle('dialog:open-file', async (_, { title, filters } = {}) => {
  const result = await dialog.showOpenDialog({ title: title || 'Open File', filters: filters || [], properties: ['openFile'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('dialog:open-directory', async (_, { title } = {}) => {
  const result = await dialog.showOpenDialog({ title: title || 'Select Folder', properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('dialog:save-file', async (_, { title, defaultPath, filters } = {}) => {
  const result = await dialog.showSaveDialog({ title: title || 'Save File', defaultPath, filters: filters || [] });
  return result.canceled ? null : result.filePath;
});

// ── File read/write helpers (used by CellEditor and other tools) ──────────
ipcMain.handle('fs:read-text-file', async (_, { path: filePath }) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return { status: 'ok', content };
  } catch (err) { return { status: 'error', message: String(err) }; }
});
ipcMain.handle('fs:write-text-file', async (_, { path: filePath, content }) => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { status: 'ok' };
  } catch (err) { return { status: 'error', message: String(err) }; }
});

// ── System Tray ───────────────────────────────────────────────────────────
function createTray() {
  let icon;
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
    else icon = icon.resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Mossy AI Assistant — Always Active');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Show Mossy',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Run at Startup',
      type: 'checkbox',
      checked: getAutoLaunch(),
      click: (item) => {
        setAutoLaunch(item.checked);
        // Rebuild to reflect new state
        tray.setContextMenu(buildMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Mossy',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(buildMenu());

  // Single click: toggle window visibility
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Double-click: always show and focus
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ── Main window ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Mossy AI Assistant',
    backgroundColor: '#050910',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
  });

  // ── Content Security Policy ─────────────────────────────────────────────
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "media-src 'self' blob:",
            "connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com http://localhost:11434 http://127.0.0.1:11434 http://localhost:3000 http://localhost:21337 http://127.0.0.1:21337 http://localhost:8000 http://127.0.0.1:8000 http://localhost:8001 http://127.0.0.1:8001 http://localhost:8002 http://127.0.0.1:8002 http://localhost:8003 http://127.0.0.1:8003 http://localhost:8004 http://127.0.0.1:8004 http://localhost:8005 http://127.0.0.1:8005 http://localhost:8006 http://127.0.0.1:8006 http://localhost:8007 http://127.0.0.1:8007 http://localhost:8008 http://127.0.0.1:8008 http://localhost:8009 http://127.0.0.1:8009 http://localhost:8010 http://127.0.0.1:8010 http://localhost:8011 http://127.0.0.1:8011 http://localhost:8012 http://127.0.0.1:8012 http://localhost:8013 http://127.0.0.1:8013 http://localhost:8014 http://127.0.0.1:8014 http://localhost:8015 http://127.0.0.1:8015 http://localhost:8016 http://127.0.0.1:8016 http://localhost:8017 http://127.0.0.1:8017 https://api.steampowered.com https://api.nexusmods.com https://search.nexusmods.com wss://generativelanguage.googleapis.com",
            "worker-src 'self' blob:",
          ].join('; '),
        ],
      },
    });
  });

  // If launched with --hidden (auto-start at login), don't show until clicked
  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) mainWindow.show();
  });

  // Close button → hide to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ── Session Journal IPC ───────────────────────────────────────────────────
const os = require('os');
const MOSSY_DATA_ROOT_COMPUTED = process.platform === 'win32'
  ? 'D:\\Mossy-AI'
  : path.join(os.homedir(), 'Mossy-AI');
const JOURNAL_PATH = path.join(
  process.env.MOSSY_DATA_ROOT || MOSSY_DATA_ROOT_COMPUTED,
  'journal.md'
);

ipcMain.handle('journal:write-entry', async (_, { summary, timestamp }) => {
  try {
    await fs.promises.mkdir(path.dirname(JOURNAL_PATH), { recursive: true });
    const line = `\n---\n### ${timestamp}\n${summary}\n`;
    await fs.promises.appendFile(JOURNAL_PATH, line, 'utf8');
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: String(err) };
  }
});

ipcMain.handle('journal:read-last', async (_, n = 5) => {
  try {
    const content = await fs.promises.readFile(JOURNAL_PATH, 'utf8');
    const parts = content.split('\n---\n').filter(e => e.trim().length > 0);
    return { status: 'ok', entries: parts.slice(-(n)) };
  } catch {
    return { status: 'ok', entries: [] };
  }
});

// ── Clipboard Monitor ─────────────────────────────────────────────────────
let _lastClipboardText = '';

function startClipboardMonitor() {
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const text = clipboard.readText();
      // Skip empty clips and avoid processing very large clipboard content
      if (!text || text === _lastClipboardText || text.length > 50000) return;
      _lastClipboardText = text;
      mainWindow.webContents.send('clipboard:changed', text);
    } catch {}
  }, 4000);
}

// ── Folder Watcher IPC ────────────────────────────────────────────────────
const _watchHandles = new Map();

ipcMain.handle('watcher:set-folders', async (_, folders) => {
  for (const w of _watchHandles.values()) {
    try { w.close(); } catch {}
  }
  _watchHandles.clear();

  for (const folder of (folders || [])) {
    try {
      const w = fs.watch(folder, { recursive: true }, (event, filename) => {
        if (!filename || !mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send('watcher:file-change', { folder, filename, event });
      });
      _watchHandles.set(folder, w);
    } catch (e) {
      console.error(`[Watcher] Cannot watch ${folder}:`, e.message);
    }
  }
  return { status: 'ok', watching: Array.from(_watchHandles.keys()) };
});

ipcMain.handle('watcher:get-folders', () => Array.from(_watchHandles.keys()));

// ── Hardware / GPU Sensors IPC ────────────────────────────────────────────
ipcMain.handle('system:gpu-sensors', () => {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      [
        '--query-gpu=temperature.gpu,memory.used,memory.total,utilization.gpu',
        '--format=csv,noheader,nounits',
      ],
      { timeout: 5000 },
      (err, stdout) => {
        if (!err && stdout.trim()) {
          const parts = stdout.trim().split(/,\s*/);
          resolve({
            status: 'ok',
            gpu_temp:        parseInt(parts[0]) || null,
            gpu_mem_used_mb: parseInt(parts[1]) || null,
            gpu_mem_total_mb: parseInt(parts[2]) || null,
            gpu_util_pct:    parseInt(parts[3]) || null,
          });
        } else {
          resolve({ status: 'ok', gpu_temp: null, error: 'nvidia-smi unavailable' });
        }
      }
    );
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────
app.on('before-quit', () => {
  app.isQuitting = true;
  stopPythonServices();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    startClipboardMonitor();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Keep running in tray — do NOT quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep the app alive in the dock/tray as expected
  // On Windows/Linux, also keep alive (we have a tray)
  // Only quit when user explicitly selects "Quit Mossy" from tray
});
