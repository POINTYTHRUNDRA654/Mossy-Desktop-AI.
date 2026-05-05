import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Download, Copy, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';

interface PluginFile { source: string; destination: string; }
interface FomodPlugin { name: string; description: string; image: string; files: PluginFile[]; }
interface FomodGroup { name: string; type: string; plugins: FomodPlugin[]; }

const GROUP_TYPES = ['SelectAtLeastOne','SelectAny','SelectExactlyOne','SelectAll','SelectNone'];

const FOMODBuilder: React.FC = () => {
  const [modName, setModName] = useState('My Mod');
  const [author, setAuthor] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [nexusId, setNexusId] = useState('');
  const [groups, setGroups] = useState<FomodGroup[]>([{ name: 'Main Files', type: 'SelectAtLeastOne', plugins: [{ name: 'Standard', description: '', image: '', files: [{ source: '', destination: '' }] }] }]);
  const [requiredFiles, setRequiredFiles] = useState<PluginFile[]>([]);
  const [xmlOutput, setXmlOutput] = useState('');
  const [infoXml, setInfoXml] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<{valid:boolean;errors:string[];warnings:string[]}|null>(null);
  const [error, setError] = useState('');
  const [aiDesc, setAiDesc] = useState('');
  const [aiFiles, setAiFiles] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set([0]));
  const [templates, setTemplates] = useState<any[]>([]);
  const [health, setHealth] = useState(false);

  useEffect(() => { checkHealth(); loadTemplates(); }, []);

  const checkHealth = async () => {
    try { const r = await window.electronAPI?.ipcInvoke('fomod:health-check'); setHealth(r?.status === 'healthy'); } catch { setHealth(false); }
  };
  const loadTemplates = async () => {
    try { const r = await window.electronAPI?.ipcInvoke('fomod:templates'); if (r?.templates) setTemplates(r.templates); } catch {}
  };

  const addGroup = () => setGroups(g => [...g, { name: 'New Group', type: 'SelectAtLeastOne', plugins: [] }]);
  const removeGroup = (i: number) => setGroups(g => g.filter((_,idx)=>idx!==i));
  const updateGroup = (i: number, key: keyof FomodGroup, val: any) => setGroups(g => g.map((grp,idx) => idx===i ? { ...grp, [key]: val } : grp));
  const addPlugin = (gi: number) => setGroups(g => g.map((grp,idx) => idx===gi ? { ...grp, plugins: [...grp.plugins, { name: 'Option', description: '', image: '', files: [{ source: '', destination: '' }] }] } : grp));
  const removePlugin = (gi: number, pi: number) => setGroups(g => g.map((grp,idx) => idx===gi ? { ...grp, plugins: grp.plugins.filter((_,pidx)=>pidx!==pi) } : grp));
  const updatePlugin = (gi: number, pi: number, key: keyof FomodPlugin, val: any) => setGroups(g => g.map((grp,idx) => idx===gi ? { ...grp, plugins: grp.plugins.map((p,pidx) => pidx===pi ? { ...p, [key]: val } : p) } : grp));
  const toggleGroup = (i: number) => setExpandedGroups(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const generate = async () => {
    setLoading(true); setError(''); setXmlOutput(''); setInfoXml(''); setValidResult(null);
    try {
      const r = await window.electronAPI?.ipcInvoke('fomod:create-installer', { name: modName, author, version, description, nexus_id: nexusId, groups, required_files: requiredFiles });
      if (r?.status === 'ok') { setXmlOutput(r.module_config_xml||''); setInfoXml(r.info_xml||''); }
      else setError(r?.message || 'Generation failed');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const validate = async () => {
    if (!xmlOutput) { setError('Generate XML first'); return; }
    setValidating(true); setValidResult(null);
    try {
      const r = await window.electronAPI?.ipcInvoke('fomod:validate', { module_config_xml: xmlOutput });
      setValidResult({ valid: r?.valid, errors: r?.errors||[], warnings: r?.warnings||[] });
    } catch (e: any) { setError(String(e)); }
    setValidating(false);
  };

  const aiGenerate = async () => {
    if (!aiDesc) return;
    setLoading(true); setError('');
    try {
      const r = await window.electronAPI?.ipcInvoke('fomod:ai-generate', { description: aiDesc, mod_files: aiFiles.split('\n').filter(Boolean) });
      if (r?.groups) { setGroups(r.groups); if(r.name) setModName(r.name); }
      else setError(r?.message || 'AI generation failed');
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  const applyTemplate = (tpl: any) => { if(tpl.name) setModName(tpl.name); if(tpl.groups) setGroups(tpl.groups); };
  const downloadXml = (xml: string, filename: string) => { const a = document.createElement('a'); a.href = `data:text/xml;charset=utf-8,${encodeURIComponent(xml)}`; a.download = filename; a.click(); };
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500';

  return (
    <div className="h-full flex flex-col bg-forge-dark overflow-hidden">
      <div className="p-4 border-b border-slate-700 bg-forge-panel flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30"><Package className="w-5 h-5 text-purple-400"/></div>
          <div><h2 className="text-lg font-bold text-white">FOMOD Builder</h2><p className="text-xs text-slate-400 font-mono">ModuleConfig.xml generator for MO2 / Vortex / NMM</p></div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${health?'bg-emerald-500/10 border-emerald-500/30 text-emerald-400':'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${health?'bg-emerald-500':'bg-red-500'}`}/>{health?'Ready':'Offline'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Form */}
        <div className="w-96 border-r border-slate-800 overflow-y-auto p-4 space-y-5">
          {/* Templates */}
          {templates.length > 0 && (
            <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Load Template</label>
              <div className="flex flex-wrap gap-1">
                {templates.map((t,i) => <button key={i} onClick={()=>applyTemplate(t)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 rounded transition-colors">{t.name||`Template ${i+1}`}</button>)}
              </div>
            </div>
          )}

          {/* Mod info */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Mod Info</label>
            <input className={inp} placeholder="Mod name" value={modName} onChange={e=>setModName(e.target.value)}/>
            <div className="flex gap-2"><input className={inp} placeholder="Author" value={author} onChange={e=>setAuthor(e.target.value)}/><input className={inp + ' w-24 flex-shrink-0'} placeholder="1.0.0" value={version} onChange={e=>setVersion(e.target.value)}/></div>
            <textarea className={inp} rows={2} placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)}/>
            <input className={inp} placeholder="Nexus Mod ID (optional)" value={nexusId} onChange={e=>setNexusId(e.target.value)}/>
          </div>

          {/* Groups */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Install Groups</label>
              <button onClick={addGroup} className="flex items-center gap-1 px-2 py-1 bg-purple-700 hover:bg-purple-600 text-white text-[10px] rounded transition-colors"><Plus className="w-3 h-3"/>Add Group</button>
            </div>
            <div className="space-y-2">
              {groups.map((grp,gi) => (
                <div key={gi} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 transition-colors" onClick={()=>toggleGroup(gi)}>
                    {expandedGroups.has(gi)?<ChevronUp className="w-3.5 h-3.5 text-slate-400"/>:<ChevronDown className="w-3.5 h-3.5 text-slate-400"/>}
                    <span className="text-xs text-white font-bold flex-1 truncate">{grp.name}</span>
                    <span className="text-[10px] text-slate-500">{grp.plugins.length} options</span>
                    <button onClick={e=>{e.stopPropagation();removeGroup(gi)}} className="text-red-400 hover:text-red-300 ml-1"><Trash2 className="w-3 h-3"/></button>
                  </div>
                  {expandedGroups.has(gi) && (
                    <div className="px-3 pb-3 space-y-2 border-t border-slate-800 pt-2">
                      <div className="flex gap-2">
                        <input className={inp + ' flex-1'} placeholder="Group name" value={grp.name} onChange={e=>updateGroup(gi,'name',e.target.value)}/>
                        <select className={inp + ' w-36 flex-shrink-0'} value={grp.type} onChange={e=>updateGroup(gi,'type',e.target.value)}>
                          {GROUP_TYPES.map(t=><option key={t} value={t}>{t.replace('Select','')}</option>)}
                        </select>
                      </div>
                      {grp.plugins.map((p,pi) => (
                        <div key={pi} className="bg-slate-800 rounded p-2 space-y-1.5">
                          <div className="flex gap-1.5">
                            <input className={inp + ' flex-1'} placeholder="Option name" value={p.name} onChange={e=>updatePlugin(gi,pi,'name',e.target.value)}/>
                            <button onClick={()=>removePlugin(gi,pi)} className="text-red-400 hover:text-red-300 px-1"><Trash2 className="w-3 h-3"/></button>
                          </div>
                          <input className={inp} placeholder="Description" value={p.description} onChange={e=>updatePlugin(gi,pi,'description',e.target.value)}/>
                          {p.files.map((f,fi) => (
                            <div key={fi} className="flex gap-1">
                              <input className={inp + ' flex-1'} placeholder="src/" value={f.source} onChange={e=>{const nf=[...p.files];nf[fi]={...f,source:e.target.value};updatePlugin(gi,pi,'files',nf);}}/>
                              <span className="text-slate-600 self-center text-xs">→</span>
                              <input className={inp + ' flex-1'} placeholder="dest/" value={f.destination} onChange={e=>{const nf=[...p.files];nf[fi]={...f,destination:e.target.value};updatePlugin(gi,pi,'files',nf);}}/>
                            </div>
                          ))}
                        </div>
                      ))}
                      <button onClick={()=>addPlugin(gi)} className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"><Plus className="w-3 h-3"/>Add Option</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Generate */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">AI Suggest Structure</label>
            <textarea className={inp} rows={2} placeholder="Describe your mod options…" value={aiDesc} onChange={e=>setAiDesc(e.target.value)}/>
            <textarea className={inp + ' mt-1.5'} rows={3} placeholder="Mod files (one per line)" value={aiFiles} onChange={e=>setAiFiles(e.target.value)}/>
            <button onClick={aiGenerate} disabled={loading||!aiDesc} className="mt-2 w-full py-1.5 flex items-center justify-center gap-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors">
              {loading?<RefreshCw className="w-3 h-3 animate-spin"/>:<Wand2 className="w-3 h-3"/>} AI Generate Structure
            </button>
          </div>

          {/* Generate buttons */}
          <div className="flex gap-2">
            <button onClick={generate} disabled={loading} className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors shadow-lg">
              {loading?<RefreshCw className="w-4 h-4 animate-spin"/>:<Package className="w-4 h-4"/>} Generate XML
            </button>
          </div>

          {error && <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2"><AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5"/><p className="text-xs text-red-300">{error}</p></div>}
        </div>

        {/* XML Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900">
            <span className="text-xs font-bold text-slate-400">ModuleConfig.xml Preview</span>
            <div className="ml-auto flex gap-1.5">
              {xmlOutput && <>
                <button onClick={validate} disabled={validating} className="flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded transition-colors">{validating?<RefreshCw className="w-3 h-3 animate-spin"/>:<CheckCircle className="w-3 h-3"/>} Validate</button>
                <button onClick={()=>navigator.clipboard.writeText(xmlOutput)} className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"><Copy className="w-3 h-3"/></button>
                <button onClick={()=>downloadXml(xmlOutput,'ModuleConfig.xml')} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded transition-colors"><Download className="w-3 h-3"/> .xml</button>
                {infoXml && <button onClick={()=>downloadXml(infoXml,'info.xml')} className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"><Download className="w-3 h-3"/> info</button>}
              </>}
            </div>
          </div>
          {validResult && (
            <div className={`px-4 py-2 border-b text-xs flex items-center gap-2 ${validResult.valid?'bg-emerald-500/10 border-emerald-500/30 text-emerald-300':'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              {validResult.valid?<CheckCircle className="w-3.5 h-3.5"/>:<AlertCircle className="w-3.5 h-3.5"/>}
              {validResult.valid ? 'Valid FOMOD XML' : `Invalid: ${validResult.errors.join(' · ')}`}
              {validResult.warnings.length > 0 && <span className="text-amber-400 ml-2">⚠ {validResult.warnings.join(' · ')}</span>}
            </div>
          )}
          <pre className="flex-1 p-4 text-xs text-slate-300 font-mono overflow-auto bg-[#0d1117] whitespace-pre leading-relaxed">
            {xmlOutput || <span className="text-slate-700">XML will appear here after clicking Generate XML…</span>}
          </pre>
        </div>
      </div>
    </div>
  );
};
export default FOMODBuilder;
