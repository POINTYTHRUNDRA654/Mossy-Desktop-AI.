import React, { useState, useEffect, useRef } from 'react';
import { Layers3, Upload, RefreshCw, Download, AlertCircle, Box } from 'lucide-react';

const RESOLUTIONS = [64, 128, 256];

interface MeshResult {
  mesh_base64: string;
  format: string;
  vertex_count: number;
  face_count: number;
  generation_time: number;
  status: string;
  message?: string;
}

interface OutputFile {
  name: string;
  path: string;
  size_bytes: number;
}

const AssetForge3D: React.FC = () => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'obj' | 'glb'>('obj');
  const [resolution, setResolution] = useState(128);
  const [result, setResult] = useState<MeshResult | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { checkService(); loadOutputs(); }, []);

  const checkService = async () => {
    const r = await window.electronAPI?.ipcInvoke('triposr:health-check');
    setServiceStatus(r?.status === 'healthy' ? 'healthy' : 'error');
  };

  const loadOutputs = async () => {
    const r = await window.electronAPI?.ipcInvoke('triposr:outputs');
    if (r?.status === 'ok') setOutputs(r.files || []);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) handleFile(file);
  };

  const generate = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setResult(null);
    const r = await window.electronAPI?.ipcInvoke('triposr:generate-mesh', {
      image_base64: imageBase64,
      output_format: outputFormat,
      resolution,
    });
    setLoading(false);
    setResult(r || null);
    if (r?.status === 'ok' || r?.status === 'stub') loadOutputs();
  };

  const downloadMesh = () => {
    if (!result?.mesh_base64) return;
    const binary = atob(result.mesh_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesh_${Date.now()}.${result.format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Layers3 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">3D Asset Forge</h1>
          <p className="text-slate-400 text-xs">TripoSR mesh generation · Port 8007</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${serviceStatus === 'healthy' ? 'bg-emerald-500' : serviceStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">{serviceStatus === 'healthy' ? 'Service Online' : 'Service Offline'}</span>
          <button onClick={checkService} className="p-1 hover:bg-slate-700 rounded">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Image Upload */}
      <div
        className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-600 hover:border-slate-500'}`}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Drop image here or click to upload</p>
            <p className="text-xs text-slate-600 mt-1">PNG or JPG · Single object on clean background works best</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Output Format</label>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value as 'obj' | 'glb')} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
            <option value="obj">OBJ (Blender / Universal)</option>
            <option value="glb">GLB (Three.js / Godot)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Resolution: {resolution}</label>
          <input type="range" min={64} max={256} step={64} value={resolution} onChange={e => setResolution(parseInt(e.target.value))} className="w-full accent-emerald-500 mt-2" />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            {RESOLUTIONS.map(r => <span key={r}>{r}</span>)}
          </div>
        </div>
      </div>

      <button
        onClick={generate}
        disabled={!imageBase64 || loading}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors mb-6"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
        {loading ? 'Generating 3D Mesh...' : 'Generate 3D Mesh'}
      </button>

      {/* Result */}
      {result && (
        <div className={`mb-4 p-4 rounded-xl border ${result.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/40 border-slate-700'}`}>
          {result.status === 'stub' && (
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">{result.message}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-slate-900 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{result.vertex_count?.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Vertices</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{result.face_count?.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Faces</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-400">{result.generation_time?.toFixed(2)}s</div>
              <div className="text-[10px] text-slate-500">Gen Time</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadMesh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
              <Download className="w-3.5 h-3.5" /> Download .{result.format}
            </button>
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 text-xs">
              <span>Blender: <code className="text-slate-300 font-mono">File → Import → Wavefront (.obj)</code></span>
            </div>
          </div>
        </div>
      )}

      {/* Previously generated */}
      {outputs.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-2">Previously Generated ({outputs.length})</p>
          <div className="space-y-1">
            {outputs.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700">
                <Box className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-300 flex-1 truncate">{f.name}</span>
                <span className="text-[10px] text-slate-500">{(f.size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetForge3D;
