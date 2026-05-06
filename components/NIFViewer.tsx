import React, { useState } from 'react';
import { FolderOpen, Search, Layers, Image, Box, ChevronRight, Download, AlertCircle } from 'lucide-react';

interface NifBlock { index: number; type: string; name: string; }
interface NifResult {
  status: string;
  file?: string;
  file_size?: number;
  block_count?: number;
  blocks?: NifBlock[];
  textures?: string[];
  vertex_total?: number;
  triangle_total?: number;
  library?: string;
  message?: string;
}

const eb = () => (window as any).electronBridge as any;
const fmt = (n: number) => n.toLocaleString();

const NIFViewer: React.FC = () => {
  const [nifPath, setNifPath] = useState('');
  const [result, setResult] = useState<NifResult | null>(null);
  const [nifList, setNifList] = useState<any[]>([]);
  const [scanDir, setScanDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inspect'|'scan'|'export'>('inspect');
  const [exportDir, setExportDir] = useState('');
  const [exportResult, setExportResult] = useState<any>(null);
  const [filterType, setFilterType] = useState('');

  const browse = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-file', {
      title: 'Select NIF File',
      filters: [{ name: 'NIF Mesh Files', extensions: ['nif'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (p) { setNifPath(p); inspectFile(p); }
  };

  const inspectFile = async (path?: string) => {
    const p = path || nifPath;
    if (!p) return;
    setLoading(true);
    setResult(null);
    const r = await eb()?.ipcInvoke?.('nif:inspect', { nif_path: p });
    setResult(r);
    setLoading(false);
  };

  const scanDirectory = async () => {
    if (!scanDir) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('nif:find-nifs', { directory: scanDir, max_files: 500 });
    setNifList(r?.nif_files || []);
    setLoading(false);
  };

  const exportObj = async () => {
    if (!nifPath || !exportDir) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('nif:export-obj', { nif_path: nifPath, output_dir: exportDir });
    setExportResult(r);
    setLoading(false);
  };

  const browseScanDir = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-directory', { title: 'Select NIF Directory' });
    if (p) { setScanDir(p); }
  };

  const browseExportDir = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-directory', { title: 'Select OBJ Export Folder' });
    if (p) setExportDir(p);
  };

  const filteredBlocks = result?.blocks?.filter(b =>
    !filterType || b.type.toLowerCase().includes(filterType.toLowerCase())
  ) || [];

  return (
    <div className="h-full flex flex-col bg-[#050910] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Box className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">NIF Viewer</h1>
          <p className="text-xs text-slate-500">Bethesda NIF mesh inspector — blocks, textures, geometry stats</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-800 flex gap-0">
        {(['inspect', 'scan', 'export'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

        {/* ── Inspect tab ── */}
        {activeTab === 'inspect' && (
          <div className="space-y-5">
            <div className="flex gap-2">
              <input value={nifPath} onChange={e => setNifPath(e.target.value)} placeholder="Path to .nif file…"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono" />
              <button onClick={browse} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors">
                <FolderOpen className="w-4 h-4" />
              </button>
              <button onClick={() => inspectFile()} disabled={!nifPath || loading}
                className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                {loading ? 'Scanning…' : 'Inspect'}
              </button>
            </div>

            {result?.status === 'error' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {result.message}
              </div>
            )}

            {result?.status === 'ok' && (
              <>
                {/* Stats bar */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Blocks', value: fmt(result.block_count ?? 0), color: 'text-blue-400' },
                    { label: 'Vertices', value: fmt(result.vertex_total ?? 0), color: 'text-emerald-400' },
                    { label: 'Triangles', value: fmt(result.triangle_total ?? 0), color: 'text-purple-400' },
                    { label: 'Textures', value: fmt(result.textures?.length ?? 0), color: 'text-amber-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-slate-600">
                  {result.file} — {(result.file_size! / 1024).toFixed(1)} KB — parsed with <span className="text-blue-400">{result.library}</span>
                </div>

                {/* Texture paths */}
                {result.textures && result.textures.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400">Texture References ({result.textures.length})</span>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      {result.textures.map((tex, i) => (
                        <div key={i} className="text-xs font-mono text-slate-400 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700/50">{tex}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Block tree */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400">Block Tree ({result.block_count})</span>
                    <input value={filterType} onChange={e => setFilterType(e.target.value)} placeholder="Filter by type…"
                      className="ml-auto px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-400 focus:outline-none focus:border-blue-500/50 w-36" />
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                    {filteredBlocks.map(block => (
                      <div key={block.index} className="flex items-center gap-3 px-3 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800/70">
                        <span className="text-[10px] text-slate-600 w-6 shrink-0">{block.index}</span>
                        <span className="text-[11px] font-mono text-blue-300 w-40 shrink-0 truncate">{block.type}</span>
                        <span className="text-[11px] font-mono text-slate-500 truncate">{block.name || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Scan tab ── */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input value={scanDir} onChange={e => setScanDir(e.target.value)} placeholder="Directory to scan for NIF files…"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono" />
              <button onClick={browseScanDir} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors">
                <FolderOpen className="w-4 h-4" />
              </button>
              <button onClick={scanDirectory} disabled={!scanDir || loading}
                className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                {loading ? 'Scanning…' : 'Scan'}
              </button>
            </div>
            {nifList.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Found {nifList.length} NIF files</div>
                <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {nifList.map((f, i) => (
                    <div key={i} onClick={() => { setNifPath(f.path); setActiveTab('inspect'); inspectFile(f.path); }}
                      className="flex items-center gap-3 px-3 py-2 rounded bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer group">
                      <Box className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs font-mono text-slate-300 flex-1 truncate">{f.relative}</span>
                      <span className="text-xs text-slate-600">{(f.size / 1024).toFixed(0)} KB</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Export tab ── */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 text-xs text-slate-400">
              Export the geometry from a NIF file to OBJ format for import into Blender.
              Requires <span className="text-blue-300 font-mono">pyffi</span> to be installed.
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={nifPath} onChange={e => setNifPath(e.target.value)} placeholder="Source NIF file…"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono" />
                <button onClick={browse} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600">
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input value={exportDir} onChange={e => setExportDir(e.target.value)} placeholder="Output folder…"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 font-mono" />
                <button onClick={browseExportDir} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600">
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              <button onClick={exportObj} disabled={!nifPath || !exportDir || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />
                {loading ? 'Exporting…' : 'Export to OBJ'}
              </button>
              {exportResult && (
                <div className={`p-3 rounded-lg border text-sm ${exportResult.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {exportResult.status === 'ok'
                    ? `✓ Exported ${fmt(exportResult.vertex_count)} vertices, ${fmt(exportResult.face_count)} faces → ${exportResult.output_path}`
                    : (exportResult.message || 'Export failed')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NIFViewer;
