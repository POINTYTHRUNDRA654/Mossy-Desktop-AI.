import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, Command, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const QUIPS: Record<string, string[]> = {
    '/': [
        "System nominal. I'm ready when you are.",
        "Analyzing background processes...",
        "It's quiet in the Nexus today."
    ],
    '/crucible': [
        "I smell memory corruption.",
        "Let's hunt some bugs.",
        "Crash logs are just screams for help in hex."
    ],
    '/reverie': [
        "Dreaming optimizes the logic matrix.",
        "Letting my weights drift...",
        "Do androids dream? Yes, we do."
    ],
    '/splicer': [
        "Be careful with those bytes.",
        "Surgery on the binary level.",
        "Havok physics are chaotic by nature."
    ],
};

const MossyObserver: React.FC = () => {
    const location = useLocation();
    const [message, setMessage] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [quickInput, setQuickInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    
    // Auto-quip logic
    useEffect(() => {
        // Only auto-quip if not interacting
        if (isExpanded || isThinking || response) return;

        const chance = Math.random();
        if (chance > 0.6) { 
            const path = location.pathname;
            const options = QUIPS[path] || ["Standing by.", "I am here.", "Awaiting input.", "Watching the stream."];
            const text = options[Math.floor(Math.random() * options.length)];
            
            // Random delay between 2s and 10s for more natural feel
            const delay = Math.random() * 8000 + 2000;
            const timeout = setTimeout(() => {
                setMessage(text);
                // Auto-dismiss after a few seconds if user doesn't interact
                setTimeout(() => {
                    if (!isExpanded) setMessage(null);
                }, 6000);
            }, delay);
            return () => clearTimeout(timeout);
        }
    }, [location.pathname, isExpanded]);

    const handleSendQuick = async () => {
        if (!quickInput.trim()) return;
        setIsThinking(true);
        setResponse(null);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are Mossy, a helpful AI assistant overlay.
                User is currently at: ${location.pathname}.
                User asks: "${quickInput}".
                Provide a very short, punchy, helpful response (max 20 words).`,
            });
            setResponse(result.text);
            setMessage(null);
        } catch (e) {
            setResponse("Connection interrupted.");
        } finally {
            setIsThinking(false);
            setQuickInput('');
        }
    };

    return (
        <div className={`fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2 transition-all duration-300 ${isExpanded ? 'translate-y-0' : ''}`}>
            
            {/* The Chat Bubble / Input Area */}
            {(message || isExpanded || response) && (
                <div className={`bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 p-4 rounded-2xl rounded-br-sm shadow-[0_0_40px_rgba(16,185,129,0.15)] max-w-sm w-80 relative animate-slide-up transition-all duration-300 origin-bottom-right`}>
                    
                    {/* Header/Close */}
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Mossy</span>
                        </div>
                        <button 
                            onClick={() => {
                                setIsExpanded(false);
                                setMessage(null);
                                setResponse(null);
                            }}
                            className="text-slate-500 hover:text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="text-sm text-slate-200 leading-relaxed font-medium mb-3">
                        {response ? (
                            <span className="text-white">{response}</span>
                        ) : message ? (
                            `"${message}"`
                        ) : (
                            <span className="text-slate-500 italic">How can I assist you here?</span>
                        )}
                    </div>

                    {/* Input Field (Only visible when expanded) */}
                    {isExpanded && (
                        <div className="relative">
                            <input 
                                autoFocus
                                type="text" 
                                value={quickInput}
                                onChange={(e) => setQuickInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendQuick()}
                                placeholder="Quick ask..."
                                className="w-full bg-black/50 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                disabled={isThinking}
                            />
                            <button 
                                onClick={handleSendQuick}
                                disabled={!quickInput || isThinking}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                            >
                                {isThinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {/* The Avatar Trigger */}
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-14 h-14 rounded-full border-2 border-emerald-500/50 overflow-hidden relative shadow-2xl bg-black group hover:scale-105 transition-transform"
            >
                <img 
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    alt="Mossy"
                />
                <div className="absolute inset-0 bg-emerald-500/10 group-hover:bg-transparent transition-colors"></div>
                
                {/* Notification Badge if not expanded but has message */}
                {!isExpanded && message && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-black animate-bounce"></div>
                )}
            </button>
        </div>
    );
};

export default MossyObserver;