import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, Info, RefreshCw, ExternalLink, Settings, Loader2, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

interface Conflict {
  plugin: string;
  record_type: string;
  form_id: string;
  conflict_type: 'conflict' | 'override' | 'identical';
  masters: string[];
}

interface ConflictResult {
  status: string;
  conflicts: Conflict[];
  warnings: string[];
  error_count: number;
}

interface Health {
  fo4edit_found: boolean;
  xedit_path: string | null;
}

type Filter = 'all' | 'conflict' | 'override' | 'identical';

const FO4EditPanel: React.FC = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [fo4editPath, setFo4editPath] = useState('');
  const [pluginsDir, setPluginsDir] = useState('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout 4\\Data\\');
  const [pluginList, setPluginList] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConflictResult | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    checkHealth();
    loadSavedPath();
  }, []);

  const checkHealth = async () => {
    try {
      const r = await window.electronAPI?.ipcInvoke('fo4edit:health-check');
      setHealth({ fo4edit_found: r?.fo4edit_found ?? false, xedit_path: r?.xedit_path ?? null });
    } catch { setHealth({ fo4edit_found: false, xedit_path: null }); }
  };

  const loadSavedPath = async () => {
    try {
      const r = await window.electronAPI?.ipcInvoke('secrets:get', { key: 'fo4edit_path' });
      if (r?.value) setFo4editPath(r.value);
    } catch {}
  };

  const savePath = async () => {
    if (!fo4editPath) return;
    try {
      await window.electronAPI?.ipcInvoke('secrets:set', { key: 'fo4edit_path', value: fo4editPath });
      await window.electronAPI?.ipcInvoke('fo4edit:set-path', { path: fo4editPath });
      await checkHealth();
      setError('');
    } catch (e: any) { setError(String(e)); }
  };

  const runCheck = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setExplanation('');
    const plugins = pluginList.trim().split('\n').map(p => p.trim()).filter(Boolean);
    try {
      const r = await window.electronAPI?.ipcInvoke('fo4edit:check-conflicts', {
        plugins_dir: pluginsDir,
        plugin_names: plugins.length > 0 ? plugins : undefined,
      });
      if (r?.status === 'error') setError(r.message);
      else setResult(r);
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const explainConflicts = async () => {
    if (!result) return;
    setExplaining(true);
    const summary = result.conflicts.slice(0, 10)
      .map(c => `${c.conflict_type.toUpperCase()}: ${c.plugin} — ${c.record_type} [${c.form_id}] (masters: ${c.masters.join(', ')})`)
      .join('\n');
    try {
      const r = await window.electronAPI?.ipcInvoke('gemma:run-inference', {
        prompt: `Explain these Fallout 4 mod conflicts in plain English for a modder:\n${summary}\n\nKeep it concise and practical.`,
      });
      setExplanation(r?.response || r?.text || 'No explanation returned.');
    } catch (e: any) { setExplanation('Could not get AI explanation: ' + String(e)); }
    setExplaining(false);
  };

  const filteredConflicts = result?.conflicts.filter(c => filter === 'all' || c.conflict_type === filter) ?? [];

  const conflictColor = (type: string) => {
    if (type === 'conflict') return 'border-red-500 bg-red-500/10';
    if (type === 'override') return 'border-amber-500 bg-amber-500/10';
    return 'border-emerald-500 bg-emerald-500/10';
  };

  const conflictBadge = (type: string) => {
    if (type === 'conflict') return 'bg-red-500 text-white';
    if (type === 'override') return 'bg-amber-500 text-black';
    return 'bg-emerald-500 text-black';
  };

  const counts = result ? {
    conflict: result.conflicts.filter(c => c.conflict_type === 'conflict').length,
    override: result.conflicts.filter(c => c.conflict_type === 'override').length,
    identical: result.conflicts.filter(c => c.conflict_type === 'identical').length,
  } : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="text-amber-400" size={22} />
          <div>
            <h2 className="text-lg font-bold text-slate-100">FO4Edit Conflict Detector</h2>
            <p className="text-xs text-slate-400">Plugin conflict analysis for Fallout 4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/TES5Edit/TES5Edit" target="_blank" rel="noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <ExternalLink size={12} /> xEdit GitHub
          </a>
          <div className={`w-2 h-2 rounded-full ${health?.fo4edit_found ? 'bg-emerald-400' : 'bg-slate-600'}`} title={health?.fo4edit_found ? 'FO4Edit found' : 'FO4Edit not found'} />
          <button onClick={() => setShowSetup(s => !s)} className="text-slate-400 hover:text-slate-200">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Setup Panel */}
      {showSetup && (
        <div className="bg-forge-panel border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-300">FO4Edit Path</p>
          {health?.xedit_path && (
            <p className="text-xs text-emerald-400">Found: {health.xedit_path}</p>
          )}
          {!health?.fo4edit_found && (
            <p className="text-xs text-amber-400">FO4Edit not detected. Download from <a href="https://github.com/TES5Edit/TES5Edit/releases" target="_blank" rel="noreferrer" className="underline">GitHub releases</a>.</p>
          )}
          <div className="flex gap-2">
            <input value={fo4editPath} onChange={e => setFo4editPath(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500"
              placeholder="C:\FO4Edit\FO4Edit.exe" />
            <button onClick={savePath} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded font-medium">Save</button>
          </div>
        </div>
      )}

      {/* Inputs */}
      <div className="bg-forge-panel border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Plugins Directory</label>
          <input value={pluginsDir} onChange={e => setPluginsDir(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500"
            placeholder="C:\...\Fallout 4\Data\" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Plugins to Check (one per line, or leave blank for all)</label>
          <textarea value={pluginList} onChange={e => setPluginList(e.target.value)}
            rows={4}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 font-mono resize-y"
            placeholder={'Fallout4.esm\nDLCRobot.esm\nMyMod.esp'} />
        </div>
        <button onClick={runCheck} disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded transition-colors">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : <><Search size={16} /> Run Conflict Check</>}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-3">
          {result.status === 'mock' && (
            <div className="bg-amber-900/30 border border-amber-700 rounded p-3 text-amber-300 text-sm flex items-center gap-2">
              <AlertTriangle size={14} /> Simulated results — FO4Edit not found
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{counts?.conflict ?? 0}</p>
              <p className="text-xs text-slate-400">Conflicts</p>
            </div>
            <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{counts?.override ?? 0}</p>
              <p className="text-xs text-slate-400">Overrides</p>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{counts?.identical ?? 0}</p>
              <p className="text-xs text-slate-400">Identical</p>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-300 flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {(['all', 'conflict', 'override', 'identical'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${filter === f ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {f}{f !== 'all' && counts ? ` (${counts[f as keyof typeof counts]})` : ''}
              </button>
            ))}
          </div>

          {/* Conflict Cards */}
          <div className="flex flex-col gap-2">
            {filteredConflicts.map((c, i) => (
              <div key={i} className={`border rounded-lg p-3 ${conflictColor(c.conflict_type)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-slate-200">{c.plugin}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${conflictBadge(c.conflict_type)}`}>{c.conflict_type}</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>Type: <span className="text-slate-200">{c.record_type}</span></span>
                  <span>FormID: <span className="font-mono text-slate-200">{c.form_id}</span></span>
                </div>
                {c.masters.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">Masters: {c.masters.join(', ')}</div>
                )}
              </div>
            ))}
            {filteredConflicts.length === 0 && (
              <div className="text-center text-slate-500 py-4">No {filter === 'all' ? '' : filter} conflicts found</div>
            )}
          </div>

          {/* AI Explain */}
          <button onClick={explainConflicts} disabled={explaining || result.conflicts.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded transition-colors">
            {explaining ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Info size={14} /> Explain Conflicts (AI)</>}
          </button>

          {explanation && (
            <div className="bg-purple-900/20 border border-purple-700 rounded p-3 text-sm text-slate-200 whitespace-pre-wrap">{explanation}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default FO4EditPanel;
