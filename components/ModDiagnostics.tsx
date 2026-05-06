import React, { useState, useEffect } from 'react';
import { Bug, FolderOpen, Search, AlertTriangle, CheckCircle, FileText, Loader2, BrainCircuit, ChevronRight, RefreshCw } from 'lucide-react';

interface CrashResult {
  classification?: string;
  crash_addresses?: string[];
  modules_mentioned?: string[];
  form_ids?: string[];
  error_lines?: string[];
  log_header?: string;
  log_tail?: string;
  total_lines?: number;
  ai_prompt?: string;
}
interface PapyrusResult {
  vm_dying?: boolean;
  errors?: string[];
  warnings?: string[];
  timeout_kills?: string[];
  top_active_scripts?: { script: string; mentions: number }[];
  health?: string;
  total_lines?: number;
}
interface F4seResult {
  errors?: string[];
  version_issues?: string[];
  failed_plugins?: string[];
  has_issues?: boolean;
  total_lines?: number;
}
interface CrashLog { name: string; path: string; size: number; modified: string; }
interface GameFolder { game: string; path: string; }

const eb = () => (window as any).electronBridge as any;

const ModDiagnostics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crash'|'f4se'|'papyrus'|'ai'>('crash');
  const [loading, setLoading] = useState(false);
  const [logPath, setLogPath] = useState('');
  const [crashLogs, setCrashLogs] = useState<CrashLog[]>([]);
  const [gameFolders, setGameFolders] = useState<GameFolder[]>([]);
  const [crashResult, setCrashResult] = useState<CrashResult | null>(null);
  const [papyrusResult, setPapyrusResult] = useState<PapyrusResult | null>(null);
  const [f4seResult, setF4seResult] = useState<F4seResult | null>(null);
  const [scanDir, setScanDir] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const r = await eb()?.ipcInvoke?.('diag:detect-game-folders');
      setGameFolders(r?.game_folders || []);
    };
    init();
  }, []);

  const browseScanDir = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-directory', { title: 'Select Log Directory' });
    if (p) { setScanDir(p); scanForLogs(p); }
  };

  const scanForLogs = async (dir?: string) => {
    const d = dir || scanDir;
    if (!d) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('diag:scan-crash-logs', { directory: d, max_results: 20 });
    setCrashLogs(r?.crash_logs || []);
    setLoading(false);
  };

  const browseLog = async (filterExt?: string[]) => {
    const filters = filterExt
      ? [{ name: 'Log Files', extensions: filterExt }, { name: 'All Files', extensions: ['*'] }]
      : [{ name: 'Log Files', extensions: ['log', 'txt'] }, { name: 'All Files', extensions: ['*'] }];
    const p = await eb()?.ipcInvoke?.('dialog:open-file', { title: 'Select Log File', filters });
    if (p) setLogPath(p);
    return p;
  };

  const analyzeCrash = async (path?: string) => {
    const p = path || logPath;
    if (!p) return;
    setLoading(true);
    setCrashResult(null);
    const r = await eb()?.ipcInvoke?.('diag:parse-crash-log', { log_path: p });
    if (r?.status === 'ok') { setCrashResult(r); setLogPath(p); }
    setLoading(false);
  };

  const analyzeF4SE = async (path?: string) => {
    const p = path || await browseLog(['log']);
    if (!p) return;
    setLoading(true);
    setF4seResult(null);
    const r = await eb()?.ipcInvoke?.('diag:parse-f4se-log', { log_path: p });
    if (r?.status === 'ok') { setF4seResult(r); setLogPath(p); }
    setLoading(false);
  };

  const analyzePapyrus = async (path?: string) => {
    const p = path || await browseLog(['log']);
    if (!p) return;
    setLoading(true);
    setPapyrusResult(null);
    const r = await eb()?.ipcInvoke?.('diag:scan-papyrus-log', { log_path: p });
    if (r?.status === 'ok') { setPapyrusResult(r); setLogPath(p); }
    setLoading(false);
  };

  const runAiDiagnosis = async () => {
    if (!crashResult?.ai_prompt) return;
    setAiLoading(true);
    setAiAnalysis('');
    setActiveTab('ai');
    try {
      const r = await eb()?.ipcInvoke?.('gemma:run-inference', {
        prompt: crashResult.ai_prompt,
        max_tokens: 512,
      });
      setAiAnalysis(r?.text || r?.response || 'AI service unavailable — install Gemma 4 or connect to an AI provider.');
    } catch {
      setAiAnalysis('Failed to contact AI service.');
    }
    setAiLoading(false);
  };

  const healthColor = (h?: string) => {
    if (h === 'ok') return 'text-emerald-400';
    if (h === 'warning') return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="h-full flex flex-col bg-[#050910] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center">
          <Bug className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Mod Diagnostics</h1>
          <p className="text-xs text-slate-500">AI-powered crash log, F4SE &amp; Papyrus log analyzer</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={browseScanDir} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:border-slate-600 transition-colors">
            <FolderOpen className="w-3.5 h-3.5" /> Scan Logs
          </button>
        </div>
      </div>

      {/* Game folders detected */}
      {gameFolders.length > 0 && (
        <div className="px-6 py-2 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          Detected: {gameFolders.map(g => g.game).join(', ')}
        </div>
      )}

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-800 flex gap-0">
        {(['crash', 'f4se', 'papyrus', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === t ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t === 'f4se' ? 'F4SE / SKSE' : t === 'ai' ? 'AI Analysis' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

        {/* ── Crash tab ── */}
        {activeTab === 'crash' && (
          <div className="space-y-4">
            {/* Recent crash logs */}
            {crashLogs.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Recent crash logs ({crashLogs.length})</div>
                <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
                  {crashLogs.map((cl, i) => (
                    <button key={i} onClick={() => analyzeCrash(cl.path)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded bg-slate-800/40 hover:bg-slate-800/80 text-left group">
                      <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs font-mono text-slate-300 flex-1 truncate">{cl.name}</span>
                      <span className="text-xs text-slate-600">{new Date(cl.modified).toLocaleDateString()}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input value={logPath} onChange={e => setLogPath(e.target.value)} placeholder="Path to crash log…"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-red-500/50 font-mono" />
              <button onClick={() => browseLog(['log', 'txt']).then(p => p && analyzeCrash(p))}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600">
                <FolderOpen className="w-4 h-4" />
              </button>
              <button onClick={() => analyzeCrash()} disabled={!logPath || loading}
                className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-600/30 transition-colors disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Parse'}
              </button>
            </div>

            {crashResult && (
              <div className="space-y-4">
                {/* Classification */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="text-xs font-semibold text-red-400 mb-1">Crash Classification</div>
                  <div className="text-sm text-slate-300">{crashResult.classification}</div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Lines', value: crashResult.total_lines },
                    { label: 'Modules', value: crashResult.modules_mentioned?.length },
                    { label: 'Form IDs', value: crashResult.form_ids?.length },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-red-400">{s.value ?? 0}</div>
                      <div className="text-xs text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Modules */}
                {(crashResult.modules_mentioned || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Modules Mentioned</div>
                    <div className="flex flex-wrap gap-1.5">
                      {crashResult.modules_mentioned!.map((m, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400">{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error lines */}
                {(crashResult.error_lines || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Error Lines</div>
                    <div className="space-y-1">
                      {crashResult.error_lines!.map((l, i) => (
                        <div key={i} className="text-xs font-mono text-amber-400 px-3 py-1.5 rounded bg-amber-500/5 border border-amber-500/20">{l}</div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={runAiDiagnosis}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
                  <BrainCircuit className="w-4 h-4" /> Get AI Diagnosis →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── F4SE tab ── */}
        {activeTab === 'f4se' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => analyzeF4SE()} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-600/30 transition-colors disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                Open F4SE / SKSE Log
              </button>
            </div>
            {f4seResult && (
              <div className="space-y-4">
                <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${!f4seResult.has_issues ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                  {!f4seResult.has_issues ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {!f4seResult.has_issues ? 'No issues found in F4SE log' : `Issues detected — ${f4seResult.errors?.length} errors, ${f4seResult.failed_plugins?.length} plugin failures`}
                </div>
                {(f4seResult.version_issues || []).length > 0 && (
                  <div><div className="text-xs font-semibold text-amber-400 mb-2">Version Mismatches</div>
                    {f4seResult.version_issues!.map((l, i) => <div key={i} className="text-xs font-mono text-amber-300 px-3 py-1.5 rounded bg-amber-500/5 border border-amber-500/20 mb-1">{l}</div>)}
                  </div>
                )}
                {(f4seResult.failed_plugins || []).length > 0 && (
                  <div><div className="text-xs font-semibold text-red-400 mb-2">Failed Plugin Loads</div>
                    {f4seResult.failed_plugins!.map((l, i) => <div key={i} className="text-xs font-mono text-red-300 px-3 py-1.5 rounded bg-red-500/5 border border-red-500/20 mb-1">{l}</div>)}
                  </div>
                )}
                {(f4seResult.errors || []).length > 0 && (
                  <div><div className="text-xs font-semibold text-slate-400 mb-2">Errors ({f4seResult.errors!.length})</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                      {f4seResult.errors!.map((l, i) => <div key={i} className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-slate-800/40">{l}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Papyrus tab ── */}
        {activeTab === 'papyrus' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => analyzePapyrus()} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-600/30 transition-colors disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                Open Papyrus.0.log
              </button>
            </div>
            {papyrusResult && (
              <div className="space-y-4">
                <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${papyrusResult.health === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : papyrusResult.health === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {papyrusResult.vm_dying ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {papyrusResult.vm_dying ? 'CRITICAL: Papyrus VM is dying!' : `Health: ${papyrusResult.health} — ${papyrusResult.total_lines} log lines`}
                </div>

                {(papyrusResult.top_active_scripts || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Most Active Scripts (potential runaway)</div>
                    {papyrusResult.top_active_scripts!.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded bg-slate-800/40 mb-1">
                        <span className="text-xs font-mono text-slate-300 flex-1">{s.script}</span>
                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (s.mentions / (papyrusResult.top_active_scripts![0]?.mentions || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{s.mentions}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(papyrusResult.errors || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-400 mb-2">Errors ({papyrusResult.errors!.length})</div>
                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                      {papyrusResult.errors!.slice(0, 30).map((e, i) => <div key={i} className="text-xs font-mono text-red-300 px-2 py-1 rounded bg-red-500/5">{e}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AI Analysis tab ── */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {!crashResult && !papyrusResult && (
              <div className="text-center text-slate-600 py-12">
                <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Analyze a crash log first to enable AI diagnosis</p>
              </div>
            )}
            {(crashResult || papyrusResult) && (
              <>
                <button onClick={runAiDiagnosis} disabled={aiLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors disabled:opacity-40">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                  {aiLoading ? 'Analyzing with AI…' : 'Run AI Diagnosis'}
                </button>
                {aiAnalysis && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                    {aiAnalysis}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModDiagnostics;
