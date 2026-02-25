'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer process.
// Follows Electron's security best practices:
//   contextIsolation: true, nodeIntegration: false, sandbox: true
contextBridge.exposeInMainWorld('electronBridge', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // Auto-launch at OS startup
  getAutoLaunch: ()         => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enable)   => ipcRenderer.invoke('set-auto-launch', enable),
  // Window controls
  minimizeWindow: ()        => ipcRenderer.invoke('window-minimize'),
  hideToTray:     ()        => ipcRenderer.invoke('window-hide'),
  // Desktop Bridge scanning (restricted to D:)
  scanDirectory:  (base, options) => ipcRenderer.invoke('bridge-scan', { base, ...options }),
});
