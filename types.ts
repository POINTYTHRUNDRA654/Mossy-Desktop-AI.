export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isThinking?: boolean;
  images?: string[];
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export enum AppMode {
  CHAT = 'chat',
  LIVE = 'live',
  IMAGE = 'image',
  TTS = 'tts',
  SYSTEM = 'system'
}

// ── Electron bridge types ────────────────────────────────────────────────────

export interface ElectronBridge {
  platform: string;
  isElectron: boolean;
  versions: { electron: string; chrome: string; node: string };
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enable: boolean) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  hideToTray: () => Promise<void>;
  scanDirectory: (base: string, opts?: Record<string, unknown>) => Promise<unknown>;
}

export interface ElectronAPI {
  ipcInvoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  gemmaHealthCheck:    () => Promise<unknown>;
  gemmaRunInference:   (req: unknown) => Promise<unknown>;
  gemmaStartFineTune:  (cfg: unknown) => Promise<unknown>;
  gemmaFineTuneStatus: (jobId: string) => Promise<unknown>;
  gemmaListModels:     () => Promise<unknown>;
  gemmaLoadModel:      (name: string) => Promise<unknown>;
  gemmaLoadModelAdv:   (req: unknown) => Promise<unknown>;
  gemmaChain:          (req: unknown) => Promise<unknown>;
  gemmaRagQuery:       (req: unknown) => Promise<unknown>;
  gemmaAddDocuments:   (docs: unknown) => Promise<unknown>;
  gemmaChainOfThought: (req: unknown) => Promise<unknown>;
  gemmaPlan:           (req: unknown) => Promise<unknown>;
  gemmaReflect:        (req: unknown) => Promise<unknown>;
  gemmaToolsExecute:   (req: unknown) => Promise<unknown>;
  gemmaMemoryGet:      () => Promise<unknown>;
  gemmaMemoryAdd:      (req: unknown) => Promise<unknown>;
  gemmaMemoryDelete:   (key: string) => Promise<unknown>;
  gemmaMemoryClear:    () => Promise<unknown>;
  gemmaWebSearch:      (req: unknown) => Promise<unknown>;
  gemmaConfig:         () => Promise<unknown>;
  // Journal
  journalWriteEntry:   (entry: { summary: string; timestamp: string }) => Promise<unknown>;
  journalReadLast:     (n?: number) => Promise<unknown>;
  // Folder Watcher
  watcherSetFolders:   (folders: string[]) => Promise<unknown>;
  watcherGetFolders:   () => Promise<unknown>;
  // Hardware Sensors
  gpuSensors:          () => Promise<unknown>;
  // Push-event subscriptions (return cleanup fn)
  onClipboardChange:   (cb: (text: string) => void) => () => void;
  onFileChange:        (cb: (data: { folder: string; filename: string; event: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronBridge?: ElectronBridge;
    electronAPI?: ElectronAPI;
  }
}
