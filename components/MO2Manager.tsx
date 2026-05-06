import React, { useState, useEffect } from 'react';
import { FolderOpen, RefreshCw, CheckCircle, XCircle, ToggleLeft, ToggleRight, List, ChevronRight, Settings, ArrowLeftRight } from 'lucide-react';

interface Mod { name: string; enabled: boolean; }
interface Plugin { name: string; enabled: boolean; }
interface Mo2Status { found: boolean; mo2_dir?: string; profiles?: string[]; current_profile?: string; }

const eb = () => (window as any).electronBridge as any;

const MO2Manager: React.FC = () => {
  const [status, setStatus] = useState<Mo2Status>({ found: false });
  const [mo2Dir, setMo2Dir] = useState('');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [mods, setMods] = useState<Mod[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [activeTab, setActiveTab] = useState<'mods'|'load-order'>('mods');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');

  const detect = async () => {
    setLoading(true);
    setMsg('');
    const r = await eb()?.ipcInvoke?.('mo2:detect');
    if (r?.status === 'found') {
      setStatus({ found: true, mo2_dir: r.mo2_dir, profiles: r.profiles, current_profile: r.current_profile });
      setMo2Dir(r.mo2_dir);
      setProfiles(r.profiles || []);
      setSelectedProfile(r.current_profile || (r.profiles?.[0] ?? ''));
    } else {
      setStatus({ found: false });
      setMsg('MO2 not found — use Set Path to point to your MO2 installation folder.');
    }
    setLoading(false);
  };

  const loadMods = async (profile: string) => {
    if (!mo2Dir || !profile) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('mo2:list-mods', { mo2_dir: mo2Dir, profile });
    if (r?.status === 'ok') setMods(r.mods || []);
    setLoading(false);
  };

  const loadPlugins = async (profile: string) => {
    if (!mo2Dir || !profile) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('mo2:get-load-order', { mo2_dir: mo2Dir, profile });
    if (r?.status === 'ok') setPlugins(r.plugins || []);
    setLoading(false);
  };

  const switchProfile = async (profile: string) => {
    if (!mo2Dir || !profile) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('mo2:switch-profile', { mo2_dir: mo2Dir, profile });
    if (r?.status === 'ok') {
      setSelectedProfile(profile);
      setMsg(`Switched to profile: ${profile}`);
      await loadMods(profile);
      await loadPlugins(profile);
    } else {
      setMsg(r?.message || 'Failed to switch profile');
    }
    setLoading(false);
  };

  const toggleMod = async (modName: string, enabled: boolean) => {
    const r = await eb()?.ipcInvoke?.('mo2:toggle-mod', { mo2_dir: mo2Dir, profile: selectedProfile, mod_name: modName, enabled });
    if (r?.status === 'ok') {
      setMods(prev => prev.map(m => m.name === modName ? { ...m, enabled } : m));
    } else {
      setMsg(r?.message || 'Failed to toggle mod');
    }
  };

  const browseDir = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-directory', { title: 'Select MO2 Installation Folder' });
    if (p) {
      const r = await eb()?.ipcInvoke?.('mo2:set-path', { path: p });
      if (r?.status === 'ok') { setMo2Dir(p); detect(); }
      else setMsg(r?.message || 'Failed to set MO2 path');
    }
  };

  useEffect(() => { detect(); }, []);
  useEffect(() => {
    if (selectedProfile) {
      loadMods(selectedProfile);
      loadPlugins(selectedProfile);
    }
  }, [selectedProfile]);

  const filteredMods = mods.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()));
  const filteredPlugins = plugins.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
  const enabledCount = mods.filter(m => m.enabled).length;

  return (
    <div className="h-full flex flex-col bg-[#050910] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">MO2 Manager</h1>
          <p className="text-xs text-slate-500">Mod Organizer 2 — profiles, mods &amp; load order</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={browseDir} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:border-slate-600 transition-colors">
            <FolderOpen className="w-3.5 h-3.5" /> Set Path
          </button>
          <button onClick={detect} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-600/30 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Detect
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`px-6 py-2 text-xs flex items-center gap-2 border-b border-slate-800 ${status.found ? 'text-emerald-400 bg-emerald-500/5' : 'text-amber-400 bg-amber-500/5'}`}>
        {status.found ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {status.found ? `MO2 found at ${status.mo2_dir}` : 'MO2 not detected'}
        {msg && <span className="ml-3 text-slate-400">— {msg}</span>}
      </div>

      {status.found && (
        <>
          {/* Profile selector */}
          <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-3">
            <span className="text-xs text-slate-500 w-16 shrink-0">Profile:</span>
            <div className="flex flex-wrap gap-1.5">
              {profiles.map(p => (
                <button key={p} onClick={() => switchProfile(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${p === selectedProfile ? 'bg-amber-600/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {p}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-slate-600">{enabledCount}/{mods.length} mods active</span>
          </div>

          {/* Tab bar */}
          <div className="px-6 border-b border-slate-800 flex gap-0">
            {(['mods', 'load-order'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${activeTab === t ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                {t === 'load-order' ? 'Load Order' : 'Mods'} {t === 'mods' ? `(${mods.length})` : `(${plugins.length})`}
              </button>
            ))}
            <div className="ml-auto flex items-center py-2">
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
                className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 w-40" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'mods' && (
              <div className="divide-y divide-slate-800/50">
                {filteredMods.map((mod) => (
                  <div key={mod.name} className="flex items-center px-6 py-2.5 hover:bg-slate-800/30 group">
                    <button onClick={() => toggleMod(mod.name, !mod.enabled)} className="mr-3 shrink-0">
                      {mod.enabled
                        ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                        : <ToggleLeft className="w-5 h-5 text-slate-600" />}
                    </button>
                    <span className={`text-xs font-mono truncate ${mod.enabled ? 'text-slate-200' : 'text-slate-600'}`}>{mod.name}</span>
                    <span className={`ml-auto text-[10px] font-bold shrink-0 ${mod.enabled ? 'text-emerald-500' : 'text-slate-700'}`}>
                      {mod.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                ))}
                {filteredMods.length === 0 && (
                  <div className="text-center text-slate-600 text-sm py-16">No mods found for profile "{selectedProfile}"</div>
                )}
              </div>
            )}
            {activeTab === 'load-order' && (
              <div className="divide-y divide-slate-800/50">
                {filteredPlugins.map((plugin, i) => (
                  <div key={plugin.name} className="flex items-center px-6 py-2.5 hover:bg-slate-800/30">
                    <span className="w-8 text-xs text-slate-700 font-mono shrink-0">{String(i).padStart(2, '0')}</span>
                    <span className={`text-xs font-mono truncate flex-1 ${plugin.enabled ? 'text-slate-200' : 'text-slate-600'}`}>{plugin.name}</span>
                    <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${plugin.enabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                      {plugin.enabled ? 'Active' : 'Ghost'}
                    </span>
                  </div>
                ))}
                {filteredPlugins.length === 0 && (
                  <div className="text-center text-slate-600 text-sm py-16">No plugins found for profile "{selectedProfile}"</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!status.found && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600">
          <Settings className="w-12 h-12 opacity-30" />
          <p className="text-sm">Mod Organizer 2 was not found automatically.</p>
          <button onClick={browseDir} className="px-4 py-2 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-600/30 transition-colors">
            Browse for MO2 Folder
          </button>
        </div>
      )}
    </div>
  );
};

export default MO2Manager;
