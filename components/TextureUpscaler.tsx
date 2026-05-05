import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Upload, Download, RefreshCw, CheckCircle, AlertCircle, Layers, Cpu, ExternalLink, Image as ImageIcon, ZoomIn } from 'lucide-react';

interface EsrganModel {
  name: string;
  scale: number;
  description: string;
  downloaded: boolean;
  hf_repo: string;
  hf_file: string;
}

interface UpscaleResult {
  status: string;
  image_base64?: string;
  format?: string;
  original_size?: { w: number; h: number };
  upscaled_size?: { w: number; h: number };
  scale_used?: number;
  model_used?: string;
  processing_time_sec?: number;
  device?: string;
  message?: string;
}

const TextureUpscaler: React.FC = () => {
  const [serviceHealth, setServiceHealth] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [models, setModels] = useState<EsrganModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('RealESRGAN_x4plus');
  const [scale, setScale] = useState(4);
  const [outputFormat, setOutputFormat] = useState<'PNG' | 'JPEG'>('PNG');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputFileName, setInputFileName] = useState('');
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const r = await window.electronAPI?.ipcInvoke('esrgan:health-check');
      setServiceHealth(r?.status === 'healthy' ? 'healthy' : 'error');
      if (r?.status === 'healthy') loadModels();
    } catch {
      setServiceHealth('error');
    }
  };

  const loadModels = async () => {
    try {
      const r = await window.electronAPI?.ipcInvoke('esrgan:list-models');
      if (r?.models) setModels(r.models);
    } catch {}
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInputFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:image/...;base64," prefix
      const b64 = dataUrl.split(',')[1];
      setInputImage(b64);
      setResult(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleUpscale = async () => {
    if (!inputImage) { setError('Please select an image first.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await window.electronAPI?.ipcInvoke('esrgan:upscale', {
        image_base64: inputImage,
        model: selectedModel,
        scale,
        output_format: outputFormat,
      });
      if (r?.status === 'ok') {
        setResult(r);
      } else {
        setError(r?.message || 'Upscaling failed');
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.image_base64) return;
    const mimeType = outputFormat === 'JPEG' ? 'image/jpeg' : 'image/png';
    const ext = outputFormat.toLowerCase();
    const baseName = inputFileName.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = `data:${mimeType};base64,${result.image_base64}`;
    a.download = `${baseName}_${scale}x_upscaled.${ext}`;
    a.click();
  };

  const statusColor = serviceHealth === 'healthy' ? 'bg-emerald-500' : serviceHealth === 'error' ? 'bg-red-500' : 'bg-slate-600';

  return (
    <div className="h-full flex flex-col bg-forge-dark overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 bg-forge-panel flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-violet-500/20 rounded-xl border border-violet-500/30">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Texture Upscaler
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">Real-ESRGAN</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">AI 2×–4× upscaling · <a href="https://github.com/xinntao/Real-ESRGAN" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">GitHub</a> · <a href="https://huggingface.co/nateraw/real-esrgan" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">HuggingFace</a></p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-600 text-xs text-slate-300">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          {serviceHealth === 'healthy' ? 'Service Ready' : serviceHealth === 'error' ? 'Service Offline' : 'Checking...'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Controls */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Model selector */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Model</label>
            {models.length > 0 ? (
              <div className="space-y-2">
                {models.map(m => (
                  <button
                    key={m.name}
                    onClick={() => { setSelectedModel(m.name); setScale(m.scale); }}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedModel === m.name
                        ? 'bg-violet-500/20 border-violet-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-bold text-xs flex justify-between">
                      <span>{m.name}</span>
                      <span className="text-violet-400">{m.scale}×</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.description}</div>
                    {!m.downloaded && (
                      <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                        <Download className="w-3 h-3" /> Auto-downloads on first use
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {['RealESRGAN_x4plus', 'RealESRGAN_x2plus', 'RealESRGAN_x4plus_anime_6B'].map(name => (
                  <button key={name} onClick={() => setSelectedModel(name)}
                    className={`w-full p-3 rounded-lg border text-left text-xs ${selectedModel === name ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scale */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Scale Factor: <span className="text-white">{scale}×</span>
            </label>
            <div className="flex gap-2">
              {[2, 4].map(s => (
                <button key={s} onClick={() => setScale(s)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${scale === s ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Output format */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Output Format</label>
            <div className="flex gap-2">
              {(['PNG', 'JPEG'] as const).map(fmt => (
                <button key={fmt} onClick={() => setOutputFormat(fmt)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${outputFormat === fmt ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Install note */}
          {serviceHealth === 'error' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              <p className="font-bold mb-1">Service offline</p>
              <p className="text-slate-400 mb-2">Install Real-ESRGAN to enable GPU texture upscaling:</p>
              <code className="block bg-slate-900 px-2 py-1 rounded text-emerald-400 text-[10px]">
                pip install realesrgan basicsr facexlib gfpgan huggingface_hub
              </code>
              <a href="https://github.com/xinntao/Real-ESRGAN" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-violet-400 hover:underline mt-2">
                <ExternalLink className="w-3 h-3" /> GitHub: xinntao/Real-ESRGAN
              </a>
            </div>
          )}
        </div>

        {/* Right: Main content */}
        <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-violet-500/60 rounded-xl p-8 text-center cursor-pointer transition-colors group"
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            {inputImage ? (
              <div className="space-y-2">
                <img src={`data:image/png;base64,${inputImage}`} alt="Input" className="max-h-48 mx-auto rounded-lg shadow-lg" />
                <p className="text-xs text-slate-400">{inputFileName} — click to change</p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-600 group-hover:text-violet-400 mx-auto mb-3 transition-colors" />
                <p className="text-slate-300 font-bold">Drop a game texture here</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPEG, DDS (converted via Pillow)</p>
              </>
            )}
          </div>

          {/* Upscale button */}
          <button
            onClick={handleUpscale}
            disabled={!inputImage || loading || serviceHealth !== 'healthy'}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? `Upscaling ${scale}× (may take 10–120s)…` : `Upscale ${scale}× with ${selectedModel}`}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result?.status === 'ok' && result.image_base64 && (
            <div className="bg-forge-panel border border-slate-700 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Upscaled Successfully</span>
                </div>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-bold transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>

              <img
                src={`data:image/${outputFormat.toLowerCase()};base64,${result.image_base64}`}
                alt="Upscaled"
                className="max-h-72 mx-auto rounded-lg shadow-lg mb-3"
              />

              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Original', value: result.original_size ? `${result.original_size.w}×${result.original_size.h}` : '—' },
                  { label: 'Upscaled', value: result.upscaled_size ? `${result.upscaled_size.w}×${result.upscaled_size.h}` : '—' },
                  { label: 'Time', value: result.processing_time_sec ? `${result.processing_time_sec}s` : '—' },
                  { label: 'Scale', value: `${result.scale_used}×` },
                  { label: 'Model', value: result.model_used?.replace('RealESRGAN_', '') || '—' },
                  { label: 'Device', value: result.device?.toUpperCase() || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-900 rounded-lg p-2 text-center">
                    <div className="text-slate-500 text-[10px]">{label}</div>
                    <div className="text-white font-bold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextureUpscaler;
