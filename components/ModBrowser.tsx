import React, { useState } from 'react';
import { PackageSearch, RefreshCw, ExternalLink, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const GAMES = [
  { label: 'Skyrim SE', value: 'skyrimspecialedition' },
  { label: 'Fallout 4', value: 'fallout4' },
  { label: 'Fallout New Vegas', value: 'newvegas' },
  { label: 'Cyberpunk 2077', value: 'cyberpunk2077' },
  { label: "Baldur's Gate 3", value: 'baldursgate3' },
  { label: 'Starfield', value: 'starfield' },
];

interface ModResult {
  mod_id?: number;
  name: string;
  username?: string;
  endorsement_count?: number;
  category_name?: string;
  summary?: string;
  version?: string;
  mod_downloads?: number;
  game_name?: string;
}

const ModBrowser: React.FC = () => {
  // API key stored in localStorage for convenience in this local-only desktop app
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mossy_nexus_api_key') || '');
  const [game, setGame] = useState('skyrimspecialedition');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModResult[]>([]);
  const [selectedMod, setSelectedMod] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (p = 0) => {
    if (!apiKey) { setError('Please enter your Nexus Mods API key'); return; }
    if (!query.trim()) { setError('Please enter a search query'); return; }
    localStorage.setItem('mossy_nexus_api_key', apiKey);
    setLoading(true);
    setError('');
    setPage(p);
    const r = await window.electronAPI?.ipcInvoke('nexus:search', { apiKey, game, query, page: p });
    setLoading(false);
    if (r?.status === 'ok') {
      setResults(r.results || []);
      setTotal(r.total || 0);
    } else {
      setError(r?.message || 'Search failed');
    }
  };

  const getModDetails = async (mod: ModResult) => {
    if (!mod.mod_id) return;
    setLoading(true);
    const r = await window.electronAPI?.ipcInvoke('nexus:get-mod', { apiKey, game, modId: mod.mod_id });
    setLoading(false);
    if (r?.status === 'ok') setSelectedMod(r.mod);
  };

  const openOnNexus = (mod: ModResult) => {
    window.open(`https://www.nexusmods.com/${game}/mods/${mod.mod_id}`, '_blank');
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <PackageSearch className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Mod Browser</h1>
          <p className="text-slate-400 text-xs">Nexus Mods API integration</p>
        </div>
      </div>

      {/* API Key */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block">Nexus Mods API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="Get from nexusmods.com/users/myaccount → API Keys"
          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
      </div>

      {/* Game selector + search */}
      <div className="flex gap-2 mb-4">
        <select
          value={game}
          onChange={e => setGame(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        >
          {GAMES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(0)}
          placeholder="Search mods..."
          className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
        <button
          onClick={() => search(0)}
          disabled={loading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
          Search
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 font-medium">{total} results</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => search(page - 1)} disabled={page === 0} className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                <span className="text-xs text-slate-400">{page + 1}/{totalPages}</span>
                <button onClick={() => search(page + 1)} disabled={page >= totalPages - 1} className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {results.map((mod, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium truncate">{mod.name}</span>
                      {mod.category_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 shrink-0">{mod.category_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-1">
                      {mod.username && <span>by {mod.username}</span>}
                      {mod.version && <span>v{mod.version}</span>}
                      {mod.endorsement_count !== undefined && <span>♥ {mod.endorsement_count?.toLocaleString()}</span>}
                    </div>
                    {mod.summary && <p className="text-xs text-slate-400 line-clamp-2">{mod.summary}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => openOnNexus(mod)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Nexus
                    </button>
                    <button
                      onClick={() => getModDetails(mod)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[10px] border border-emerald-600/20 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mod details modal */}
      {selectedMod && (
        <div className="mt-4 p-4 rounded-xl bg-slate-800/60 border border-emerald-500/30">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-white font-bold text-sm">{selectedMod.name}</h3>
            <button onClick={() => setSelectedMod(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div><span className="text-slate-500">Author:</span> <span className="text-slate-300">{selectedMod.author}</span></div>
            <div><span className="text-slate-500">Version:</span> <span className="text-slate-300">{selectedMod.version}</span></div>
            <div><span className="text-slate-500">Downloads:</span> <span className="text-slate-300">{selectedMod.mod_downloads?.toLocaleString()}</span></div>
            <div><span className="text-slate-500">Endorsements:</span> <span className="text-slate-300">{selectedMod.endorsement_count?.toLocaleString()}</span></div>
          </div>
          {selectedMod.summary && <p className="text-xs text-slate-400 leading-relaxed">{selectedMod.summary}</p>}
          <button
            onClick={() => window.open(`https://www.nexusmods.com/${game}/mods/${selectedMod.mod_id}`, '_blank')}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View on Nexus Mods
          </button>
        </div>
      )}
    </div>
  );
};

export default ModBrowser;
