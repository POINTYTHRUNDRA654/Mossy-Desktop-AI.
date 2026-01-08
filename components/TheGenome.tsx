import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Dna, Zap, Plus, Code, CheckCircle2, AlertTriangle, Fingerprint, Microscope, Activity, ArrowRight, Loader2, Play, Cpu } from 'lucide-react';

interface Gene {
    id: string;
    name: string;
    description: string;
    version: string;
    type: 'core' | 'synthetic';
    status: 'active' | 'evolving' | 'dormant';
    code?: string;
}

const initialGenes: Gene[] = [
    { id: '1', name: 'Natural Language Processor', description: 'Core linguistic understanding engine.', version: '3.5.0', type: 'core', status: 'active' },
    { id: '2', name: 'Visual Cortex', description: 'Image generation and analysis subsystem.', version: '2.1.0', type: 'core', status: 'active' },
    { id: '3', name: 'Code Synthesizer', description: 'Polyglot programming capability.', version: '4.0.0', type: 'core', status: 'active' },
    { id: '4', name: 'Web Scraper Logic', description: 'Custom trait: Parse HTML structure.', version: '1.0.0', type: 'synthetic', status: 'active' },
];

const TheGenome: React.FC = () => {
    const [genes, setGenes] = useState<Gene[]>(initialGenes);
    const [prompt, setPrompt] = useState('');
    const [isEvolving, setIsEvolving] = useState(false);
    const [evolutionStage, setEvolutionStage] = useState(0); // 0: Idle, 1: Sequencing, 2: Coding, 3: Integrating
    const [generatedCode, setGeneratedCode] = useState('');
    const [newGeneName, setNewGeneName] = useState('');

    const handleEvolve = async () => {
        if (!prompt) return;
        setIsEvolving(true);
        setEvolutionStage(1);
        setGeneratedCode('');
        setNewGeneName('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Stage 1: Sequencing (Analysis)
            await new Promise(r => setTimeout(r, 1500));
            setEvolutionStage(2);

            // Stage 2: Coding (Generation)
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Create a TypeScript function for an AI assistant capability described as: "${prompt}".
                Return a JSON object with:
                1. "name": A cool, technical name for this skill (e.g. "Sentiment_Analyzer_v1").
                2. "code": The typescript function logic.
                3. "description": A brief technical description.`,
                config: { responseMimeType: 'application/json' }
            });

            const result = JSON.parse(response.text);
            setGeneratedCode(result.code);
            setNewGeneName(result.name);
            
            // Artificial delay for effect
            await new Promise(r => setTimeout(r, 1000));
            
            setEvolutionStage(3);

        } catch (e) {
            console.error(e);
            setIsEvolving(false);
            setEvolutionStage(0);
        }
    };

    const handleIntegrate = () => {
        const newGene: Gene = {
            id: Date.now().toString(),
            name: newGeneName,
            description: `Auto-evolved trait: ${prompt}`,
            version: '1.0.0',
            type: 'synthetic',
            status: 'active',
            code: generatedCode
        };
        
        setGenes(prev => [...prev, newGene]);
        setIsEvolving(false);
        setEvolutionStage(0);
        setPrompt('');
        setGeneratedCode('');
    };

    return (
        <div className="h-full flex flex-col bg-[#050910] text-slate-200 font-sans relative overflow-hidden">
            {/* Ambient DNA Background */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                <svg width="100%" height="100%">
                    <pattern id="dna-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M50 0 Q 75 25 50 50 Q 25 75 50 100" stroke="#10b981" strokeWidth="1" fill="none" />
                        <path d="M50 0 Q 25 25 50 50 Q 75 75 50 100" stroke="#3b82f6" strokeWidth="1" fill="none" />
                        <line x1="35" y1="25" x2="65" y2="25" stroke="#4b5563" strokeWidth="1" />
                        <line x1="35" y1="75" x2="65" y2="75" stroke="#4b5563" strokeWidth="1" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#dna-pattern)" />
                </svg>
            </div>

            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Dna className="w-8 h-8 text-forge-accent animate-pulse-slow" />
                        The Genome
                    </h1>
                    <p className="text-xs text-slate-400 font-mono mt-1">Self-Modification & Trait Evolution Engine</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 uppercase">Core Stability</div>
                        <div className="text-emerald-400 font-mono">99.9%</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 uppercase">Active Traits</div>
                        <div className="text-blue-400 font-mono">{genes.length}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden z-10">
                {/* Left: Active Genes */}
                <div className="flex-1 p-8 overflow-y-auto">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Fingerprint className="w-4 h-4" /> Active Sequence
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {genes.map(gene => (
                            <div 
                                key={gene.id} 
                                className={`relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                                    gene.type === 'core' 
                                    ? 'bg-slate-900/50 border-slate-700 hover:border-blue-500/50 hover:shadow-blue-500/10' 
                                    : 'bg-emerald-900/10 border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-lg ${
                                        gene.type === 'core' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                                    }`}>
                                        {gene.type === 'core' ? <Cpu className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-500">v{gene.version}</div>
                                </div>
                                <h3 className="font-bold text-slate-200 mb-1">{gene.name}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-3">{gene.description}</p>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                                    <div className={`w-1.5 h-1.5 rounded-full ${gene.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                                    <span className={gene.status === 'active' ? 'text-emerald-500' : 'text-yellow-500'}>{gene.status}</span>
                                </div>
                                {gene.type === 'synthetic' && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <div className="w-2 h-2 rounded-full bg-forge-accent shadow-[0_0_10px_#38bdf8]"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Evolution Panel */}
                <div className="w-[450px] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
                    <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Microscope className="w-4 h-4 text-purple-400" /> Evolution Chamber
                        </h3>
                    </div>

                    <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
                        {/* Status Display */}
                        {isEvolving ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
                                        <div className={`absolute inset-0 rounded-full border-4 border-forge-accent border-t-transparent animate-spin ${evolutionStage >= 3 ? 'hidden' : ''}`}></div>
                                        <Dna className={`w-12 h-12 ${evolutionStage === 3 ? 'text-emerald-400' : 'text-slate-600'}`} />
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-forge-accent">
                                        STAGE {evolutionStage}/3
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className={`text-sm font-bold transition-colors ${evolutionStage >= 1 ? 'text-white' : 'text-slate-600'}`}>1. Sequencing DNA...</div>
                                    <div className={`text-sm font-bold transition-colors ${evolutionStage >= 2 ? 'text-white' : 'text-slate-600'}`}>2. Synthesizing Logic...</div>
                                    <div className={`text-sm font-bold transition-colors ${evolutionStage >= 3 ? 'text-white' : 'text-slate-600'}`}>3. Verification...</div>
                                </div>

                                {evolutionStage === 3 && (
                                    <div className="w-full bg-black rounded-lg border border-slate-700 p-4 text-left animate-fade-in">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-emerald-400">{newGeneName}</span>
                                            <Code className="w-3 h-3 text-slate-500" />
                                        </div>
                                        <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-40 custom-scrollbar">
                                            {generatedCode}
                                        </pre>
                                        <button 
                                            onClick={handleIntegrate}
                                            className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Integrate Trait
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-white/5 mb-6">
                                    <h4 className="text-lg font-bold text-white mb-2">Mutate Capabilities</h4>
                                    <p className="text-sm text-slate-400 mb-4">
                                        Describe a new skill or behavior. Mossy will generate the underlying logic and integrate it into her neural pathways.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">Stock Analysis</span>
                                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">File Sorting</span>
                                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">Log Parsing</span>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Desired Trait Description</label>
                                    <textarea 
                                        className="w-full h-32 bg-black/50 border border-slate-700 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-forge-accent resize-none mb-4"
                                        placeholder="e.g. 'Monitor local port 3000 and alert me if it closes' or 'Summarize daily news from RSS feed'..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleEvolve}
                                        disabled={!prompt}
                                        className="w-full py-4 bg-forge-accent hover:bg-sky-400 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        <Zap className="w-5 h-5 fill-current group-hover:animate-pulse" />
                                        Initiate Evolution
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TheGenome;