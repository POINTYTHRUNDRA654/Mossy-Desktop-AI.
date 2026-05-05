import React, { useState } from 'react';
import { List, RefreshCw, AlertCircle, CheckCircle, Zap } from 'lucide-react';

const GAMES = ['TES5', 'SSE', 'FO3', 'FNV', 'FO4', 'FO4VR', 'TES5VR'];

interface LootWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

const WARNING_STYLES = {
  error:   'bg-red-500/10 border-red-500/30 text-red-300',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  info:    'bg-blue-500/10 border-blue-500/30 text-blue-300',
};

const parseLootWarnings = (output: string): LootWarning[] => {
  const lines = output.split('\n');
  return lines
    .filter(l => l.trim())
    .map(line => {
      const lower = line.toLowerCase();
      if (lower.includes('error') || lower.includes('conflict')) return { level: 'error' as const, message: line.trim() };
      if (lower.includes('warning') || lower.includes('missing')) return { level: 'warning' as const, message: line.trim() };
      return { level: 'info' as const, message: line.trim() };
    });
};

const LoadOrderAnalyzer: React.FC = () => {
  const [lootPath, setLootPath] = useState(() => localStorage.getItem('mossy_loot_path') || '');
  const [game, setGame] = useState('SSE');
  const [modsDir, setModsDir] = useState('');
  const [lootOutput, setLootOutput] = useState('');
  const [warnings, setWarnings] = useState<LootWarning[]>([]);
  const [aiExplanation, setAiExplanation] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const runLoot = async () => {
    localStorage.setItem('mossy_loot_path', lootPath);
    setLoading('loot');
    setError('');
    setLootOutput('');
    setWarnings([]);
    setAiExplanation('');
    const r = await window.electronAPI?.ipcInvoke('loot:analyze', { lootPath, game, modsDir });
    setLoading(null);
    if (r?.status === 'ok') {
      const out = r.output || '';
      setLootOutput(out + (r.warnings ? '\n' + r.warnings : ''));
      setWarnings(parseLootWarnings(out + (r.warnings || '')));
    } else {
      setError(r?.message || 'LOOT analysis failed');
      if (r?.output) setLootOutput(r.output);
    }
  };

  const autoSort = async () => {
    setLoading('sort');
    const r = await window.electronAPI?.ipcInvoke('loot:sort', { lootPath, game });
    setLoading(null);
    if (r?.status === 'ok') setLootOutput(prev => prev + '\n\n[Auto-sort complete]\n' + (r.output || ''));
    else setError(r?.message || 'Sort failed');
  };

  const explainWithAI = async () => {
    if (!lootOutput) return;
    setLoading('ai');
    const r = await window.electronAPI?.ipcInvoke('gemma:run-inference', {
      prompt: `I ran LOOT (Load Order Optimisation Tool) on my Skyrim/Fallout mod list and got this output. Please explain it in plain English, highlight any critical issues, and suggest fixes:\n\n${lootOutput.slice(0, 3000)}`,
    });
    setLoading(null);
    if (r?.response) setAiExplanation(r.response);
    else if (r?.text) setAiExplanation(r.text);
  };

  const errorCount = warnings.filter(w => w.level === 'error').length;
  const warnCount = warnings.filter(w => w.level === 'warning').length;

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <List className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Load Order Analyzer</h1>
          <p className="text-slate-400 text-xs">LOOT + Mossy AI explanation</p>
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="col-span-2">
          <label className="text-xs text-slate-400 mb-1.5 block">LOOT Executable Path</label>
          <input
            type="text"
            value={lootPath}
            onChange={e => setLootPath(e.target.value)}
            placeholder="C:\Program Files\LOOT\LOOT.exe"
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Game</label>
          <select
            value={game}
            onChange={e => setGame(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block">Mods Directory (optional)</label>
        <input
          type="text"
          value={modsDir}
          onChange={e => setModsDir(e.target.value)}
          placeholder="C:\Games\Skyrim Special Edition"
          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={runLoot} disabled={loading === 'loot'} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'loot' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
          Run LOOT Analysis
        </button>
        <button onClick={autoSort} disabled={loading === 'sort'} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'sort' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Auto-Sort Load Order
        </button>
        <button onClick={explainWithAI} disabled={!lootOutput || loading === 'ai'} className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 disabled:opacity-40 text-purple-300 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'ai' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Explain with AI
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Warnings summary */}
      {warnings.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs text-slate-400 font-medium">Issues Found</p>
            {errorCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{errorCount} errors</span>}
            {warnCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{warnCount} warnings</span>}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {warnings.filter(w => w.level !== 'info').map((w, i) => (
              <div key={i} className={`p-2 rounded-lg border text-xs ${WARNING_STYLES[w.level]}`}>
                {w.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw LOOT output */}
      {lootOutput && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 font-medium mb-2">Raw LOOT Output</p>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
            {lootOutput}
          </pre>
        </div>
      )}

      {/* AI Explanation */}
      {aiExplanation && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <p className="text-xs text-purple-400 font-medium mb-2">🤖 Mossy AI Explanation</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiExplanation}</p>
        </div>
      )}
    </div>
  );
};

export default LoadOrderAnalyzer;
