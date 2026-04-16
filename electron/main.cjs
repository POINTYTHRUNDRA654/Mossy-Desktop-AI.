'use strict';

const { app, BrowserWindow, shell, session, Tray, Menu, nativeImage, ipcMain } = require('electron');
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
    'chroma': { var: () => chromaProcess, set: (p) => { chromaProcess = p; }, script: 'chroma_service.py' }
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
            "connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com http://localhost:11434 http://127.0.0.1:11434 http://localhost:3000 http://localhost:21337 http://127.0.0.1:21337 http://localhost:8000 http://127.0.0.1:8000 http://localhost:8001 http://127.0.0.1:8001 http://localhost:8002 http://127.0.0.1:8002 http://localhost:8003 http://127.0.0.1:8003 http://localhost:8004 http://127.0.0.1:8004 wss://generativelanguage.googleapis.com",
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

// ── Lifecycle ─────────────────────────────────────────────────────────────
app.on('before-quit', () => {
  app.isQuitting = true;
  stopPythonServices();
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
