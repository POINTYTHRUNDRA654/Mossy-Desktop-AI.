import React, { useState, useEffect } from 'react';
import { Settings, FolderOpen, Sliders, Save, RotateCcw, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface IniFile { path: string; name: string; folder: string; }
interface Warning { section: string; key: string; msg: string; }
interface SettingEntry { desc: string; default: any; low?: any; high?: any; }

const eb = () => (window as any).electronBridge as any;
const PRESETS = ['Ultra', 'High', 'Medium', 'Low', 'Potato'];

const INITweaker: React.FC = () => {
  const [iniPath, setIniPath] = useState('');
  const [iniData, setIniData] = useState<Record<string, Record<string, string>>>({});
  const [detectedFiles, setDetectedFiles] = useState<IniFile[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [knownSettings, setKnownSettings] = useState<Record<string, Record<string, SettingEntry>>>({});
  const [activeTab, setActiveTab] = useState<'editor'|'presets'|'validate'>('editor');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok'|'error'>('ok');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, string>>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const showMsg = (text: string, type: 'ok'|'error' = 'ok') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000); };

  useEffect(() => {
    const init = async () => {
      const r = await eb()?.ipcInvoke?.('ini:detect-ini-files');
      if (r?.ini_files) setDetectedFiles(r.ini_files);
      const ks = await eb()?.ipcInvoke?.('ini:known-settings');
      if (ks?.settings) setKnownSettings(ks.settings);
    };
    init();
  }, []);

  const loadIni = async (path?: string) => {
    const p = path || iniPath;
    if (!p) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('ini:read', { path: p });
    if (r?.status === 'ok') {
      setIniData(r.data || {});
      setIniPath(p);
      setExpandedSections(new Set(Object.keys(r.data || {}).slice(0, 3)));
      setPendingChanges({});
    } else {
      showMsg(r?.message || 'Failed to read INI', 'error');
    }
    setLoading(false);
  };

  const browse = async () => {
    const p = await eb()?.ipcInvoke?.('dialog:open-file', {
      title: 'Open INI File',
      filters: [{ name: 'INI Files', extensions: ['ini'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (p) loadIni(p);
  };

  const saveChanges = async () => {
    if (!iniPath || Object.keys(pendingChanges).length === 0) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('ini:write', { path: iniPath, values: pendingChanges });
    if (r?.status === 'ok') {
      showMsg(`Saved — backup at ${r.backup}`);
      setIniData(prev => {
        const next = { ...prev };
        for (const [sec, keys] of Object.entries(pendingChanges)) {
          next[sec] = { ...(next[sec] || {}), ...keys };
        }
        return next;
      });
      setPendingChanges({});
    } else {
      showMsg(r?.message || 'Save failed', 'error');
    }
    setLoading(false);
  };

  const applyPreset = async (preset: string) => {
    if (!iniPath) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('ini:apply-preset', { path: iniPath, preset });
    if (r?.status === 'ok') {
      showMsg(`Applied ${preset} preset — backup at ${r.backup}`);
      loadIni();
    } else {
      showMsg(r?.message || 'Preset failed', 'error');
    }
    setLoading(false);
  };

  const validate = async () => {
    if (!iniPath) return;
    setLoading(true);
    const r = await eb()?.ipcInvoke?.('ini:validate', { path: iniPath });
    if (r?.status === 'ok') {
      setWarnings(r.warnings || []);
      setActiveTab('validate');
    } else {
      showMsg(r?.message || 'Validation failed', 'error');
    }
    setLoading(false);
  };

  const toggleSection = (s: string) => setExpandedSections(prev => {
    const n = new Set(prev);
    n.has(s) ? n.delete(s) : n.add(s);
    return n;
  });

  const updateValue = (section: string, key: string, value: string) => {
    setPendingChanges(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }));
    setIniData(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }));
  };

  const matchesSearch = (section: string, key: string) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return section.toLowerCase().includes(q) || key.toLowerCase().includes(q) ||
      (iniData[section]?.[key] || '').toLowerCase().includes(q);
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="h-full flex flex-col bg-[#050910] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">INI Tweaker</h1>
          <p className="text-xs text-slate-500">Smart Fallout 4 / Skyrim INI editor with known settings database</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasChanges && (
            <button onClick={saveChanges} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs hover:bg-emerald-600/30 transition-colors">
              <Save className="w-3.5 h-3.5" /> Save ({Object.keys(pendingChanges).length})
            </button>
          )}
          {iniPath && (
            <button onClick={validate} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-600/30 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" /> Validate
            </button>
          )}
        </div>
      </div>

      {/* File picker */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {detectedFiles.slice(0, 6).map(f => (
            <button key={f.path} onClick={() => loadIni(f.path)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${iniPath === f.path ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {f.name}
            </button>
          ))}
        </div>
        <button onClick={browse} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:border-slate-600 transition-colors shrink-0">
          <FolderOpen className="w-3.5 h-3.5" /> Browse
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`px-6 py-2 text-xs flex items-center gap-2 ${msgType === 'ok' ? 'text-emerald-400 bg-emerald-500/5' : 'text-red-400 bg-red-500/5'} border-b border-slate-800`}>
          {msgType === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-800 flex gap-0">
        {(['editor', 'presets', 'validate'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${activeTab === t ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t} {t === 'validate' && warnings.length > 0 ? `(${warnings.length})` : ''}
          </button>
        ))}
        {activeTab === 'editor' && iniPath && (
          <div className="ml-auto flex items-center py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search settings…"
                className="pl-8 pr-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 w-44" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">

        {/* ── Editor tab ── */}
        {activeTab === 'editor' && (
          <div className="space-y-2">
            {!iniPath && (
              <div className="text-center text-slate-600 py-16">
                <Sliders className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Select an INI file above to start editing</p>
              </div>
            )}
            {Object.entries(iniData).map(([section, keys]) => {
              const sectionKeys = Object.entries(keys).filter(([key]) => matchesSearch(section, key));
              if (sectionKeys.length === 0) return null;
              const expanded = expandedSections.has(section);
              return (
                <div key={section} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                  <button onClick={() => toggleSection(section)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors">
                    {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                    <span className="text-xs font-bold text-emerald-400">[{section}]</span>
                    <span className="text-xs text-slate-600">{sectionKeys.length} settings</span>
                    {Object.keys(pendingChanges[section] || {}).length > 0 && (
                      <span className="ml-auto text-xs text-amber-400">● unsaved</span>
                    )}
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-700/50 divide-y divide-slate-800/50">
                      {sectionKeys.map(([key, value]) => {
                        const known = knownSettings[section]?.[key];
                        const isPending = !!pendingChanges[section]?.[key];
                        return (
                          <div key={key} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/20 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-mono font-semibold ${isPending ? 'text-amber-300' : 'text-slate-300'}`}>{key}</span>
                                {known && <span className="text-[10px] text-slate-600 truncate">{known.desc}</span>}
                              </div>
                              {known && (known.low !== null && known.low !== undefined) && (
                                <div className="text-[10px] text-slate-700 mb-1">
                                  Low: {known.low} · Default: {known.default} · High: {known.high}
                                </div>
                              )}
                            </div>
                            <input
                              value={iniData[section]?.[key] ?? value}
                              onChange={e => updateValue(section, key, e.target.value)}
                              className={`w-40 shrink-0 px-2 py-1 rounded bg-slate-800 border text-xs font-mono text-right focus:outline-none transition-colors ${isPending ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-300 focus:border-emerald-500/50'}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Presets tab ── */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            {!iniPath && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                Open an INI file first (use the quick-select buttons or Browse above) before applying a preset.
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {PRESETS.map(preset => (
                <div key={preset} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700 hover:border-slate-600 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-white">{preset}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {preset === 'Ultra' && 'Max quality — RTX 3080+ or equivalent'}
                      {preset === 'High' && 'High quality — RTX 2070+ / RX 6700+'}
                      {preset === 'Medium' && 'Balanced quality and performance'}
                      {preset === 'Low' && 'Performance focused — older GPUs'}
                      {preset === 'Potato' && 'Maximum FPS — minimal visual settings'}
                    </div>
                  </div>
                  <button onClick={() => applyPreset(preset)} disabled={!iniPath || loading}
                    className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs hover:bg-emerald-600/30 transition-colors disabled:opacity-40">
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Validate tab ── */}
        {activeTab === 'validate' && (
          <div className="space-y-3">
            {warnings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-emerald-400">
                <CheckCircle className="w-10 h-10" />
                <p className="text-sm">No issues detected in the INI file</p>
                {iniPath && <button onClick={validate} className="text-xs text-slate-500 hover:text-slate-300">Re-validate</button>}
              </div>
            ) : (
              <>
                <div className="text-xs text-amber-400 mb-1">{warnings.length} issue{warnings.length !== 1 ? 's' : ''} found</div>
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-mono text-amber-300">[{w.section}] {w.key}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{w.msg}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default INITweaker;
