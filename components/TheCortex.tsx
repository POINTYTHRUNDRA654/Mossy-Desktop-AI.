import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BrainCircuit, Book, Link, Youtube, FileText, Plus, Trash2, Cpu, Zap, Activity, Sliders, CheckCircle2, RotateCcw, Lock, RefreshCw } from 'lucide-react';

interface KnowledgeSource {
  id: string;
  type: 'pdf' | 'web' | 'youtube' | 'text';
  name: string;
  source: string;
  status: 'indexing' | 'active' | 'error';
  tokens: number;
}

interface PersonalityConfig {
  creativity: number; // Temperature
  precision: number; // TopK
  empathy: number; // Tone instruction
  verbosity: number; // Length
}

const TheCortex: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([
      { id: '1', type: 'web', name: 'Creation Kit Wiki - Papyrus', source: 'ck.uesp.net/wiki/Papyrus', status: 'active', tokens: 14205 },
      { id: '2', type: 'pdf', name: 'NifSkope_Manual_v2.pdf', source: 'Local File', status: 'active', tokens: 8900 },
      { id: '3', type: 'youtube', name: 'Blender 4.0 Geometry Nodes Guide', source: 'youtube.com/watch?v=xyz', status: 'active', tokens: 3400 },
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

  // --- Logic ---

  const handleAddSource = async () => {
      if (!newInput || !addMode) return;
      setIsProcessing(true);
      
      const newId = Date.now().toString();
      const newSource: KnowledgeSource = {
          id: newId,
          type: addMode,
          name: addMode === 'web' ? newInput.replace('https://', '').split('/')[0] : 'Custom Text Snippet',
          source: newInput,
          status: 'indexing',
          tokens: 0
      };

      setSources(prev => [...prev, newSource]);
      setNewInput('');
      setAddMode(null);

      // Simulate Indexing
      try {
          // In a real app, we would scrape here. 
          // We use Gemini to "hallucinate" the summary/tokens for the simulation to feel real.
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Simulate indexing a resource named "${newSource.name}". Return a JSON object with 'tokens' (integer between 500 and 5000) and 'status' ("active").`,
              config: { responseMimeType: 'application/json' }
          });
          
          const result = JSON.parse(response.text);
          
          setTimeout(() => {
              setSources(prev => prev.map(s => s.id === newId ? { ...s, status: 'active', tokens: result.tokens || 1000 } : s));
              setIsProcessing(false);
          }, 2000);
      } catch (e) {
          setSources(prev => prev.map(s => s.id === newId ? { ...s, status: 'error' } : s));
          setIsProcessing(false);
      }
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
                  <p className="text-xs text-slate-400 font-mono">Neural Knowledge & Personality Core</p>
              </div>

              {/* Status Card */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Synaptic Status
                  </h3>
                  <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total Tokens</span>
                          <span className="text-emerald-400 font-mono">{sources.reduce((a,b) => a + b.tokens, 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Context Window</span>
                          <span className="text-slate-200 font-mono">2M / 4M</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-1/2 animate-pulse"></div>
                      </div>
                  </div>
              </div>

              {/* Personality Sliders */}
              <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Sliders className="w-3 h-3" /> Personality Matrix
                  </h3>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-slate-300">Creativity (Temp)</span>
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
                          <span className="text-slate-300">Precision (TopK)</span>
                          <span className="text-purple-400">{config.precision}</span>
                      </div>
                      <input 
                        type="range" min="1" max="100" step="1"
                        value={config.precision}
                        onChange={(e) => setConfig({...config, precision: parseInt(e.target.value)})}
                        className="w-full accent-purple-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-slate-300">Empathy</span>
                          <span className="text-pink-400">{(config.empathy * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={config.empathy}
                        onChange={(e) => setConfig({...config, empathy: parseFloat(e.target.value)})}
                        className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                  </div>
                  
                  <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 flex items-center justify-center gap-2 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Reset to Default
                  </button>
              </div>
          </div>

          {/* Right: Knowledge Base Manager */}
          <div className="flex-1 p-6 md:p-10 flex flex-col max-w-5xl mx-auto w-full">
               
               {/* Controls */}
               <div className="flex justify-between items-end mb-6">
                   <div>
                       <h2 className="text-3xl font-bold text-white mb-2">Knowledge Base</h2>
                       <p className="text-slate-400">Manage the RAG sources Mossy uses to answer your queries.</p>
                   </div>
                   
                   <div className="flex gap-2">
                       <button 
                         onClick={() => setAddMode('web')} 
                         className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition-all ${addMode === 'web' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                       >
                           <Link className="w-4 h-4" /> Add URL
                       </button>
                       <button 
                         className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-500 cursor-not-allowed flex items-center gap-2 text-sm font-bold"
                         title="Local File Access requires Desktop Bridge (Active)"
                       >
                           <FileText className="w-4 h-4" /> Add PDF <Lock className="w-3 h-3" />
                       </button>
                   </div>
               </div>

               {/* Input Box for adding source */}
               {addMode && (
                   <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-4 mb-6 animate-fade-in flex gap-4 items-center">
                       <input 
                         type="text" 
                         autoFocus
                         placeholder={addMode === 'web' ? "https://example.com/documentation" : "Paste text content..."}
                         className="flex-1 bg-black/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                         value={newInput}
                         onChange={(e) => setNewInput(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                       />
                       <button 
                         onClick={handleAddSource}
                         disabled={!newInput || isProcessing}
                         className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition-colors"
                       >
                           {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                           Ingest
                       </button>
                       <button onClick={() => setAddMode(null)} className="text-slate-500 hover:text-white">Cancel</button>
                   </div>
               )}

               {/* Source List */}
               <div className="grid grid-cols-1 gap-4">
                   {sources.map((source) => (
                       <div key={source.id} className="bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 hover:border-forge-accent rounded-xl p-4 flex items-center gap-4 transition-all group">
                           {/* Icon */}
                           <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                               source.type === 'pdf' ? 'bg-red-500/10 text-red-400' :
                               source.type === 'web' ? 'bg-blue-500/10 text-blue-400' :
                               source.type === 'youtube' ? 'bg-purple-500/10 text-purple-400' :
                               'bg-slate-700/50 text-slate-400'
                           }`}>
                               {source.type === 'pdf' ? <FileText className="w-6 h-6" /> :
                                source.type === 'web' ? <Link className="w-6 h-6" /> :
                                source.type === 'youtube' ? <Youtube className="w-6 h-6" /> :
                                <FileText className="w-6 h-6" />}
                           </div>

                           {/* Info */}
                           <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2 mb-1">
                                   <h4 className="font-bold text-slate-200 truncate">{source.name}</h4>
                                   {source.status === 'active' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                   {source.status === 'indexing' && <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />}
                               </div>
                               <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                                   <span className="truncate max-w-[200px]">{source.source}</span>
                                   <span>|</span>
                                   <span className="text-slate-400">{source.tokens.toLocaleString()} tokens</span>
                               </div>
                           </div>

                           {/* Actions */}
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${source.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                   {source.status}
                               </div>
                               <button 
                                 onClick={() => removeSource(source.id)}
                                 className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                               >
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           </div>
                       </div>
                   ))}
               </div>

               {/* Empty State */}
               {sources.length === 0 && (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl m-4">
                       <Cpu className="w-16 h-16 mb-4 opacity-20" />
                       <p>Cortex Memory is empty.</p>
                       <p className="text-sm">Add documents or URLs to begin training.</p>
                   </div>
               )}
          </div>
      </div>
    </div>
  );
};

export default TheCortex;