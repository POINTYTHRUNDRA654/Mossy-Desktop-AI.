import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Library, Folder, File, AlertTriangle, Play, Settings, RefreshCw, Zap, ArrowDown, ArrowUp, Minus, Plus, Search, Layers, Database, Check } from 'lucide-react';

interface Mod {
    id: string;
    name: string;
    version: string;
    category: string;
    enabled: boolean;
    priority: number; // The visual load order in left pane
    conflicts: {
        overwrites: string[]; // IDs of mods this one overwrites
        overwrittenBy: string[]; // IDs of mods that overwrite this one
    };
    files: string[]; // Simulated file list
}

const initialMods: Mod[] = [
    { 
        id: 'dlc', name: 'DLC: Automatron', version: '1.0', category: 'DLC', enabled: true, priority: 0, 
        conflicts: { overwrites: [], overwrittenBy: [] }, 
        files: ['DLCRobot.esm', 'DLCRobot - Main.ba2'] 
    },
    { 
        id: 'ufo4p', name: 'Unofficial Fallout 4 Patch', version: '2.1.5', category: 'Bug Fixes', enabled: true, priority: 1, 
        conflicts: { overwrites: [], overwrittenBy: ['texture_opt'] }, 
        files: ['Unofficial Fallout 4 Patch.esp', 'Unofficial Fallout 4 Patch - Main.ba2'] 
    },
    { 
        id: 'cbbe', name: 'Caliente\'s Beautiful Bodies Enhancer', version: '2.6.3', category: 'Models/Textures', enabled: true, priority: 2, 
        conflicts: { overwrites: [], overwrittenBy: ['skin_texture'] }, 
        files: ['Meshes/Character/Female/FemaleBody.nif', 'Textures/Actors/Character/BaseHumanFemale/FemaleBody_d.dds'] 
    },
    { 
        id: 'vivid', name: 'Vivid Fallout - All in One', version: '1.9', category: 'Environment', enabled: true, priority: 3, 
        conflicts: { overwrites: [], overwrittenBy: ['better_roads'] }, 
        files: ['Textures/Landscape/Ground/Dirt01_d.dds', 'Textures/Landscape/Roads/Road01_d.dds'] 
    },
    { 
        id: 'better_roads', name: 'Better Roads', version: '1.0', category: 'Environment', enabled: true, priority: 4, 
        conflicts: { overwrites: ['vivid'], overwrittenBy: [] }, 
        files: ['Textures/Landscape/Roads/Road01_d.dds'] // This conflicts with vivid
    },
    { 
        id: 'skin_texture', name: 'Valkyr Female Face Texture', version: '1.0', category: 'Models/Textures', enabled: true, priority: 5, 
        conflicts: { overwrites: ['cbbe'], overwrittenBy: [] }, 
        files: ['Textures/Actors/Character/BaseHumanFemale/FemaleHead_d.dds'] 
    },
];

const TheOrganizer: React.FC = () => {
    const [mods, setMods] = useState<Mod[]>(initialMods);
    const [selectedModId, setSelectedModId] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [isSorting, setIsSorting] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const selectedMod = mods.find(m => m.id === selectedModId);

    const handleToggle = (id: string) => {
        setMods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    };

    const handleSort = async () => {
        setIsSorting(true);
        setAnalysisResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Prepare mod list for AI
            const modList = mods.map(m => `${m.name} [Category: ${m.category}]`).join('\n');
            
            const prompt = `
            Act as LOOT (Load Order Optimization Tool) for Mod Organizer 2.
            Analyze this list of mods and suggest an optimal load order priority (0 is top/first loaded, highest number is bottom/last loaded).
            Mods loaded later overwrite mods loaded earlier.
            
            Mods:
            ${modList}
            
            Rules:
            1. DLC and Unofficial Patches must be at the top (low priority number).
            2. Large texture packs (Vivid) should be lower than base game but higher than specific small texture replacers (Better Roads).
            3. Body meshes (CBBE) should be overwritten by specific skin textures.
            
            Return JSON: array of mod names in correct order.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });

            const sortedNames: string[] = JSON.parse(response.text);
            
            // Apply sort
            setMods(prev => {
                const newMods = [...prev];
                newMods.sort((a, b) => {
                    const idxA = sortedNames.findIndex(n => n.includes(a.name));
                    const idxB = sortedNames.findIndex(n => n.includes(b.name));
                    // If not found in AI list, keep relative position or put at end
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });
                // Re-assign priority numbers based on new index
                return newMods.map((m, i) => ({ ...m, priority: i }));
            });
            
            setAnalysisResult("Load order sorted successfully based on semantic categories and overwrite rules.");

        } catch (e) {
            console.error(e);
            setAnalysisResult("Sort failed. Neural network timeout.");
        } finally {
            setIsSorting(false);
        }
    };

    // Helper to get conflicting mod names
    const getModName = (id: string) => mods.find(m => m.id === id)?.name || id;

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] text-slate-200 font-sans text-sm">
            {/* Toolbar */}
            <div className="p-3 border-b border-black bg-[#2d2d2d] flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Library className="w-5 h-5 text-forge-accent" />
                        The Organizer
                    </h2>
                    <div className="h-6 w-px bg-slate-600"></div>
                    <div className="flex items-center gap-2">
                        <select className="bg-[#1e1e1e] border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none">
                            <option>Default Profile</option>
                            <option>Survival Mode</option>
                            <option>Testing</option>
                        </select>
                        <button className="p-1.5 bg-[#1e1e1e] border border-slate-600 rounded hover:bg-slate-700" title="Profile Settings">
                            <Settings className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Play className="w-4 h-4 text-green-500 absolute left-2 top-1.5" />
                        <select className="bg-[#1e1e1e] border border-slate-600 rounded pl-8 pr-2 py-1 text-xs text-white outline-none w-48 font-bold">
                            <option>Fallout 4</option>
                            <option>Fallout 4 Launcher</option>
                            <option>F4SE</option>
                            <option>Creation Kit</option>
                        </select>
                    </div>
                    <button className="px-4 py-1 bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600 rounded text-xs font-bold hover:from-slate-600 hover:to-slate-700">Run</button>
                    <div className="h-6 w-px bg-slate-600 mx-2"></div>
                    <button 
                        onClick={handleSort}
                        disabled={isSorting}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isSorting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-yellow-400" />}
                        Sort
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Mod List */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-black bg-[#252526]">
                    {/* Filter Bar */}
                    <div className="p-2 border-b border-black flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Filter mods..." 
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-slate-600 rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-forge-accent"
                            />
                        </div>
                    </div>

                    {/* Header Row */}
                    <div className="grid grid-cols-[40px_1fr_100px_40px] bg-[#333333] text-[10px] text-slate-300 font-bold border-b border-black p-1 select-none">
                        <div className="text-center">Priority</div>
                        <div className="pl-2">Mod Name</div>
                        <div>Category</div>
                        <div className="text-center">Flags</div>
                    </div>

                    {/* Mod Rows */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {mods
                            .filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
                            .sort((a, b) => a.priority - b.priority)
                            .map((mod) => (
                            <div 
                                key={mod.id}
                                onClick={() => setSelectedModId(mod.id)}
                                className={`grid grid-cols-[40px_1fr_100px_40px] items-center p-1 border-b border-[#2a2a2a] cursor-pointer hover:bg-[#2a2d3e] text-xs transition-colors ${
                                    selectedModId === mod.id ? 'bg-[#094771] text-white hover:bg-[#094771]' : 
                                    !mod.enabled ? 'text-slate-500 italic' : 'text-slate-200'
                                }`}
                            >
                                <div className="text-center font-mono text-slate-500">{mod.priority}</div>
                                <div className="flex items-center gap-2 pl-2 overflow-hidden">
                                    <input 
                                        type="checkbox" 
                                        checked={mod.enabled}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleToggle(mod.id);
                                        }}
                                        className="w-3 h-3 rounded-sm border-slate-600 bg-[#1e1e1e]"
                                    />
                                    <span className="truncate">{mod.name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">{mod.category}</div>
                                <div className="flex justify-center gap-1">
                                    {mod.conflicts.overwrites.length > 0 && <span className="text-green-500 text-[10px] font-bold">+</span>}
                                    {mod.conflicts.overwrittenBy.length > 0 && <span className="text-red-500 text-[10px] font-bold">-</span>}
                                    {mod.conflicts.overwrites.length > 0 && mod.conflicts.overwrittenBy.length > 0 && <span className="text-yellow-500 text-[10px] font-bold">⚡</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="p-1 bg-[#333333] border-t border-black text-[10px] text-slate-400 text-center">
                        Active: {mods.filter(m => m.enabled).length} / Total: {mods.length}
                    </div>
                </div>

                {/* Right Pane: Details & Conflicts */}
                <div className="w-80 bg-[#1e1e1e] flex flex-col">
                    {selectedMod ? (
                        <>
                            <div className="p-3 border-b border-black bg-[#2d2d2d] font-bold text-slate-200 truncate" title={selectedMod.name}>
                                {selectedMod.name}
                            </div>
                            
                            {/* Fake Tabs */}
                            <div className="flex border-b border-black text-xs">
                                <div className="px-3 py-1.5 bg-[#1e1e1e] text-slate-200 border-t-2 border-forge-accent">Conflicts</div>
                                <div className="px-3 py-1.5 bg-[#252526] text-slate-500 border-t-2 border-transparent hover:text-slate-300 cursor-pointer">Files</div>
                                <div className="px-3 py-1.5 bg-[#252526] text-slate-500 border-t-2 border-transparent hover:text-slate-300 cursor-pointer">Text</div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {/* Overwritten By (Red) */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <ArrowDown className="w-3 h-3 text-red-500" /> Overwritten By (Loser)
                                    </h4>
                                    {selectedMod.conflicts.overwrittenBy.length > 0 ? (
                                        <div className="space-y-1">
                                            {selectedMod.conflicts.overwrittenBy.map(id => (
                                                <div key={id} className="flex items-center gap-2 p-2 bg-red-900/10 border border-red-900/30 rounded text-xs text-red-200">
                                                    <Layers className="w-3 h-3" />
                                                    {getModName(id)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-600 italic">No mods overwrite this one.</div>
                                    )}
                                </div>

                                {/* Overwrites (Green) */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <ArrowUp className="w-3 h-3 text-green-500" /> Overwrites (Winner)
                                    </h4>
                                    {selectedMod.conflicts.overwrites.length > 0 ? (
                                        <div className="space-y-1">
                                            {selectedMod.conflicts.overwrites.map(id => (
                                                <div key={id} className="flex items-center gap-2 p-2 bg-green-900/10 border border-green-900/30 rounded text-xs text-green-200">
                                                    <Layers className="w-3 h-3" />
                                                    {getModName(id)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-600 italic">This mod does not overwrite others.</div>
                                    )}
                                </div>

                                {/* File Preview Logic */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Database className="w-3 h-3" /> VFS Preview
                                    </h4>
                                    <div className="bg-black border border-slate-700 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto">
                                        {selectedMod.files.map((f, i) => (
                                            <div key={i} className="flex items-center gap-1">
                                                <File className="w-3 h-3 text-slate-600" />
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">
                                        These files are mapped to /Data/ in the virtual file system.
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                            <Layers className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a mod to view conflicts and file structure.</p>
                        </div>
                    )}
                    
                    {/* Status Bar for Right Pane */}
                    {analysisResult && (
                        <div className="p-2 bg-slate-800 border-t border-black text-xs text-green-400 flex items-center gap-2 animate-fade-in">
                            <Check className="w-3 h-3" />
                            {analysisResult}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TheOrganizer;