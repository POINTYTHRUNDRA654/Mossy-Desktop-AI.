import React, { useState, useEffect } from 'react';
import { Archive, Search, Download, Upload, FolderOpen, RefreshCw, CheckCircle, AlertCircle, ChevronRight, File } from 'lucide-react';

interface ArchiveInfo { status: string; format?: string; archive_type?: string; file_count?: number; total_size_bytes?: number; files?: {name: string; size: number; compressed: boolean}[]; message?: string; }

const BA2Browser: React.FC = () => {
  const [archivePath, setArchivePath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [archiveInfo, setArchiveInfo] = useState<ArchiveInfo | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState('');
  const [health, setHealth] = useState(false);
  // Create archive state
  const [createInput, setCreateInput] = useState('');
  const [createOutput, setCreateOutput] = useState('');
  const [createType, setCreateType] = useState<'general'|'textures'>('general');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { checkHealth(); }, []);

  const checkHealth = async () => {
    try { const r = await window.electronAPI?.ipcInvoke('ba2:health-check'); setHealth(r?.status === 'healthy'); } catch { setHealth(false); }
  };

  const inspect = async () => {
    if (!archivePath) return;
    setLoading(true); setError(''); setArchiveInfo(null); setResult('');
    try {
      const r = await window.electronAPI?.ipcInvoke('ba2:inspect', { archive_path: archivePath });
      if (r?.status === 'ok' || r?.file_count !== undefined) setArchiveInfo(r);
      else setError(r?.message || 'Inspection failed');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const extract = async () => {
    if (!archivePath || !outputDir) { setError('Provide both archive path and output directory.'); return; }
    setExtracting(true); setError(''); setResult('');
    try {
      const r = await window.electronAPI?.ipcInvoke('ba2:extract', { archive_path: archivePath, output_dir: outputDir });
      if (r?.status === 'ok') setResult(`✓ Extracted ${r.extracted_count ?? '?'} files to ${r.output_dir}`);
      else setError(r?.message || 'Extraction failed');
    } catch (e: any) { setError(String(e)); }
    setExtracting(false);
  };

  const create = async () => {
    if (!createInput || !createOutput) { setError('Provide input directory and output path.'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const r = await window.electronAPI?.ipcInvoke('ba2:create', { input_dir: createInput, output_path: createOutput, archive_type: createType });
      if (r?.status === 'ok') setResult(`✓ Created archive with ${r.file_count ?? '?'} files`);
      else setError(r?.message || 'Creation failed');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const filteredFiles = archiveInfo?.files?.filter(f => !filter || f.name.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const fmtBytes = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : b > 1e3 ? `${(b/1e3).toFixed(0)} KB` : `${b} B`;
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500';

  return (
    <div className="h-full flex flex-col bg-forge-dark overflow-hidden">
      <div className="p-5 border-b border-slate-700 bg-forge-panel flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30"><Archive className="w-5 h-5 text-amber-400" /></div>
          <div><h2 className="text-lg font-bold text-white">BA2 / BSA Archive Browser</h2><p className="text-xs text-slate-400 font-mono">Fallout 4 BA2 · Skyrim BSA · Extract &amp; Create</p></div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${health ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${health ? 'bg-emerald-500' : 'bg-red-500'}`}/>{health ? 'Ready' : 'Offline'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-4 overflow-y-auto">
          <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Archive Path (.ba2 / .bsa)</label>
            <input className={inp} value={archivePath} onChange={e=>setArchivePath(e.target.value)} placeholder="D:\Fallout4\Data\Fallout4 - Textures1.ba2"/>
            <button onClick={inspect} disabled={loading||!archivePath} className="mt-2 w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors">
              {loading?<RefreshCw className="w-3 h-3 animate-spin"/>:<Search className="w-3 h-3"/>} Inspect Archive
            </button>
          </div>
          <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Output Directory</label>
            <input className={inp} value={outputDir} onChange={e=>setOutputDir(e.target.value)} placeholder="D:\Extracted\"/>
            <button onClick={extract} disabled={extracting||!archivePath||!outputDir} className="mt-2 w-full py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors">
              {extracting?<RefreshCw className="w-3 h-3 animate-spin"/>:<Download className="w-3 h-3"/>} Extract All
            </button>
          </div>
          <button onClick={()=>setShowCreate(!showCreate)} className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors py-1">
            <span className="font-bold uppercase tracking-widest">Create Archive</span><ChevronRight className={`w-3.5 h-3.5 transition-transform ${showCreate?'rotate-90':''}`}/>
          </button>
          {showCreate && (<div className="space-y-2">
            <input className={inp} value={createInput} onChange={e=>setCreateInput(e.target.value)} placeholder="Input directory"/>
            <input className={inp} value={createOutput} onChange={e=>setCreateOutput(e.target.value)} placeholder="Output .ba2 path"/>
            <select value={createType} onChange={e=>setCreateType(e.target.value as any)} className={inp}>
              <option value="general">General (meshes/scripts)</option><option value="textures">Textures (DX10)</option>
            </select>
            <button onClick={create} disabled={loading} className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors">
              {loading?<RefreshCw className="w-3 h-3 animate-spin"/>:<Upload className="w-3 h-3"/>} Create BA2
            </button>
          </div>)}
        </div>

        <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
          {archiveInfo && archiveInfo.status !== 'error' && (
            <div className="bg-forge-panel border border-slate-700 rounded-xl p-4">
              <div className="flex gap-3 mb-3 flex-wrap">
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs rounded font-bold">{(archiveInfo.format||'').toUpperCase()}</span>
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs rounded font-bold">{archiveInfo.archive_type||'UNKNOWN'}</span>
                <span className="text-xs text-slate-400">{archiveInfo.file_count?.toLocaleString()} files · {fmtBytes(archiveInfo.total_size_bytes||0)}</span>
              </div>
              <input className={inp + ' mb-3'} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter files…"/>
              <div className="bg-slate-900 rounded-lg max-h-96 overflow-y-auto divide-y divide-slate-800">
                {filteredFiles.slice(0,500).map((f,i)=>(
                  <div key={i} className="flex justify-between items-center px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-1.5 truncate"><File className="w-3 h-3 text-slate-500 shrink-0"/><span className="text-slate-300 truncate font-mono">{f.name}</span></div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {f.compressed && <span className="text-emerald-500 text-[10px]">cmp</span>}
                      <span className="text-slate-500">{fmtBytes(f.size)}</span>
                    </div>
                  </div>
                ))}
                {filteredFiles.length > 500 && <div className="px-3 py-2 text-xs text-slate-500">…and {filteredFiles.length-500} more</div>}
              </div>
            </div>
          )}
          {result && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"><CheckCircle className="w-4 h-4 text-emerald-400 shrink-0"/><p className="text-xs text-emerald-300">{result}</p></div>}
          {error && <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5"/><p className="text-xs text-red-300">{error}</p></div>}
          {!archiveInfo && !error && !result && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
              <Archive className="w-12 h-12 opacity-30"/>
              <p className="text-sm">Enter a .ba2 or .bsa path and click Inspect</p>
              <p className="text-xs text-slate-700">Fallout 4 archives: <span className="font-mono text-slate-600">Fallout4\Data\*.ba2</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default BA2Browser;
