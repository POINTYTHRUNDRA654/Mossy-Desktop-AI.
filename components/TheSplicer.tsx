import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Binary, Search, Eye, Cpu, Zap, FileCode, AlertTriangle, CheckCircle2, RefreshCw, Upload, Download, Scan } from 'lucide-react';

const TheSplicer: React.FC = () => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [bytes, setBytes] = useState<Uint8Array | null>(null);
    const [cursor, setCursor] = useState<number | null>(null);
    const [hexView, setHexView] = useState<string[]>([]);
    
    // AI Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [structureMap, setStructureMap] = useState<{ start: number; end: number; label: string; color: string }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const renderHex = (data: Uint8Array) => {
        const lines = [];
        for (let i = 0; i < data.length; i += 16) {
            const chunk = data.slice(i, i + 16);
            let hexLine = "";
            for (let j = 0; j < chunk.length; j++) {
                hexLine += chunk[j].toString(16).padStart(2, '0').toUpperCase() + " ";
            }
            lines.push(hexLine.trim());
        }
        setHexView(lines);
    };

    // Initial dummy data
    useEffect(() => {
        if (!bytes) {
            // Create a fake "Header" structure for demo
            // Fallout 4 NIF Header Signature: "Gamebryo File Format, Version 20.2.0.7"
            const str = "Gamebryo File Format, Version 20.2.0.7";
            const dummy = new Uint8Array(256);
            for(let i=0; i<str.length; i++) dummy[i] = str.charCodeAt(i);
            // Add some random float data
            for(let i=str.length; i<256; i++) dummy[i] = Math.floor(Math.random() * 256);
            
            setBytes(dummy);
            setFileName("preview_mesh.nif");
            renderHex(dummy);
        }
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const buffer = event.target.result as ArrayBuffer;
                // Limit to 1KB for performance in this UI demo
                const uint8 = new Uint8Array(buffer).subarray(0, 1024);
                setBytes(uint8);
                renderHex(uint8);
                setAnalysisResult(null);
                setStructureMap([]);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleAnalyzeRegion = async () => {
        if (!bytes || cursor === null) return;
        setIsAnalyzing(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Extract a chunk around the cursor
            const start = Math.max(0, cursor - 16);
            const end = Math.min(bytes.length, cursor + 32);
            const chunk = bytes.slice(start, end);
            const hexStr = Array.from(chunk).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');

            const promptText = `Analyze this hex byte sequence from a game file (${fileName || 'unknown'}): "${hexStr}".
                The cursor is at byte offset ${cursor}.
                Identify likely data types (float, int, string, header).
                Return a JSON object with:
                1. "interpretation": A short explanation of what these bytes likely represent.
                2. "structName": A technical name for this block (e.g. NiNode, HeaderString).
                `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ text: promptText }] },
                config: { responseMimeType: 'application/json' }
            });

            const text = response.text || "{}";
            const result = JSON.parse(text);
            setAnalysisResult(result.interpretation);
            
            // Add a visual highlight map for this "found" structure
            if (result.structName) {
                setStructureMap(prev => [
                    ...prev, 
                    { start: cursor, end: cursor + 8, label: result.structName, color: 'bg-emerald-500/30' }
                ]);
            }

        } catch (e) {
            console.error(e);
            setAnalysisResult("Analysis failed. Unknown binary format.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleByteClick = (byteIndex: number) => {
        setCursor(byteIndex);
    };

    // Helper to check if a byte index falls into a mapped structure
    const getByteStyle = (index: number) => {
        const map = structureMap.find(m => index >= m.start && index < m.end);
        return map ? map.color : '';
    };

    return (
        <div className="h-full flex flex-col bg-[#050505] text-slate-200 font-mono overflow-hidden relative">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center z-10 shadow-md">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <Binary className="w-6 h-6 text-forge-accent" />
                        The Splicer
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Binary Surgeon & Hex Editor</p>
                </div>
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-bold transition-colors"
                    >
                        <Upload className="w-3 h-3" /> Load File
                    </button>
                    <button 
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-bold transition-colors"
                    >
                        <Download className="w-3 h-3" /> Dump
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Hex Grid */}
                <div className="flex-1 bg-black overflow-y-auto p-4 relative custom-scrollbar">
                    {bytes ? (
                        <div className="grid grid-cols-[auto_1fr_auto] gap-x-6 text-sm font-mono leading-6">
                            {/* Offsets */}
                            <div className="text-slate-600 select-none text-right">
                                {Array.from({ length: Math.ceil(bytes.length / 16) }).map((_, i) => (
                                    <div key={i}>{(i * 16).toString(16).padStart(8, '0').toUpperCase()}</div>
                                ))}
                            </div>

                            {/* Hex Bytes */}
                            <div className="text-slate-300">
                                {Array.from({ length: Math.ceil(bytes.length / 16) }).map((_, row) => (
                                    <div key={row} className="flex gap-2">
                                        {Array.from({ length: 16 }).map((_, col) => {
                                            const idx = row * 16 + col;
                                            if (idx >= bytes.length) return null;
                                            const byteVal = bytes[idx];
                                            const hex = byteVal.toString(16).padStart(2, '0').toUpperCase();
                                            const isActive = cursor === idx;
                                            const structStyle = getByteStyle(idx);

                                            return (
                                                <span 
                                                    key={idx}
                                                    onClick={() => handleByteClick(idx)}
                                                    className={`cursor-pointer hover:bg-slate-700 px-0.5 rounded transition-colors ${isActive ? 'bg-forge-accent text-black font-bold' : structStyle}`}
                                                >
                                                    {hex}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            {/* ASCII Decode */}
                            <div className="text-slate-500 border-l border-slate-800 pl-4">
                                {Array.from({ length: Math.ceil(bytes.length / 16) }).map((_, row) => (
                                    <div key={row} className="whitespace-pre">
                                        {Array.from({ length: 16 }).map((_, col) => {
                                            const idx = row * 16 + col;
                                            if (idx >= bytes.length) return null;
                                            const byteVal = bytes[idx];
                                            const char = byteVal >= 32 && byteVal <= 126 ? String.fromCharCode(byteVal) : '.';
                                            const isActive = cursor === idx;
                                            return (
                                                <span key={idx} className={`${isActive ? 'text-forge-accent font-bold' : ''}`}>
                                                    {char}
                                                </span>
                                            );
                                        }).join('')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <FileCode className="w-16 h-16 mb-4 opacity-20" />
                            <p>No file loaded.</p>
                        </div>
                    )}
                </div>

                {/* Right: Inspector Panel */}
                <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Search className="w-3 h-3" /> Data Inspector
                        </h3>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        {cursor !== null && bytes ? (
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <div className="text-xs text-slate-500">Offset</div>
                                    <div className="text-xl font-bold text-white">0x{cursor.toString(16).toUpperCase()}</div>
                                    <div className="text-xs text-slate-500">Decimal: {cursor}</div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs border-b border-slate-800 pb-1">
                                        <span className="text-slate-400">Int8</span>
                                        <span className="text-emerald-400">{bytes[cursor]}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-slate-800 pb-1">
                                        <span className="text-slate-400">UInt8</span>
                                        <span className="text-emerald-400">{bytes[cursor]}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-slate-800 pb-1">
                                        <span className="text-slate-400">Char</span>
                                        <span className="text-emerald-400">'{String.fromCharCode(bytes[cursor])}'</span>
                                    </div>
                                    {/* Simulated Float/Int16 for demo */}
                                    <div className="flex justify-between text-xs border-b border-slate-800 pb-1">
                                        <span className="text-slate-400">Int16 (LE)</span>
                                        <span className="text-emerald-400">{(bytes[cursor] + (bytes[cursor+1] || 0) * 256)}</span>
                                    </div>
                                </div>

                                {/* AI Analysis Section */}
                                <div className="pt-4 border-t border-slate-800">
                                    <button 
                                        onClick={() => handleAnalyzeRegion()}
                                        disabled={isAnalyzing}
                                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                                        {isAnalyzing ? 'Deciphering...' : 'Neural Decode'}
                                    </button>
                                    
                                    {analysisResult && (
                                        <div className="mt-4 bg-slate-800 border border-slate-700 rounded p-3 text-xs text-slate-300 leading-relaxed animate-fade-in">
                                            <div className="flex items-center gap-2 mb-1 text-purple-400 font-bold">
                                                <Eye className="w-3 h-3" /> Insight
                                            </div>
                                            {analysisResult}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-600 text-xs mt-10">
                                Select a byte to inspect its value and structure.
                            </div>
                        )}
                    </div>

                    {/* Structure List */}
                    <div className="h-1/3 border-t border-slate-800 bg-black/20 p-4 overflow-y-auto">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Identified Structures</h4>
                        {structureMap.length === 0 ? (
                            <div className="text-[10px] text-slate-600 italic">No structures mapped yet.</div>
                        ) : (
                            <div className="space-y-1">
                                {structureMap.map((map, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs bg-slate-800/50 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-800" onClick={() => setCursor(map.start)}>
                                        <span className="font-mono text-emerald-400">{map.label}</span>
                                        <span className="text-slate-500 font-mono">0x{map.start.toString(16)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TheSplicer;