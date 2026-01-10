import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Aperture, Maximize, Crosshair, RefreshCcw, MessageSquare, Zap, AlertCircle, Check, Scan, Monitor, Target, MousePointer2 } from 'lucide-react';

interface AnalysisResult {
    summary: string;
    pointsOfInterest: {
        x: number;
        y: number;
        label: string;
        type: 'error' | 'info' | 'action';
        pct?: number; // VATS percentage
    }[];
}

const TheLens: React.FC = () => {
    const [activeView, setActiveView] = useState<'desktop' | 'app' | 'webcam'>('app');
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [selectedApp, setSelectedApp] = useState('Blender 4.5.5');
    const [isVatsMode, setIsVatsMode] = useState(false);

    // Simulate Screen Capture options
    const captureOptions = [
        { id: 'blender', label: 'Blender 4.5.5', img: 'https://placehold.co/1920x1080/1e1e1e/38bdf8?text=Blender+Shader+Graph:+Normal+Map+Disconnected' },
        { id: 'vscode', label: 'VS Code', img: 'https://placehold.co/1920x1080/0d1117/e11d48?text=Python+Script:+Syntax+Error+Line+42' },
        { id: 'ck', label: 'Creation Kit', img: 'https://placehold.co/1920x1080/cbd5e1/475569?text=Creation+Kit:+Quest+Stage+Missing+Index' },
    ];

    const handleCapture = () => {
        setIsAnalyzing(true);
        setAnalysis(null);
        setIsVatsMode(true); // Auto-engage VATS visual effect
        
        // Simulate getting the specific app screenshot
        const option = captureOptions.find(o => o.label === selectedApp) || captureOptions[0];
        setCurrentImage(option.img);

        // Simulate API call to Gemini Vision
        setTimeout(async () => {
            try {
                // In a real app, we would send the base64 image here.
                // We mock the response based on the selected app to demonstrate "Understanding"
                
                let mockResult: AnalysisResult = { summary: "", pointsOfInterest: [] };

                if (selectedApp.includes('Blender')) {
                    mockResult = {
                        summary: "I see the Blender 4.5.5 Shader Editor. The 'Image Texture' node labeled 'Normal Map' is loaded but not connected to the BSDF.",
                        pointsOfInterest: [
                            { x: 35, y: 45, label: "Disconnected Output", type: 'error', pct: 95 },
                            { x: 60, y: 50, label: "Connect to 'Normal' Input", type: 'action', pct: 82 }
                        ]
                    };
                } else if (selectedApp.includes('VS Code')) {
                    mockResult = {
                        summary: "You are editing a Python script. There is an indentation error on line 42 inside the 'ProcessTurn' function.",
                        pointsOfInterest: [
                            { x: 40, y: 60, label: "Indentation Error", type: 'error', pct: 99 },
                            { x: 80, y: 20, label: "Run Debugger", type: 'info', pct: 45 }
                        ]
                    };
                } else {
                    mockResult = {
                        summary: "Creation Kit detected. The Quest Object 'MQ101' has an undefined Stage Index '20'.",
                        pointsOfInterest: [
                            { x: 50, y: 50, label: "Missing Index Data", type: 'error', pct: 88 }
                        ]
                    };
                }

                setAnalysis(mockResult);
            } catch (e) {
                console.error(e);
            } finally {
                setIsAnalyzing(false);
            }
        }, 2000);
    };

    return (
        <div className="h-full flex flex-col bg-forge-dark text-slate-200 font-sans">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-forge-panel flex justify-between items-center z-10 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Aperture className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">The Lens</h2>
                        <p className="text-xs text-slate-400 font-mono">Visual Context Analysis & UI Overlay</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                         <button 
                             onClick={() => setActiveView('app')}
                             className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeView === 'app' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                         >
                             <Monitor className="w-4 h-4" /> Active App
                         </button>
                         <button 
                             onClick={() => setActiveView('desktop')}
                             className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${activeView === 'desktop' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                         >
                             <Maximize className="w-4 h-4" /> Full Desktop
                         </button>
                     </div>
                     <button className="p-2 bg-slate-800 rounded-full border border-slate-700 text-slate-400 hover:text-white">
                         <RefreshCcw className="w-4 h-4" />
                     </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Viewport */}
                <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                    {/* Background Grid */}
                    <div 
                        className="absolute inset-0 opacity-20 pointer-events-none" 
                        style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                    />
                    
                    {/* VATS Overlay - Global Tint */}
                    {isVatsMode && currentImage && (
                        <div className="absolute inset-0 bg-[#16f342] opacity-10 mix-blend-overlay pointer-events-none z-20 animate-pulse-slow"></div>
                    )}
                    
                    {currentImage ? (
                        <div className="relative max-w-[90%] max-h-[90%] border border-slate-700 shadow-2xl rounded-lg overflow-hidden group">
                            <img 
                                src={currentImage} 
                                alt="Analysis Target" 
                                className={`w-full h-full object-contain block transition-all duration-1000 ${isVatsMode ? 'contrast-125 sepia brightness-110' : ''}`} 
                            />
                            
                            {/* Scanning Effect */}
                            {isAnalyzing && (
                                <div className="absolute inset-0 z-10 bg-emerald-500/5 overflow-hidden">
                                    <div className="w-full h-1 bg-emerald-500/50 shadow-[0_0_15px_#10b981] animate-scan-down"></div>
                                    <div className="absolute top-10 left-10 text-[#16f342] font-mono text-xl font-bold animate-blink">V.A.T.S. ENGAGED</div>
                                </div>
                            )}

                            {/* Overlays */}
                            {!isAnalyzing && analysis && analysis.pointsOfInterest.map((poi, i) => (
                                <div 
                                    key={i} 
                                    className="absolute animate-fade-in"
                                    style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
                                >
                                    {/* VATS Box */}
                                    <div className="relative group/box cursor-pointer">
                                        <div className="absolute -top-12 -left-8 bg-[#000] border-2 border-[#16f342] text-[#16f342] px-2 py-1 font-mono text-sm font-bold shadow-[0_0_10px_#16f342]">
                                            {poi.pct}%
                                        </div>
                                        <div className={`w-16 h-16 border-2 border-[#16f342] -translate-x-1/2 -translate-y-1/2 bg-[#16f342]/10 hover:bg-[#16f342]/20 transition-colors`}>
                                            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#16f342]"></div>
                                            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#16f342]"></div>
                                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#16f342]"></div>
                                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#16f342]"></div>
                                        </div>
                                        
                                        {/* Label Box */}
                                        <div className={`absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-black/80 border border-[#16f342] text-[#16f342] text-xs font-bold shadow-xl backdrop-blur-md opacity-0 group-hover/box:opacity-100 transition-opacity z-30`}>
                                            <div className="flex items-center gap-2">
                                                {poi.type === 'error' ? <AlertCircle className="w-3 h-3" /> :
                                                 poi.type === 'action' ? <MousePointer2 className="w-3 h-3" /> :
                                                 <Check className="w-3 h-3" />}
                                                {poi.label}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-slate-600 flex flex-col items-center gap-4">
                             <Scan className="w-16 h-16 opacity-20" />
                             <p>Waiting for capture stream...</p>
                        </div>
                    )}
                </div>

                {/* Right Control Panel */}
                <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
                    <div className="p-4 border-b border-slate-800">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Target Application</label>
                        <select 
                            value={selectedApp}
                            onChange={(e) => setSelectedApp(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        >
                            {captureOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                        </select>
                        
                        <button 
                            onClick={handleCapture}
                            disabled={isAnalyzing}
                            className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                        >
                            {isAnalyzing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                            {isAnalyzing ? 'Scanning...' : 'Enter V.A.T.S.'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                         <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                             <Zap className="w-3 h-3" /> Intelligence Feed
                         </h3>
                         
                         {analysis ? (
                             <div className="space-y-4 animate-fade-in">
                                 <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 leading-relaxed">
                                     <div className="flex items-start gap-2 mb-2">
                                         <MessageSquare className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                                         <span className="font-bold text-emerald-400">Mossy:</span>
                                     </div>
                                     {analysis.summary}
                                 </div>

                                 <div className="space-y-2">
                                     {analysis.pointsOfInterest.map((poi, i) => (
                                         <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 transition-colors cursor-pointer hover:bg-opacity-20 ${
                                             poi.type === 'error' ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900' :
                                             poi.type === 'action' ? 'bg-emerald-900/10 border-emerald-500/30 hover:bg-emerald-900' :
                                             'bg-blue-900/10 border-blue-500/30 hover:bg-blue-900'
                                         }`}>
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                 poi.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                                 poi.type === 'action' ? 'bg-emerald-500/20 text-emerald-400' :
                                                 'bg-blue-500/20 text-blue-400'
                                             }`}>
                                                 {i + 1}
                                             </div>
                                             <div>
                                                 <div className="text-xs font-bold text-slate-200">{poi.label}</div>
                                                 <div className="text-[10px] text-slate-500 uppercase">{poi.type} | {poi.pct}%</div>
                                             </div>
                                             <Target className="w-4 h-4 text-slate-600 ml-auto" />
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         ) : (
                             <div className="text-center text-slate-600 text-xs mt-10">
                                 Capture a window to begin visual analysis.
                             </div>
                         )}
                    </div>
                    
                    <div className="p-3 border-t border-slate-800 bg-black/20 text-[10px] text-slate-500 text-center font-mono">
                         VISION MODEL: GEMINI-PRO-VISION-1.5
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TheLens;