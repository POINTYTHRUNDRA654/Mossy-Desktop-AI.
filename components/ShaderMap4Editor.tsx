import React, { useState, useEffect, useRef } from 'react';
import { Zap, Upload, Download, Save, AlertCircle, Loader2, X, RefreshCw, Wand2 } from 'lucide-react';

interface ShaderMapConfig {
  input_format?: string;
  output_formats?: string[];
  shader_type?: 'pbr' | 'standard' | 'custom' | 'substance';
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
}

interface GeneratedShader {
  id: string;
  name: string;
  type: string;
  size: number;
  generated_at: string;
  quality: string;
  preview?: string;
}

interface ShaderTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  category: string;
}

const ShaderMap4Editor: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedShaders, setGeneratedShaders] = useState<GeneratedShader[]>([]);
  const [shaderType, setShaderType] = useState<'pbr' | 'standard' | 'custom' | 'substance'>('pbr');
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high' | 'ultra'>('high');
  const [templates, setTemplates] = useState<ShaderTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShader, setSelectedShader] = useState<GeneratedShader | null>(null);

  useEffect(() => {
    checkService();
    loadTemplates();
  }, []);

  const checkService = async () => {
    try {
      const response = await fetch('/api/shadermap4/health');
      if (response.ok) {
        setStatus('ready');
      }
    } catch (err) {
      console.error('ShaderMap4 service error:', err);
      setStatus('error');
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/shadermap4/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
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

  const generateShaders = async () => {
    if (!selectedFile) {
      setError('Please select an image file first');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('type', shaderType);
    formData.append('quality', quality);
    if (selectedTemplate) {
      formData.append('template', selectedTemplate);
    }

    try {
      const response = await fetch('/api/shadermap4/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate shaders');
      }

      const data = await response.json();
      setGeneratedShaders(data.shaders || []);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const downloadShader = async (shaderId: string) => {
    try {
      const response = await fetch(`/api/shadermap4/download/${shaderId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shader_${shaderId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download shader');
    }
  };

  const downloadAll = async () => {
    try {
      const response = await fetch('/api/shadermap4/download-all');
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shaders_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download shaders');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050910] overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ShaderMap 4</h1>
              <p className="text-slate-400 text-xs">Professional shader and material node authoring</p>
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
              className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-amber-500 hover:bg-amber-500/5 transition-colors cursor-pointer"
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

          {/* Shader Type */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="block text-sm font-semibold text-white mb-3">Shader Type</label>
            <div className="space-y-2">
              {['pbr', 'standard', 'custom', 'substance'].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={shaderType === type as any}
                    onChange={(e) => setShaderType(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="block text-sm font-semibold text-white mb-3">Quality Level</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
            >
              <option value="draft">Draft (Fast)</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="ultra">Ultra (Slow)</option>
            </select>
          </div>

          {/* Templates */}
          <div className="p-6 border-b border-slate-700/50">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-sm">Shader Templates ({templates.length})</span>
            </button>
            {showTemplates && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setShowTemplates(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedTemplate === template.id
                        ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-slate-400">{template.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="p-6">
            <button
              onClick={generateShaders}
              disabled={!selectedFile || loading || status !== 'ready'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Shaders</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Generated Shaders</h2>
            {generatedShaders.length > 0 && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 hover:text-green-200 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
            )}
          </div>

          {generatedShaders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No shaders generated yet</p>
                <p className="text-xs mt-1">Upload an image and click "Generate Shaders"</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {selectedShader ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedShader(null)}
                    className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    ← Back to list
                  </button>
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{selectedShader.name}</h3>
                    {selectedShader.preview && (
                      <img
                        src={selectedShader.preview}
                        alt="Shader preview"
                        className="w-full h-64 object-cover rounded-lg mb-4"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-400">Type</p>
                        <p className="text-sm text-white capitalize">{selectedShader.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Quality</p>
                        <p className="text-sm text-white capitalize">{selectedShader.quality}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Size</p>
                        <p className="text-sm text-white">{(selectedShader.size / 1024).toFixed(2)}KB</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Generated</p>
                        <p className="text-sm text-white">{new Date(selectedShader.generated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadShader(selectedShader.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Shader
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {generatedShaders.map((shader) => (
                    <button
                      key={shader.id}
                      onClick={() => setSelectedShader(shader)}
                      className="text-left bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-white">{shader.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {shader.type} • {shader.quality}
                          </div>
                        </div>
                        <Zap className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-xs text-slate-500">{(shader.size / 1024).toFixed(2)}KB</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShaderMap4Editor;
