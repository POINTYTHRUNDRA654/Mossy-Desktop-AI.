import React, { useState, useEffect } from 'react';
import { Package, FolderOpen, Download, Upload, Search, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Settings, Layers, FileCode, Archive } from 'lucide-react';

type Tab = 'extract' | 'pack' | 'convert' | 'export' | 'search';

interface CliResult {
  status: string;
  message?: string;
  stdout?: string;
  stderr?: string;
  files_extracted?: number;
  matches?: string[];
  match_count?: number;
  cli_path?: string;
}

const WolvenKitPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('extract');
  const [serviceHealth, setServiceHealth] = useState<{ found: boolean; path: string | null } | null>(null);
  const [cliPath, setCliPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CliResult | null>(null);
  const [error, setError] = useState('');

  // Extract fields
  const [archivePath, setArchivePath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [pattern, setPattern] = useState('');

  // Pack fields
  const [packInputDir, setPackInputDir] = useState('');
  const [packOutputPath, setPackOutputPath] = useState('');

  // Convert fields
  const [convertInput, setConvertInput] = useState('');
  const [convertOutput, setConvertOutput] = useState('');
  const [convertFormat, setConvertFormat] = useState('json');

  // Export fields
  const [exportInput, setExportInput] = useState('');
  const [exportOutput, setExportOutput] = useState('');
  const [exportFormat, setExportFormat] = useState('GLB');

  // Search fields
  const [searchDir, setSearchDir] = useState('');
  const [searchPattern, setSearchPattern] = useState('*.mesh');

  useEffect(() => { checkHealth(); }, []);

  const checkHealth = async () => {
    try {
      const r = await window.electronAPI?.ipcInvoke('wolvenkit:health-check');
      setServiceHealth({ found: r?.cli_found, path: r?.cli_path });
    } catch { setServiceHealth({ found: false, path: null }); }
  };

  const saveCliPath = async () => {
    if (!cliPath) return;
    setLoading(true);
    try {
      const r = await window.electronAPI?.ipcInvoke('wolvenkit:set-cli-path', { path: cliPath });
      if (r?.status === 'ok') { await checkHealth(); setError(''); }
      else setError(r?.message || 'Failed to save path');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let r: CliResult;
      if (activeTab === 'extract') {
        r = await window.electronAPI?.ipcInvoke('wolvenkit:extract', { archive_path: archivePath, output_dir: outputDir, pattern: pattern || undefined });
      } else if (activeTab === 'pack') {
        r = await window.electronAPI?.ipcInvoke('wolvenkit:pack', { input_dir: packInputDir, output_path: packOutputPath });
      } else if (activeTab === 'convert') {
        r = await window.electronAPI?.ipcInvoke('wolvenkit:convert', { input_path: convertInput, output_dir: convertOutput, format: convertFormat });
      } else if (activeTab === 'export') {
        r = await window.electronAPI?.ipcInvoke('wolvenkit:export', { input_path: exportInput, output_dir: exportOutput, export_format: exportFormat });
      } else {
        r = await window.electronAPI?.ipcInvoke('wolvenkit:search', { archive_dir: searchDir, pattern: searchPattern });
      }
      if (r?.status === 'ok') setResult(r);
      else setError(r?.message || r?.stderr || 'Operation failed');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'extract', label: 'Extract', icon: Archive },
    { id: 'pack',    label: 'Pack',    icon: Upload },
    { id: 'convert', label: 'Convert', icon: FileCode },
    { id: 'export',  label: 'Export',  icon: Download },
    { id: 'search',  label: 'Search',  icon: Search },
  ];

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500';
  const labelCls = 'text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block';

  return (
    <div className="h-full flex flex-col bg-forge-dark overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 bg-forge-panel flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30">
            <Package className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              WolvenKit Automation
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">REDengine</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Cyberpunk 2077 &amp; Witcher 3 modding ·{' '}
              <a href="https://github.com/WolvenKit/WolvenKit" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">
                WolvenKit/WolvenKit
              </a>
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${serviceHealth?.found ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${serviceHealth?.found ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {serviceHealth?.found ? 'CLI Found' : 'CLI Not Found'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* CLI Path */}
          <div>
            <label className={labelCls}>WolvenKit CLI Path</label>
            <input value={serviceHealth?.path || cliPath} onChange={e => setCliPath(e.target.value)}
              className={inputCls} placeholder="C:\WolvenKit\WolvenKit.CLI.exe" />
            {!serviceHealth?.path && (
              <button onClick={saveCliPath} disabled={!cliPath || loading}
                className="mt-2 w-full py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors">
                <Settings className="w-3 h-3" /> Save Path
              </button>
            )}
            {serviceHealth?.path && (
              <p className="text-[10px] text-emerald-400 mt-1 truncate">✓ {serviceHealth.path}</p>
            )}
          </div>

          {/* Install instructions */}
          {!serviceHealth?.found && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              <p className="font-bold mb-1">WolvenKit CLI not found</p>
              <p className="text-slate-400 mb-2">Download from GitHub Releases:</p>
              <a href="https://github.com/WolvenKit/WolvenKit/releases" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-red-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> WolvenKit Releases
              </a>
            </div>
          )}

          {/* Supported games */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-xs font-bold text-slate-400 mb-2">Supported Games</p>
            <div className="space-y-1">
              {[
                { name: 'Cyberpunk 2077', engine: 'REDengine 4', color: 'text-yellow-400' },
                { name: 'The Witcher 3', engine: 'REDengine 3', color: 'text-blue-400' },
              ].map(g => (
                <div key={g.name} className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${g.color}`}>{g.name}</span>
                  <span className="text-[10px] text-slate-500">{g.engine}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tab nav */}
          <div className="space-y-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === t.id ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Extract */}
          {activeTab === 'extract' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-base">Extract .archive</h3>
              <div><label className={labelCls}>Archive Path</label><input className={inputCls} value={archivePath} onChange={e => setArchivePath(e.target.value)} placeholder="D:\Cyberpunk2077\archive\pc\content\basegame_2_mainmenu.archive" /></div>
              <div><label className={labelCls}>Output Directory</label><input className={inputCls} value={outputDir} onChange={e => setOutputDir(e.target.value)} placeholder="D:\ModWorkspace\extracted\" /></div>
              <div><label className={labelCls}>File Pattern (optional)</label><input className={inputCls} value={pattern} onChange={e => setPattern(e.target.value)} placeholder="*.mesh" /></div>
            </div>
          )}

          {/* Pack */}
          {activeTab === 'pack' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-base">Pack Mod Directory → .archive</h3>
              <div><label className={labelCls}>Input Mod Directory</label><input className={inputCls} value={packInputDir} onChange={e => setPackInputDir(e.target.value)} placeholder="D:\ModWorkspace\MyMod\" /></div>
              <div><label className={labelCls}>Output .archive Path</label><input className={inputCls} value={packOutputPath} onChange={e => setPackOutputPath(e.target.value)} placeholder="D:\ModWorkspace\MyMod.archive" /></div>
            </div>
          )}

          {/* Convert */}
          {activeTab === 'convert' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-base">Convert File Format</h3>
              <div><label className={labelCls}>Input File</label><input className={inputCls} value={convertInput} onChange={e => setConvertInput(e.target.value)} placeholder="D:\extracted\mesh\player\eye_shadow.mesh" /></div>
              <div><label className={labelCls}>Output Directory</label><input className={inputCls} value={convertOutput} onChange={e => setConvertOutput(e.target.value)} placeholder="D:\converted\" /></div>
              <div>
                <label className={labelCls}>Target Format</label>
                <select value={convertFormat} onChange={e => setConvertFormat(e.target.value)} className={inputCls}>
                  {['json', 'glb', 'png', 'wav', 'csv'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Export */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-base">Export Game Asset to Open Format</h3>
              <div><label className={labelCls}>Input Asset Path (.mesh, .xbm, .ent…)</label><input className={inputCls} value={exportInput} onChange={e => setExportInput(e.target.value)} placeholder="D:\extracted\mesh\environment\wall.mesh" /></div>
              <div><label className={labelCls}>Output Directory</label><input className={inputCls} value={exportOutput} onChange={e => setExportOutput(e.target.value)} placeholder="D:\exports\blender\" /></div>
              <div>
                <label className={labelCls}>Export Format</label>
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className={inputCls}>
                  {['GLB', 'OBJ', 'FBX', 'PNG', 'WAV', 'JSON'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Search */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-base">Search Inside Archives</h3>
              <div><label className={labelCls}>Archives Directory</label><input className={inputCls} value={searchDir} onChange={e => setSearchDir(e.target.value)} placeholder="D:\Cyberpunk2077\archive\pc\content\" /></div>
              <div><label className={labelCls}>File Pattern</label><input className={inputCls} value={searchPattern} onChange={e => setSearchPattern(e.target.value)} placeholder="*.mesh" /></div>
              <div className="flex gap-2 flex-wrap">
                {['*.mesh', '*.xbm', '*.ent', '*.app', '*.wav', '*.json'].map(p => (
                  <button key={p} onClick={() => setSearchPattern(p)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-colors">{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Run button */}
          <button onClick={run} disabled={loading || !serviceHealth?.found}
            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
            {loading ? 'Running WolvenKit CLI…' : `Run ${tabs.find(t => t.id === activeTab)?.label}`}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-forge-panel border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  Operation complete
                  {result.files_extracted !== undefined && ` — ${result.files_extracted} files extracted`}
                  {result.match_count !== undefined && ` — ${result.match_count} matches`}
                </span>
              </div>
              {result.matches && result.matches.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {result.matches.slice(0, 100).map((m, i) => (
                    <div key={i} className="text-[11px] text-slate-300 font-mono py-0.5 border-b border-slate-800 last:border-0">{m}</div>
                  ))}
                  {result.matches.length > 100 && <p className="text-xs text-slate-500 pt-1">…and {result.matches.length - 100} more</p>}
                </div>
              )}
              {result.stdout && (
                <pre className="bg-slate-900 rounded-lg p-3 text-[11px] text-slate-300 font-mono max-h-48 overflow-y-auto mt-2 whitespace-pre-wrap">{result.stdout}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WolvenKitPanel;
