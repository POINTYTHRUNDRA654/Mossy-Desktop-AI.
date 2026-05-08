import React, { useState, useEffect, useRef } from 'react';
import { Image, Download, Upload, Save, AlertCircle, Loader2, X } from 'lucide-react';

interface PhotopeaConfig {
  files?: string[];
  resources?: string[];
  server?: {
    version: number;
    url: string;
    formats: string[];
  };
  apis?: Record<string, string>;
  script?: string;
}

interface FileItem {
  name: string;
  url: string;
  type: 'file' | 'resource';
}

const PhotopeaEditor: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initPhotopea();
    setupMessageListener();
    loadSavedFiles();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const setupMessageListener = () => {
    window.addEventListener('message', handleMessage);
  };

  const handleMessage = (event: MessageEvent) => {
    // Verify origin for security
    if (event.origin !== 'https://www.photopea.com') return;

    console.log('Message from Photopea:', event.data);

    if (event.data.type === 'ready') {
      setStatus('ready');
      console.log('Photopea is ready');
    } else if (event.data.type === 'save') {
      console.log('File saved:', event.data);
      handleFileSaved(event.data);
    } else if (event.data.type === 'error') {
      setStatus('error');
      console.error('Photopea error:', event.data.message);
    }
  };

  const handleFileSaved = async (data: any) => {
    try {
      setLoading(true);
      
      // Send to backend server for saving
      const response = await fetch('/api/photopea/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: data.source,
          versions: data.versions,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSavedFiles([...savedFiles, result.filename]);
        setStatus('ready');
      } else {
        throw new Error('Failed to save file');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const initPhotopea = () => {
    setStatus('loading');
    const config: PhotopeaConfig = {
      server: {
        version: 1,
        url: '/api/photopea/save',
        formats: ['psd', 'png', 'jpg:0.8', 'webp'],
      },
      apis: {
        // Add your API keys here
      },
    };

    // Encode configuration
    const configString = encodeURIComponent(JSON.stringify(config));
    const photopeaUrl = `https://www.photopea.com#${configString}`;

    if (iframeRef.current) {
      iframeRef.current.src = photopeaUrl;
    }
  };

  const loadSavedFiles = async () => {
    try {
      const response = await fetch('/api/photopea/saved-files');
      if (response.ok) {
        const data = await response.json();
        setSavedFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error loading saved files:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      openFileInPhotopea(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  const openFileInPhotopea = (dataUrl: string, filename: string) => {
    if (!iframeRef.current?.contentWindow) return;

    const config: PhotopeaConfig = {
      files: [dataUrl],
      server: {
        version: 1,
        url: '/api/photopea/save',
        formats: ['psd', 'png', 'jpg:0.8', 'webp'],
      },
    };

    const configString = encodeURIComponent(JSON.stringify(config));
    const photopeaUrl = `https://www.photopea.com#${configString}`;

    iframeRef.current.src = photopeaUrl;
  };

  const triggerFileSave = () => {
    if (!iframeRef.current?.contentWindow) return;

    // Send message to Photopea to trigger save
    iframeRef.current.contentWindow.postMessage(
      { type: 'save' },
      'https://www.photopea.com'
    );
  };

  const triggerFileOpen = () => {
    if (!iframeRef.current?.contentWindow) return;

    // Send message to Photopea to trigger file open dialog
    iframeRef.current.contentWindow.postMessage(
      { type: 'openFile' },
      'https://www.photopea.com'
    );
  };

  const downloadFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/photopea/download/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050910]">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Image className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Photopea Editor</h1>
              <p className="text-slate-400 text-xs">Professional image and design editor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'loading' && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Error</span>
              </div>
            )}
            {status === 'ready' && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">Ready</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-slate-700/50 bg-slate-900/30 px-6 py-3 flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status !== 'ready'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm">Open File</span>
        </button>

        <button
          onClick={triggerFileSave}
          disabled={status !== 'ready' || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 hover:text-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="text-sm">Save</span>
        </button>

        <button
          onClick={() => setShowFileDialog(!showFileDialog)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm">Files ({savedFiles.length})</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.psd,.psb"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Photopea iframe */}
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          allowFullScreen
          title="Photopea Editor"
        />
      </div>

      {/* Saved Files Panel */}
      {showFileDialog && (
        <div className="absolute bottom-0 right-0 w-80 h-96 bg-slate-900 border border-slate-700 rounded-t-lg shadow-2xl flex flex-col z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">Saved Files</h3>
            <button
              onClick={() => setShowFileDialog(false)}
              className="p-1 hover:bg-slate-800 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {savedFiles.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                No saved files yet
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {savedFiles.map((file) => (
                  <div
                    key={file}
                    className="px-4 py-3 hover:bg-slate-800/50 flex items-center justify-between group"
                  >
                    <span className="text-sm text-slate-300 truncate">{file}</span>
                    <button
                      onClick={() => downloadFile(file)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-blue-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotopeaEditor;
