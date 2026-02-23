'use strict';

const { app, BrowserWindow, shell, session, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:3000';

let mainWindow = null;
let tray = null;

// Track whether we are doing a real quit vs. close-to-tray
app.isQuitting = false;

// ── Auto-launch at OS startup ──────────────────────────────────────────────
function setAutoLaunch(enable) {
  if (process.platform === 'linux') return; // Linux handled per-distro
  app.setLoginItemSettings({
    openAtLogin: enable,
    name: 'Mossy AI Assistant',
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
            "connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com http://localhost:11434 http://127.0.0.1:11434 http://localhost:3000 http://localhost:21337 http://127.0.0.1:21337 wss://generativelanguage.googleapis.com",
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
app.on('before-quit', () => { app.isQuitting = true; });

// Single-instance enforcement
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
