'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ── Safe desktop bridge ────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronBridge', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome:   process.versions.chrome,
    node:     process.versions.node,
  },
  // Auto-launch at OS startup
  getAutoLaunch: ()             => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enable)       => ipcRenderer.invoke('set-auto-launch', enable),
  // Window controls
  minimizeWindow: ()            => ipcRenderer.invoke('window-minimize'),
  hideToTray:     ()            => ipcRenderer.invoke('window-hide'),
  // Desktop Bridge scanning (restricted to D:)
  scanDirectory:  (base, opts)  => ipcRenderer.invoke('bridge-scan', { base, ...opts }),
});

// ── General IPC invoke (used by intelligence components) ──────────────────
// Components call:  window.electronAPI.ipcInvoke('gemma:chain', payload)
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic passthrough — channel whitelist enforced here for security
  ipcInvoke: (channel, ...args) => {
    const ALLOWED = new Set([
      // Gemma / Brain
      'gemma:health-check',
      'gemma:run-inference',
      'gemma:start-fine-tune',
      'gemma:fine-tune-status',
      'gemma:list-models',
      'gemma:load-model',
      'gemma:load-model-advanced',
      'gemma:chain',
      'gemma:rag-query',
      'gemma:add-documents',
      'gemma:chain-of-thought',
      'gemma:plan',
      'gemma:reflect',
      'gemma:tools-execute',
      'gemma:memory-get',
      'gemma:memory-add',
      'gemma:memory-delete',
      'gemma:memory-clear',
      'gemma:web-search',
      'gemma:config',
      // PyTorch
      'pytorch:health-check',
      'pytorch:load-model',
      'pytorch:infer',
      'pytorch:list-loaded-models',
      'pytorch:discover-models',
      'pytorch:system-info',
      // Whisper
      'whisper:health-check',
      'whisper:transcribe',
      'whisper:set-model',
      'whisper:list-models',
      // Chroma
      'chroma:health-check',
      'chroma:add-document',
      'chroma:search',
      'chroma:delete-document',
      'chroma:clear',
      // Multi-agent
      'agent:discover',
      'agent:query',
      'agent:knowledge-search',
      'agent:knowledge-add',
      'agent:validate-answer',
      'agent:get-stats',
      'agent:trigger-improvement',
      'agent:get-learning-history',
      // System
      'system:detect-tools',
      'bridge-scan',
      // Journal
      'journal:write-entry',
      'journal:read-last',
      // Folder Watcher
      'watcher:set-folders',
      'watcher:get-folders',
      // Hardware sensors
      'system:gpu-sensors',
      // Vision (OpenCV)
      'vision:health-check',
      'vision:screenshot',
      'vision:analyze-hud',
      'vision:ocr-text',
      'vision:detect-game-state',
      // Piper TTS
      'piper:health-check',
      'piper:voices',
      'piper:synthesize',
      // TripoSR 3D
      'triposr:health-check',
      'triposr:generate-mesh',
      'triposr:outputs',
      // RVC Voice
      'rvc:health-check',
      'rvc:models',
      'rvc:convert',
      'rvc:train-model',
      'rvc:training-status',
      // Ollama Code Gen
      'ollama:health-check',
      'ollama:code-gen',
      'ollama:list-models',
      // Steam
      'steam:get-library',
      'steam:get-achievements',
      'steam:get-recent',
      'steam:get-player',
      // Nexus Mods
      'nexus:search',
      'nexus:get-mod',
      'nexus:trending',
      // LOOT
      'loot:analyze',
      'loot:sort',
    ]);
    if (!ALLOWED.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // ── Named convenience helpers (used by Gemma4FineTuner, ReasoningChain, etc.) ──
  gemmaHealthCheck:      ()       => ipcRenderer.invoke('gemma:health-check'),
  gemmaRunInference:     (req)    => ipcRenderer.invoke('gemma:run-inference', req),
  gemmaStartFineTune:    (cfg)    => ipcRenderer.invoke('gemma:start-fine-tune', cfg),
  gemmaFineTuneStatus:   (jobId)  => ipcRenderer.invoke('gemma:fine-tune-status', jobId),
  gemmaListModels:       ()       => ipcRenderer.invoke('gemma:list-models'),
  gemmaLoadModel:        (name)   => ipcRenderer.invoke('gemma:load-model', name),
  gemmaLoadModelAdv:     (req)    => ipcRenderer.invoke('gemma:load-model-advanced', req),
  gemmaChain:            (req)    => ipcRenderer.invoke('gemma:chain', req),
  gemmaRagQuery:         (req)    => ipcRenderer.invoke('gemma:rag-query', req),
  gemmaAddDocuments:     (docs)   => ipcRenderer.invoke('gemma:add-documents', docs),
  gemmaChainOfThought:   (req)    => ipcRenderer.invoke('gemma:chain-of-thought', req),
  gemmaPlan:             (req)    => ipcRenderer.invoke('gemma:plan', req),
  gemmaReflect:          (req)    => ipcRenderer.invoke('gemma:reflect', req),
  gemmaToolsExecute:     (req)    => ipcRenderer.invoke('gemma:tools-execute', req),
  gemmaMemoryGet:        ()       => ipcRenderer.invoke('gemma:memory-get'),
  gemmaMemoryAdd:        (req)    => ipcRenderer.invoke('gemma:memory-add', req),
  gemmaMemoryDelete:     (key)    => ipcRenderer.invoke('gemma:memory-delete', key),
  gemmaMemoryClear:      ()       => ipcRenderer.invoke('gemma:memory-clear'),
  gemmaWebSearch:        (req)    => ipcRenderer.invoke('gemma:web-search', req),
  gemmaConfig:           ()       => ipcRenderer.invoke('gemma:config'),

  // ── Journal ───────────────────────────────────────────────────────────
  journalWriteEntry: (entry)  => ipcRenderer.invoke('journal:write-entry', entry),
  journalReadLast:   (n)      => ipcRenderer.invoke('journal:read-last', n),

  // ── Folder Watcher ────────────────────────────────────────────────────
  watcherSetFolders: (folders) => ipcRenderer.invoke('watcher:set-folders', folders),
  watcherGetFolders: ()        => ipcRenderer.invoke('watcher:get-folders'),

  // ── Hardware Sensors ─────────────────────────────────────────────────
  gpuSensors: () => ipcRenderer.invoke('system:gpu-sensors'),

  // ── Push-event subscriptions (renderer ← main) ───────────────────────
  // Returns an unsubscribe function.
  onClipboardChange: (cb) => {
    const handler = (_, text) => cb(text);
    ipcRenderer.on('clipboard:changed', handler);
    return () => ipcRenderer.removeListener('clipboard:changed', handler);
  },
  onFileChange: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('watcher:file-change', handler);
    return () => ipcRenderer.removeListener('watcher:file-change', handler);
  },
});

