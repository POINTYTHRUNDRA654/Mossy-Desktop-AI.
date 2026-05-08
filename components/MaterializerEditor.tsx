import React, { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Download, Save, AlertCircle, Loader2, X, RefreshCw, Sparkles } from 'lucide-react';

interface MaterializerConfig {
  input_format?: string;
  output_formats?: string[];
  generation_mode?: 'pbr' | 'diffuse' | 'normal' | 'roughness' | 'metallic' | 'ao';
  ai_enhance?: boolean;
}

interface GeneratedTexture {
  id: string;
  name: string;
  format: string;
  size: number;
  generated_at: string;
  mode: string;
}

interface MaterialPreset {
  name: string;
  type: string;
  description: string;
}

const MaterializerEditor: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedTextures, setGeneratedTextures] = useState<GeneratedTexture[]>([]);
  const [generationMode, setGenerationMode] = useState<'pbr' | 'diffuse' | 'normal' | 'roughness' | 'metallic' | 'ao'>('pbr');
  const [aiEnhance, setAiEnhance] = useState(true);
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkService();
    loadPresets();
  }, []);

  const checkService = async () => {
    try {
      const response = await fetch('/api/materializer/health');
      if (response.ok) {
        setStatus('ready');
      }
    } catch (err) {
      console.error('Materializer service error:', err);
      setStatus('error');
    }
  };

  const loadPresets = async () => {
    try {
      const response = await fetch('/api/materializer/presets');
      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets || []);
      }
    } catch (err) {
      console.error('Error loading presets:', err);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setSelectedFile(file);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const generateTextures = async () => {
    if (!selectedFile) {
      setError('Please select an image file first');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', generationMode);
    formData.append('ai_enhance', aiEnhance.toString());
    if (selectedPreset) {
      formData.append('preset', selectedPreset);
    }

    try {
      const response = await fetch('/api/materializer/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate textures');
      }

      const data = await response.json();
      setGeneratedTextures(data.textures || []);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const downloadTexture = async (textureId: string) => {
    try {
      const response = await fetch(`/api/materializer/download/${textureId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `texture_${textureId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download texture');
    }
  };

  const downloadAll = async () => {
    try {
      const response = await fetch('/api/materializer/download-all');
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `textures_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download textures');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050910] overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Palette className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NVIDIA Materializer</h1>
              <p className="text-slate-400 text-xs">AI-powered texture generation and material creation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'processing' && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border-b border-red-500/30 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-300">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Input & Settings */}
        <div className="w-96 border-r border-slate-700/50 flex flex-col overflow-y-auto custom-scrollbar">
          {/* File Upload */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="block text-sm font-semibold text-white mb-4">Source Image</label>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-cyan-500 hover:bg-cyan-500/5 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="Preview" className="w-full h-32 object-cover rounded" />
                  <p className="text-xs text-slate-300">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-sm text-slate-300">Drop image or click to upload</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
          </div>

          {/* Generation Mode */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="block text-sm font-semibold text-white mb-3">Generation Mode</label>
            <div className="space-y-2">
              {['pbr', 'diffuse', 'normal', 'roughness', 'metallic', 'ao'].map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    checked={generationMode === mode as any}
                    onChange={(e) => setGenerationMode(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiEnhance}
                onChange={(e) => setAiEnhance(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">AI Enhancement</span>
            </label>
          </div>

          {/* Presets */}
          <div className="p-6 border-b border-slate-700/50">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Material Presets ({presets.length})</span>
            </button>
            {showPresets && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setSelectedPreset(preset.name);
                      setShowPresets(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedPreset === preset.name
                        ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-300'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-slate-400">{preset.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="p-6">
            <button
              onClick={generateTextures}
              disabled={!selectedFile || loading || status !== 'ready'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Textures</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Generated Textures</h2>
            {generatedTextures.length > 0 && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 hover:text-green-200 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
            )}
          </div>

          {generatedTextures.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No textures generated yet</p>
                <p className="text-xs mt-1">Upload an image and click "Generate Textures"</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-2 gap-4">
              {generatedTextures.map((texture) => (
                <div
                  key={texture.id}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
                >
                  <div className="p-3 pb-0">
                    <div className="text-sm font-medium text-white truncate">{texture.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {texture.mode} • {(texture.size / 1024 / 1024).toFixed(2)}MB
                    </div>
                  </div>
                  <div className="p-3 flex gap-2">
                    <button
                      onClick={() => downloadTexture(texture.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterializerEditor;
