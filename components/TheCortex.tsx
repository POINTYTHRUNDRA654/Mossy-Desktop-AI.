import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BrainCircuit, Book, Link, Youtube, FileText, Plus, Trash2, Cpu, Zap, Activity, Sliders, CheckCircle2, RotateCcw, Lock, RefreshCw, Upload, Globe, Bookmark, FileCode, Play, Pause } from 'lucide-react';

interface KnowledgeSource {
  id: string;
  type: 'pdf' | 'web' | 'youtube' | 'text' | 'code';
  name: string;
  source: string;
  status: 'queued' | 'reading' | 'analyzing' | 'indexed' | 'error';
  progress: number; // 0-100
  tokens: number;
  tags: string[];
}

interface PersonalityConfig {
  creativity: number;
  precision: number;
  empathy: number;
  verbosity: number;
}

const TheCortex: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([
      { id: '1', type: 'web', name: 'React 19 Documentation', source: 'react.dev/blog/react-19', status: 'indexed', progress: 100, tokens: 14205, tags: ['dev', 'official'] },
      { id: '2', type: 'pdf', name: 'Advanced_Machine_Learning.pdf', source: 'D:/Tutorials/AI', status: 'indexed', progress: 100, tokens: 89000, tags: ['science', 'local'] },
      { id: '3', type: 'youtube', name: 'Blender Geometry Nodes Deep Dive', source: 'youtube.com/watch?v=xyz', status: 'indexed', progress: 100, tokens: 3400, tags: ['3d', 'creative'] },
  ]);
  
  const [config, setConfig] = useState<PersonalityConfig>({
      creativity: 0.7,
      precision: 40,
      empathy: 0.8,
      verbosity: 0.5
  });

  const [newInput, setNewInput] = useState('');
  const [addMode, setAddMode] = useState<'web' | 'text' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Study Simulation Loop ---
  useEffect(() => {
      if (!isStudying) return;

      const interval = setInterval(() => {
          setSources(prev => {
              const next = [...prev];
              let allDone = true;

              for (let i = 0; i < next.length; i++) {
                  const s = next[i];
                  if (s.status === 'queued' || s.status === 'reading' || s.status === 'analyzing') {
                      allDone = false;
                      
                      // State transitions
                      if (s.status === 'queued') next[i].status = 'reading';
                      else if (s.status === 'reading' && s.progress >= 50) next[i].status = 'analyzing';
                      
                      // Progress increment
                      if (s.progress < 100) {
                          next[i].progress += Math.floor(Math.random() * 5) + 1;
                      } else {
                          next[i].status = 'indexed';
                          next[i].tokens = Math.floor(Math.random() * 5000) + 500;
                      }
                  }
              }

              if (allDone) setIsStudying(false);
              return next;
          });
      }, 200);

      return () => clearInterval(interval);
  }, [isStudying]);

  // --- Handlers ---

  const handleUrlInput = async () => {
      if (!newInput) return;
      
      const newSource: KnowledgeSource = {
          id: Date.now().toString(),
          type: newInput.includes('youtu') ? 'youtube' : 'web',
          name: newInput.replace('https://', '').replace('www.', '').split('/')[0] + '/...',
          source: newInput,
          status: 'queued',
          progress: 0,
          tokens: 0,
          tags: ['web-import']
      };

      setSources(prev => [newSource, ...prev]);
      setNewInput('');
      setIsStudying(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newSources: KnowledgeSource[] = Array.from(files).map((f: File) => ({
          id: Math.random().toString(36).substr(2, 9),
          type: f.name.endsWith('.pdf') ? 'pdf' : f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.py') ? 'code' : 'text',
          name: f.name,
          source: 'Local File',
          status: 'queued',
          progress: 0,
          tokens: 0,
          tags: ['local-import']
      }));

      setSources(prev => [...newSources, ...prev]);
      setIsStudying(true);
  };

  const handleImportBookmarks = () => {
      setIsProcessing(true);
      // Simulate fetching from browser
      setTimeout(() => {
          const bookmarks: KnowledgeSource[] = [
              { id: 'bm-1', type: 'web', name: 'MDN Web Docs - Arrays', source: 'developer.mozilla.org', status: 'queued', progress: 0, tokens: 0, tags: ['bookmark'] },
              { id: 'bm-2', type: 'web', name: 'Python 3.11 Tutorial', source: 'docs.python.org', status: 'queued', progress: 0, tokens: 0, tags: ['bookmark'] },
              { id: 'bm-3', type: 'youtube', name: 'Complete React Course', source: 'youtube.com/playlist', status: 'queued', progress: 0, tokens: 0, tags: ['bookmark'] }
          ];
          setSources(prev => [...bookmarks, ...prev]);
          setIsProcessing(false);
          setIsStudying(true);
      }, 1500);
  };

  const removeSource = (id: string) => {
      setSources(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-[#080c14] text-slate-200 font-sans overflow-hidden relative">
      {/* Background Neural Net Effect */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[100px] animate-pulse"></div>
          <svg className="absolute inset-0 w-full h-full opacity-10">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5"/>
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
      </div>

      <div className="relative z-10 flex-1 flex flex-col md:flex-row h-full">
          
          {/* Left: Configuration & Stats */}
          <div className="w-full md:w-80 bg-slate-900/80 border-r border-slate-800 backdrop-blur-md p-6 flex flex-col gap-8 overflow-y-auto">
              <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                      <BrainCircuit className="w-8 h-8 text-emerald-400" />
                      The Cortex
                  </h1>
                  <p className="text-xs text-slate-400 font-mono">Neural Knowledge Base</p>
              </div>

              {/* Status Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Learning Status
                  </h3>
                  <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total Memories</span>
                          <span className="text-emerald-400 font-mono">{sources.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Active Context</span>
                          <span className="text-slate-200 font-mono">{sources.reduce((a,b) => a + b.tokens, 0).toLocaleString()} toks</span>
                      </div>
                      {isStudying ? (
                          <div className="flex items-center gap-2 text-xs text-yellow-400 font-bold animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Absorbing new data...
                          </div>
                      ) : (
                          <div className="flex items-center gap-2 text-xs text-emerald-500 font-bold">
                              <CheckCircle2 className="w-3 h-3" /> All systems nominal
                          </div>
                      )}
                  </div>
              </div>

              {/* Personality Sliders */}
              <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Sliders className="w-3 h-3" /> Reasoning Matrix
                  </h3>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-slate-300">Creativity</span>
                          <span className="text-forge-accent">{config.creativity.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={config.creativity}
                        onChange={(e) => setConfig({...config, creativity: parseFloat(e.target.value)})}
                        className="w-full accent-forge-accent h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-slate-300">Precision</span>
                          <span className="text-purple-400">{config.precision}</span>
                      </div>
                      <input 
                        type="range" min="1" max="100" step="1"
                        value={config.precision}
                        onChange={(e) => setConfig({...config, precision: parseInt(e.target.value)})}
                        className="w-full accent-purple-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>
                  
                  <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 flex items-center justify-center gap-2 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Recalibrate
                  </button>
              </div>
          </div>

          {/* Right: Knowledge Base Manager */}
          <div className="flex-1 p-6 md:p-10 flex flex-col max-w-6xl mx-auto w-full">
               
               {/* Ingestion Zone */}
               <div className="bg-slate-900/50 border border-emerald-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                       <Zap className="w-32 h-32 text-emerald-400" />
                   </div>
                   
                   <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                       <Upload className="w-5 h-5 text-emerald-400" /> Feed the Machine
                   </h2>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                       {/* URL Input */}
                       <div className="bg-black/40 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
                           <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                               <Globe className="w-3 h-3" /> Web Resource
                           </label>
                           <input 
                               type="text" 
                               value={newInput}
                               onChange={(e) => setNewInput(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleUrlInput()}
                               placeholder="Paste tutorial URL..."
                               className="bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500"
                           />
                           <button 
                               onClick={handleUrlInput}
                               disabled={!newInput}
                               className="w-full py-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                           >
                               Ingest URL
                           </button>
                       </div>

                       {/* File Drop Simulation */}
                       <div className="bg-black/40 rounded-xl p-4 border border-slate-700 flex flex-col gap-3 relative">
                           <input 
                               type="file" 
                               multiple 
                               ref={fileInputRef}
                               className="absolute inset-0 opacity-0 cursor-pointer z-20"
                               onChange={handleFileUpload}
                           />
                           <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                               <FileText className="w-3 h-3" /> Local Files
                           </label>
                           <div className="flex-1 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center text-slate-500 text-xs hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all">
                               Drag PDFs, Code, or Text here
                           </div>
                       </div>

                       {/* Browser Sync */}
                       <div className="bg-black/40 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
                           <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                               <Bookmark className="w-3 h-3" /> Browser Sync
                           </label>
                           <p className="text-[10px] text-slate-500 leading-tight">
                               Import bookmarks from your 'Learning' folder in Chrome/Edge.
                           </p>
                           <button 
                               onClick={handleImportBookmarks}
                               disabled={isProcessing}
                               className="mt-auto w-full py-2 bg-blue-900/30 hover:bg-blue-600 border border-blue-500/30 text-blue-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                           >
                               {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                               Sync Bookmarks
                           </button>
                       </div>
                   </div>
               </div>

               {/* Learning Queue / Index */}
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                       <span>Knowledge Graph Index</span>
                       {isStudying && <span className="text-emerald-400 animate-pulse">ACTIVE PROCESSING</span>}
                   </h3>

                   <div className="space-y-3">
                       {sources.map((source) => (
                           <div key={source.id} className="bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 rounded-xl p-3 flex items-center gap-4 transition-all group relative overflow-hidden">
                               
                               {/* Progress Bar Background */}
                               {source.status !== 'indexed' && (
                                   <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/50 transition-all duration-300" style={{ width: `${source.progress}%` }}></div>
                               )}

                               {/* Icon */}
                               <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                   source.type === 'pdf' ? 'bg-red-500/10 text-red-400' :
                                   source.type === 'web' ? 'bg-blue-500/10 text-blue-400' :
                                   source.type === 'youtube' ? 'bg-purple-500/10 text-purple-400' :
                                   source.type === 'code' ? 'bg-yellow-500/10 text-yellow-400' :
                                   'bg-slate-700/50 text-slate-400'
                               }`}>
                                   {source.type === 'pdf' ? <FileText className="w-5 h-5" /> :
                                    source.type === 'web' ? <Globe className="w-5 h-5" /> :
                                    source.type === 'youtube' ? <Youtube className="w-5 h-5" /> :
                                    source.type === 'code' ? <FileCode className="w-5 h-5" /> :
                                    <FileText className="w-5 h-5" />}
                               </div>

                               {/* Info */}
                               <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2 mb-0.5">
                                       <h4 className="font-bold text-slate-200 text-sm truncate">{source.name}</h4>
                                       {source.status === 'indexed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                   </div>
                                   <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                       <span className="truncate max-w-[200px]">{source.source}</span>
                                       <span>|</span>
                                       <span className={source.status !== 'indexed' ? 'text-yellow-400' : 'text-slate-400'}>
                                           {source.status === 'indexed' ? `${source.tokens.toLocaleString()} tokens` : `${source.status.toUpperCase()} (${source.progress}%)`}
                                       </span>
                                   </div>
                               </div>

                               {/* Tags */}
                               <div className="hidden md:flex gap-2">
                                   {source.tags.map(tag => (
                                       <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">#{tag}</span>
                                   ))}
                               </div>

                               {/* Actions */}
                               <button 
                                 onClick={() => removeSource(source.id)}
                                 className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                               >
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           </div>
                       ))}
                   </div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default TheCortex;