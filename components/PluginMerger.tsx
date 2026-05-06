import React, { useState } from 'react';
import { Plus, Trash2, GitMerge, AlertTriangle, CheckCircle, FolderOpen, ChevronRight, XCircle, Loader2, FileCode2 } from 'lucide-react';

interface PluginInfo { path: string; name: string; }
interface AnalyzeResult {
  plugins_analysed?: number;
  total_unique_records?: number;
  conflict_count?: number;
  conflicts_sample?: { form_id: string; in_plugins: string[]; conflict_type: string }[];
  plugin_summary?: { plugin: string; records: number; masters: string[] }[];
  merge_safe?: boolean;
  recommendation?: string;
}
interface MergeResult {
  status: string;
  output_path?: string;
  merged_record_count?: number;
  masters_included?: string[];
  plugins_merged?: number;
  file_size?: number;
  message?: string;
}

const eb = () => (window as any).electronBridge as any;
const fmt = (n: number) => n.toLocaleString();

const PluginMerger: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [outputDir, setOutputDir] = useState('');
  const [outputName, setOutputName] = useState('MossyMerged.esp');
  const [activeTab, setActiveTab] = useState<'plugins'|'conflicts'|'merge'>('plugins');

  const addPlugin = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-file', {
      title: 'Select Plugin',
      filters: [
        { name: 'Bethesda Plugins', extensions: ['esp', 'esm', 'esl'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (p && !plugins.find(pl => pl.path === p)) {
      setPlugins(prev => [...prev, { path: p, name: p.split(/[\\/]/).pop() || p }]);
    }
  };

  const removePlugin = (path: string) => {
    setPlugins(prev => prev.filter(p => p.path !== path));
    setAnalyzeResult(null);
    setMergeResult(null);
  };

  const movePlugin = (idx: number, dir: -1 | 1) => {
    const next = [...plugins];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPlugins(next);
  };

  const analyze = async () => {
    if (plugins.length < 2) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    const r = await eb()?.ipcInvoke?.('merger:analyze', { plugin_paths: plugins.map(p => p.path) });
    if (r?.status === 'ok') {
      setAnalyzeResult(r);
      setActiveTab('conflicts');
    }
    setAnalyzing(false);
  };

  const browseOutputDir = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-directory', { title: 'Select Output Folder' });
    if (p) setOutputDir(p);
  };

  const doMerge = async () => {
    if (plugins.length < 2 || !outputDir) return;
    setMerging(true);
    setMergeResult(null);
    const outputPath = `${outputDir}\\${outputName}`;
    const r = await eb()?.ipcInvoke?.('merger:merge', {
      plugin_paths: plugins.map(p => p.path),
      output_path: outputPath,
      merged_plugin_name: outputName,
    });
    setMergeResult(r);
    if (r?.status === 'ok') setActiveTab('merge');
    setMerging(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#050910] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
          <GitMerge className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Plugin Merger</h1>
          <p className="text-xs text-slate-500">Merge ESP/ESM/ESL plugins — reduce load order below 255</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={analyze} disabled={plugins.length < 2 || analyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-xs hover:bg-purple-600/30 transition-colors disabled:opacity-40">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Analyze
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-800 flex gap-0">
        {(['plugins', 'conflicts', 'merge'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${activeTab === t ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t} {t === 'plugins' && plugins.length > 0 ? `(${plugins.length})` : ''}
            {t === 'conflicts' && analyzeResult ? ` (${analyzeResult.conflict_count ?? 0})` : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

        {/* ── Plugins tab ── */}
        {activeTab === 'plugins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Add plugins in load order — last plugin wins on conflicting records.</p>
              <button onClick={addPlugin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-xs hover:bg-purple-600/30 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Plugin
              </button>
            </div>

            {plugins.length === 0 ? (
              <div className="text-center py-16 text-slate-700">
                <FileCode2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-sm">No plugins added yet</p>
                <button onClick={addPlugin} className="mt-3 text-xs text-purple-400 hover:text-purple-300">
                  Add your first plugin →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {plugins.map((plugin, i) => (
                  <div key={plugin.path} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700 hover:border-slate-600 group">
                    <span className="text-xs text-slate-600 w-5 text-center font-mono">{i + 1}</span>
                    <FileCode2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-300 flex-1 truncate">{plugin.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => movePlugin(i, -1)} disabled={i === 0}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs">↑</button>
                      <button onClick={() => movePlugin(i, 1)} disabled={i === plugins.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs">↓</button>
                      <button onClick={() => removePlugin(plugin.path)} className="p-1 rounded text-red-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {plugins.length >= 2 && (
              <button onClick={analyze} disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                {analyzing ? 'Analyzing…' : `Analyze ${plugins.length} Plugins`}
              </button>
            )}
          </div>
        )}

        {/* ── Conflicts tab ── */}
        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            {!analyzeResult ? (
              <div className="text-center text-slate-600 py-16">
                <p className="text-sm">Run Analyze first to see conflict data</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Plugins', value: analyzeResult.plugins_analysed ?? 0, color: 'text-purple-400' },
                    { label: 'Unique Records', value: fmt(analyzeResult.total_unique_records ?? 0), color: 'text-blue-400' },
                    { label: 'Conflicts', value: fmt(analyzeResult.conflict_count ?? 0), color: analyzeResult.conflict_count! > 0 ? 'text-amber-400' : 'text-emerald-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${analyzeResult.merge_safe ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                  {analyzeResult.merge_safe ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {analyzeResult.recommendation}
                </div>

                {/* Plugin summary */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2">Plugin Summary</div>
                  {(analyzeResult.plugin_summary || []).map(p => (
                    <div key={p.plugin} className="flex items-center gap-3 px-3 py-2 rounded bg-slate-800/40 mb-1">
                      <FileCode2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-xs font-mono text-slate-300 flex-1 truncate">{p.plugin}</span>
                      <span className="text-xs text-slate-500">{fmt(p.records)} records</span>
                    </div>
                  ))}
                </div>

                {/* Conflicts list */}
                {(analyzeResult.conflicts_sample || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">
                      Conflicting Records {analyzeResult.conflict_count! > 100 ? '(first 100)' : ''}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                      {analyzeResult.conflicts_sample!.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded bg-slate-800/30 hover:bg-slate-800/60">
                          <span className="text-xs font-mono text-amber-400 w-24 shrink-0">{c.form_id}</span>
                          <span className="text-xs text-slate-500">{c.in_plugins.join(' → ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setActiveTab('merge')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
                  <GitMerge className="w-4 h-4" /> Proceed to Merge →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Merge tab ── */}
        {activeTab === 'merge' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Output Filename</label>
                <input value={outputName} onChange={e => setOutputName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 font-mono focus:outline-none focus:border-purple-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Output Folder</label>
                <div className="flex gap-2">
                  <input value={outputDir} onChange={e => setOutputDir(e.target.value)} placeholder="Select output folder…"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 font-mono focus:outline-none focus:border-purple-500/50" />
                  <button onClick={browseOutputDir} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600">
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 text-xs text-slate-500 space-y-1">
              <div>• Merging <span className="text-purple-300">{plugins.length} plugins</span></div>
              <div>• Last plugin wins on conflicting records (standard override semantics)</div>
              <div>• Output will list all source plugins as masters</div>
              <div>• A backup is <em>not</em> made of source plugins — keep originals</div>
            </div>

            <button onClick={doMerge} disabled={plugins.length < 2 || !outputDir || merging}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors disabled:opacity-40">
              {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
              {merging ? 'Merging…' : `Merge ${plugins.length} Plugins`}
            </button>

            {mergeResult && (
              <div className={`p-4 rounded-xl border space-y-2 ${mergeResult.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                {mergeResult.status === 'ok' ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle className="w-4 h-4" /> Merge Complete
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>Output: <span className="font-mono text-slate-300">{mergeResult.output_path}</span></div>
                      <div>Records merged: <span className="text-emerald-300">{fmt(mergeResult.merged_record_count ?? 0)}</span></div>
                      <div>File size: <span className="text-emerald-300">{((mergeResult.file_size ?? 0) / 1024).toFixed(1)} KB</span></div>
                      <div>Masters required: {(mergeResult.masters_included || []).join(', ')}</div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" /> {mergeResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginMerger;
