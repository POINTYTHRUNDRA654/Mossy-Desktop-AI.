import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Container, Search, Filter, FolderPlus, Tag, HardDrive, FileImage, FileAudio, FileCode, BrainCircuit, RefreshCw, Eye, Grid, List, Scan, Check, Box } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'audio' | 'model' | 'script';
  tags: string[];
  previewUrl?: string;
  size: string;
  analyzed: boolean;
}

const initialAssets: Asset[] = [
    { id: '1', name: 'tex_metal_rust_01.png', path: 'D:/Assets/Textures', type: 'image', tags: ['metal', 'rust', 'texture'], previewUrl: 'https://placehold.co/400x400/3e2723/a1887f?text=Rust+Texture', size: '2.4 MB', analyzed: true },
    { id: '2', name: 'sfx_laser_blast.wav', path: 'D:/Assets/Audio/SciFi', type: 'audio', tags: ['sfx', 'sci-fi', 'weapon'], size: '0.5 MB', analyzed: true },
    { id: '3', name: 'char_cyber_ninja.nif', path: 'D:/Assets/Models', type: 'model', tags: [], size: '14.2 MB', analyzed: false },
    { id: '4', name: 'unknown_img_2991.jpg', path: 'D:/Downloads', type: 'image', tags: [], previewUrl: 'https://placehold.co/400x400/1e1e1e/38bdf8?text=Unsorted+Img', size: '1.1 MB', analyzed: false },
    { id: '5', name: 'script_player_move.psc', path: 'D:/Dev/Source', type: 'script', tags: ['gameplay', 'papyrus'], size: '4 KB', analyzed: true },
];

const TheVault: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter Logic
  const filteredAssets = assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = filterType === 'all' || asset.type === filterType;
      return matchesSearch && matchesType;
  });

  // --- AI Logic ---

  const handleScanFolder = () => {
      setIsScanning(true);
      // Simulate scanning disk
      setTimeout(() => {
          const newAssets: Asset[] = [
              { id: `new-${Date.now()}-1`, name: 'env_swamp_mist.png', path: 'D:/NewScans', type: 'image', tags: [], previewUrl: 'https://placehold.co/400x300/064e3b/34d399?text=Swamp', size: '3.1 MB', analyzed: false },
              { id: `new-${Date.now()}-2`, name: 'voc_npc_greeting.mp3', path: 'D:/NewScans', type: 'audio', tags: [], size: '1.2 MB', analyzed: false },
          ];
          setAssets(prev => [...prev, ...newAssets]);
          setIsScanning(false);
      }, 1500);
  };

  const handleAnalyze = async (asset: Asset) => {
      if (asset.analyzed) return;
      
      setAnalyzingIds(prev => new Set(prev).add(asset.id));
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          let generatedTags: string[] = [];
          
          if (asset.type === 'image') {
              // Simulate Image Analysis (In real app, send Base64 to Gemini Vision)
              // const result = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [imagePart, "Describe this texture"] });
              await new Promise(r => setTimeout(r, 1500)); // Sim latency
              generatedTags = ['environment', 'dark', 'foggy', 'organic', 'green'];
          } else if (asset.type === 'audio') {
               await new Promise(r => setTimeout(r, 1200));
               generatedTags = ['voice', 'human', 'greeting', 'friendly'];
          } else if (asset.type === 'model') {
              await new Promise(r => setTimeout(r, 2000));
              generatedTags = ['character', 'biped', 'armature', 'high-poly'];
          }

          setAssets(prev => prev.map(a => 
              a.id === asset.id 
              ? { ...a, analyzed: true, tags: [...a.tags, ...generatedTags] }
              : a
          ));
      } catch (e) {
          console.error("Analysis failed", e);
      } finally {
          setAnalyzingIds(prev => {
              const next = new Set(prev);
              next.delete(asset.id);
              return next;
          });
      }
  };

  const handleAnalyzeAll = () => {
      const unanalyzed = assets.filter(a => !a.analyzed);
      unanalyzed.forEach(a => handleAnalyze(a));
  };

  return (
    <div className="h-full flex flex-col bg-forge-dark text-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 bg-forge-panel flex flex-col gap-4 shadow-md z-10">
          <div className="flex justify-between items-center">
              <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Container className="w-6 h-6 text-forge-accent" />
                      The Vault
                  </h1>
                  <p className="text-xs text-slate-400 font-mono mt-1">Neural Asset Management System</p>
              </div>
              <div className="flex gap-2">
                  <button 
                      onClick={handleScanFolder}
                      disabled={isScanning}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-bold transition-colors"
                  >
                      {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                      {isScanning ? 'Scanning Disk...' : 'Index Folder'}
                  </button>
                  <button 
                      onClick={handleAnalyzeAll}
                      className="flex items-center gap-2 px-4 py-2 bg-forge-accent hover:bg-sky-400 text-slate-900 rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  >
                      <BrainCircuit className="w-4 h-4" />
                      Auto-Tag All
                  </button>
              </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-4">
              <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                      type="text" 
                      placeholder="Search assets by name, tag, or concept (e.g., 'rusty metal')..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-forge-accent text-slate-200"
                  />
              </div>
              <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-forge-accent"
              >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="audio">Audio</option>
                  <option value="model">3D Models</option>
                  <option value="script">Scripts</option>
              </select>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      <Grid className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      <List className="w-4 h-4" />
                  </button>
              </div>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#0c1220]">
          {filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                  <HardDrive className="w-12 h-12 mb-4 opacity-20" />
                  <p>No assets found matching your criteria.</p>
              </div>
          ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {filteredAssets.map(asset => (
                      <div key={asset.id} className="group relative bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-forge-accent transition-all hover:shadow-xl hover:shadow-sky-900/20">
                          {/* Preview Area */}
                          <div className="aspect-square bg-slate-900 relative overflow-hidden flex items-center justify-center">
                              {asset.previewUrl ? (
                                  <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              ) : (
                                  <div className="text-slate-600">
                                      {asset.type === 'audio' ? <FileAudio className="w-12 h-12" /> :
                                       asset.type === 'model' ? <Box className="w-12 h-12" /> :
                                       <FileCode className="w-12 h-12" />}
                                  </div>
                              )}
                              
                              {/* Overlay Actions */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button className="p-2 bg-slate-700 hover:bg-white hover:text-black rounded-full transition-colors" title="Preview">
                                      <Eye className="w-4 h-4" />
                                  </button>
                                  {!asset.analyzed && (
                                      <button 
                                          onClick={() => handleAnalyze(asset)}
                                          className="p-2 bg-forge-accent hover:bg-sky-400 text-slate-900 rounded-full transition-colors" 
                                          title="AI Analyze"
                                      >
                                          {analyzingIds.has(asset.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                                      </button>
                                  )}
                              </div>

                              {/* Type Badge */}
                              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur rounded text-[10px] uppercase font-bold text-slate-300">
                                  {asset.type}
                              </div>
                          </div>

                          {/* Info Area */}
                          <div className="p-3">
                              <div className="font-medium text-sm text-slate-200 truncate mb-1" title={asset.name}>{asset.name}</div>
                              <div className="flex flex-wrap gap-1 mb-2 h-12 overflow-hidden content-start">
                                  {asset.tags.length > 0 ? (
                                      asset.tags.map((tag, i) => (
                                          <span key={i} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px] hover:text-white cursor-default">
                                              #{tag}
                                          </span>
                                      ))
                                  ) : (
                                      <span className="text-[10px] text-slate-600 italic flex items-center gap-1">
                                          <Scan className="w-3 h-3" /> Untagged
                                      </span>
                                  )}
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-700 pt-2">
                                  <span className="truncate max-w-[100px]">{asset.size}</span>
                                  {asset.analyzed && <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Indexed</span>}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              // List View
              <div className="flex flex-col gap-2">
                  {filteredAssets.map(asset => (
                      <div key={asset.id} className="flex items-center gap-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-slate-500 transition-colors group">
                          <div className="w-10 h-10 bg-slate-900 rounded flex items-center justify-center shrink-0">
                               {asset.type === 'image' ? <FileImage className="w-5 h-5 text-purple-400" /> :
                                asset.type === 'audio' ? <FileAudio className="w-5 h-5 text-yellow-400" /> :
                                asset.type === 'model' ? <Box className="w-5 h-5 text-blue-400" /> :
                                <FileCode className="w-5 h-5 text-emerald-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-slate-200 truncate">{asset.name}</span>
                                  {!asset.analyzed && (
                                      <button 
                                        onClick={() => handleAnalyze(asset)}
                                        className="text-[10px] flex items-center gap-1 text-forge-accent hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                          <BrainCircuit className="w-3 h-3" /> Analyze
                                      </button>
                                  )}
                              </div>
                              <div className="text-xs text-slate-500 truncate font-mono">{asset.path}</div>
                          </div>
                          <div className="flex gap-2 max-w-[30%] flex-wrap justify-end">
                              {asset.tags.slice(0, 4).map((tag, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px]">
                                      #{tag}
                                  </span>
                              ))}
                          </div>
                          <div className="text-xs text-slate-500 w-16 text-right">{asset.size}</div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default TheVault;