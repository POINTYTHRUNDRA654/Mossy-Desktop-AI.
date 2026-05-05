import React, { useState, useEffect } from 'react';
import { Gamepad2, RefreshCw, Trophy, Clock, User, MessageSquare, AlertCircle } from 'lucide-react';

interface Game {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string;
}

interface Achievement {
  apiname: string;
  name?: string;
  description?: string;
  achieved: number;
  percent?: number;
}

interface Player {
  personaname: string;
  avatarmedium: string;
  profileurl: string;
  loccountrycode?: string;
}

const SteamPanel: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mossy_steam_api_key') || '');
  const [steamId, setSteamId] = useState(() => localStorage.getItem('mossy_steam_id') || '');
  const [games, setGames] = useState<Game[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [gameCount, setGameCount] = useState(0);

  const saveKeys = () => {
    localStorage.setItem('mossy_steam_api_key', apiKey);
    localStorage.setItem('mossy_steam_id', steamId);
  };

  const loadLibrary = async () => {
    if (!apiKey || !steamId) { setError('Please enter Steam API key and Steam ID'); return; }
    saveKeys();
    setLoading('library');
    setError('');
    const r = await window.electronAPI?.ipcInvoke('steam:get-library', { apiKey, steamId });
    setLoading(null);
    if (r?.status === 'ok') {
      setGames((r.games || []).sort((a: Game, b: Game) => b.playtime_forever - a.playtime_forever));
      setGameCount(r.count || 0);
    } else {
      setError(r?.message || 'Failed to load library');
    }
  };

  const loadPlayerInfo = async () => {
    if (!apiKey || !steamId) return;
    saveKeys();
    setLoading('player');
    const r = await window.electronAPI?.ipcInvoke('steam:get-player', { apiKey, steamId });
    setLoading(null);
    if (r?.status === 'ok' && r.player) setPlayer(r.player);
  };

  const loadRecentGames = async () => {
    if (!apiKey || !steamId) return;
    saveKeys();
    setLoading('recent');
    const r = await window.electronAPI?.ipcInvoke('steam:get-recent', { apiKey, steamId });
    setLoading(null);
    if (r?.status === 'ok') setRecentGames(r.games || []);
  };

  const loadAchievements = async (game: Game) => {
    setSelectedGame(game);
    setLoading('achievements');
    const r = await window.electronAPI?.ipcInvoke('steam:get-achievements', { apiKey, steamId, appId: game.appid });
    setLoading(null);
    if (r?.status === 'ok') setAchievements(r.achievements || []);
  };

  const openInChat = (game: Game) => {
    window.dispatchEvent(new CustomEvent('mossy-control', {
      detail: { action: 'navigate', payload: { path: '/chat' } },
    }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mossy-prefill', {
        detail: { text: `Tell me about the game "${game.name}" — tips, mods, achievements, and lore.` },
      }));
    }, 300);
  };

  const totalHours = games.reduce((s, g) => s + g.playtime_forever, 0);

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Gamepad2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Steam Library</h1>
          <p className="text-slate-400 text-xs">Steam Web API integration</p>
        </div>
      </div>

      {/* API Keys */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Steam API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Get from steamcommunity.com/dev/apikey"
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Steam ID (64-bit)</label>
          <input
            type="text"
            value={steamId}
            onChange={e => setSteamId(e.target.value)}
            placeholder="76561198..."
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={loadLibrary} disabled={loading === 'library'} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'library' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
          Load Library
        </button>
        <button onClick={loadPlayerInfo} disabled={loading === 'player'} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'player' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
          Player Info
        </button>
        <button onClick={loadRecentGames} disabled={loading === 'recent'} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          {loading === 'recent' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          Recent Games
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Player card */}
      {player && (
        <div className="mb-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700 flex items-center gap-4">
          <img src={player.avatarmedium} alt="avatar" className="w-12 h-12 rounded-lg" />
          <div>
            <div className="text-white font-bold">{player.personaname}</div>
            <a href={player.profileurl} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline">View Profile</a>
          </div>
          <div className="ml-auto text-right">
            <div className="text-emerald-400 font-bold text-lg">{gameCount}</div>
            <div className="text-xs text-slate-500">Games Owned</div>
          </div>
          <div className="text-right">
            <div className="text-amber-400 font-bold text-lg">{Math.round(totalHours / 60)}h</div>
            <div className="text-xs text-slate-500">Total Hours</div>
          </div>
        </div>
      )}

      {/* Recent Games */}
      {recentGames.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-slate-400 font-medium mb-2">Recently Played (2 weeks)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentGames.map(g => (
              <div key={g.appid} className="shrink-0 bg-slate-800 border border-slate-700 rounded-lg p-3 w-40">
                <p className="text-white text-xs font-medium truncate">{g.name}</p>
                <p className="text-slate-400 text-[10px] mt-1">{Math.round(g.playtime_forever / 60)}h</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Games list */}
      {games.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-2">Library ({games.length} games)</p>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {games.map(g => (
              <div
                key={g.appid}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${selectedGame?.appid === g.appid ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'}`}
                onClick={() => setSelectedGame(g)}
              >
                {g.img_icon_url && (
                  <img
                    src={`https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`}
                    alt=""
                    className="w-8 h-8 rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{g.name}</p>
                  <p className="text-slate-500 text-[10px]">{Math.round(g.playtime_forever / 60)}h played</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); loadAchievements(g); }}
                    className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Achievements"
                  >
                    <Trophy className="w-3 h-3 text-amber-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openInChat(g); }}
                    className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Ask Mossy"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && selectedGame && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 font-medium mb-2">
            Achievements for {selectedGame.name} ({achievements.filter(a => a.achieved).length}/{achievements.length} unlocked)
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {achievements.map(a => (
              <div key={a.apiname} className={`flex items-center gap-3 p-2 rounded-lg ${a.achieved ? 'bg-emerald-600/10 border border-emerald-500/20' : 'bg-slate-800/40 border border-slate-700'}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${a.achieved ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${a.achieved ? 'text-white' : 'text-slate-400'}`}>{a.name || a.apiname}</p>
                  {a.description && <p className="text-[10px] text-slate-500 truncate">{a.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SteamPanel;
