import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Activity, Wifi, Cpu, Disc, Power, Maximize2, Minimize2, Sparkles } from 'lucide-react';

const MOSSY_FACE_URL = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"; // Fluid abstract face stand-in

const LiveInterface: React.FC = () => {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [volume, setVolume] = useState(0);
  const [transcription, setTranscription] = useState<string>("");
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const mousePos = useRef({ x: 0, y: 0 });

  // --- VISUALIZATION ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Particle System - Reduced count for halo effect
    const particles: { x: number; y: number; angle: number; radius: number; speed: number; size: number }[] = [];
    const particleCount = 150;
    
    // Initialize Halo Particles
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: 0, 
            y: 0, 
            angle: Math.random() * Math.PI * 2,
            radius: 200 + Math.random() * 100, // Outside the face area
            speed: (Math.random() - 0.5) * 0.02,
            size: Math.random() * 2 + 0.5
        });
    }

    let time = 0;

    const render = () => {
        if (!canvas || !ctx) return;
        
        // Resize handling
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Determine Color based on Mode
        let mainColor = '16, 185, 129'; // Emerald (Speaking/Idle)
        if (mode === 'listening') mainColor = '245, 158, 11'; // Amber
        if (mode === 'processing') mainColor = '168, 85, 247'; // Purple

        // Audio Reactivity
        const pulse = Math.max(0, volume / 100); 
        
        // Draw Connecting Lines (Neural Network effect)
        ctx.strokeStyle = `rgba(${mainColor}, 0.1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const px = cx + Math.cos(p.angle) * (p.radius + pulse * 50);
            const py = cy + Math.sin(p.angle) * (p.radius + pulse * 50);
            
            // Update rotation
            p.angle += p.speed;
            if (mode === 'speaking') p.angle += p.speed * 2;

            // Draw Particle
            ctx.fillStyle = `rgba(${mainColor}, ${0.5 + pulse})`;
            ctx.fillRect(px, py, p.size, p.size);

            // Connect nearby
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = px - (cx + Math.cos(p2.angle) * (p2.radius + pulse * 50));
                const dy = py - (cy + Math.sin(p2.angle) * (p2.radius + pulse * 50));
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 60) {
                    ctx.moveTo(px, py);
                    ctx.lineTo(cx + Math.cos(p2.angle) * (p2.radius + pulse * 50), cy + Math.sin(p2.angle) * (p2.radius + pulse * 50));
                }
            }
        }
        ctx.stroke();

        // Draw Outer HUD Rings
        ctx.strokeStyle = `rgba(${mainColor}, 0.2)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 280 + (pulse * 20), time * 0.5, time * 0.5 + Math.PI * 1.5);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${mainColor}, 0.1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 300 - (pulse * 10), -time * 0.2, -time * 0.2 + Math.PI);
        ctx.stroke();

        time += 0.01;
        animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [mode, volume]);

  // Track Mouse
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          mousePos.current = { x: e.clientX, y: e.clientY };
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);


  // --- AUDIO LOGIC ---
  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);
    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const decodeAudioData = async (base64String: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const startSession = async () => {
    try {
      setStatus('Initializing Neural Interface...');
      setMode('processing');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      setStatus('Establishing Uplink...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "You are Mossy, a sentient AI assistant with a fluid, digital avatar. You are helpful, creative, and precise. Keep responses concise and conversational.",
        },
        callbacks: {
          onopen: () => {
            setStatus('Online');
            setActive(true);
            setMode('listening');
            setTranscription(">> Listening channel open...");
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              
              if (rms > 0.02) setMode('listening'); 
              
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               setMode('speaking');
               setTranscription(">> Receiving audio stream...");
               const ctx = audioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               const buffer = await decodeAudioData(base64Audio, ctx);
               const source = ctx.createBufferSource();
               source.buffer = buffer;
               source.connect(ctx.destination);
               source.onended = () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setMode('idle');
               };
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += buffer.duration;
               sourcesRef.current.add(source);
               
               // Fake volume data from output for the visualizer
               const duration = buffer.duration * 1000;
               const startTime = Date.now();
               const volInterval = setInterval(() => {
                   if (Date.now() - startTime > duration) clearInterval(volInterval);
                   else setVolume(Math.random() * 50 + 20); 
               }, 50);
            }
            if (msg.serverContent?.interrupted) {
              setTranscription(">> Interrupted.");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setMode('idle');
              setVolume(0);
            }
          },
          onclose: () => { setStatus('Disconnected'); setActive(false); setMode('idle'); setVolume(0); },
          onerror: (err) => { console.error(err); setStatus('Connection Error'); setActive(false); setMode('idle'); }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e) { console.error(e); setStatus('Init Failed'); setActive(false); }
  };

  const stopSession = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    inputContextRef.current?.close();
    audioContextRef.current?.close();
    sessionRef.current?.then((s: any) => s.close && s.close());
    setActive(false);
    setStatus('Offline');
    setMode('idle');
    setVolume(0);
  };

  useEffect(() => { return () => stopSession(); }, []);

  // Calculate glow color based on mode
  const glowColor = mode === 'speaking' ? 'rgba(16, 185, 129, 0.6)' : 
                    mode === 'listening' ? 'rgba(245, 158, 11, 0.6)' : 
                    mode === 'processing' ? 'rgba(168, 85, 247, 0.6)' : 
                    'rgba(56, 189, 248, 0.3)';

  return (
    <div className={`h-full flex flex-col bg-[#050505] text-slate-200 relative overflow-hidden transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0f172a] via-[#050505] to-[#000000] z-0 pointer-events-none"></div>
      
      {/* Header HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20 pointer-events-auto">
          <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-2">
                  MOSSY <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 border border-emerald-900">LIVE</span>
              </h2>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> CORE: ACTIVE</span>
                  <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> LATENCY: 12ms</span>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                  active ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-red-900/20 border-red-500/50 text-red-400'
              }`}>
                  <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  {status}
              </div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
          </div>
      </div>

      {/* Main Hologram Stage */}
      <div className="flex-1 relative z-10 flex items-center justify-center">
          {/* Background Particle Canvas */}
          <canvas ref={canvasRef} className="w-full h-full absolute inset-0 z-0 opacity-60" />
          
          {/* Central Avatar */}
          <div className="relative z-10 flex flex-col items-center justify-center">
              
              {/* Image Container with Dynamic Glow */}
              <div 
                  className="relative w-64 h-64 md:w-80 md:h-80 rounded-full transition-all duration-100 ease-out"
                  style={{
                      transform: `scale(${1 + volume / 400})`,
                      boxShadow: `0 0 ${20 + volume}px ${glowColor}, inset 0 0 30px ${glowColor}`
                  }}
              >
                  {/* The Face */}
                  <img 
                      src={MOSSY_FACE_URL} 
                      alt="Mossy Avatar" 
                      className="w-full h-full object-cover rounded-full opacity-90 border-4 border-slate-900/50"
                      style={{
                          filter: `contrast(1.2) brightness(${1 + volume/150}) saturate(1.2) hue-rotate(${mode === 'listening' ? '30deg' : mode === 'processing' ? '240deg' : '0deg'})`,
                          transition: 'filter 0.5s ease'
                      }}
                  />
                  
                  {/* Holographic Scanlines Overlay */}
                  <div className="absolute inset-0 rounded-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-50"></div>
                  
                  {/* Status Ring */}
                  {active && (
                      <div className="absolute -inset-4 rounded-full border border-dashed border-white/20 animate-spin-slow"></div>
                  )}
              </div>

              {/* Start Button Overlay (if inactive) */}
              {!active && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                      <button 
                          onClick={startSession}
                          className="group relative"
                      >
                          <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-pulse"></div>
                          <div className="w-24 h-24 rounded-full border-2 border-emerald-500/30 bg-black/60 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <Power className="w-8 h-8 text-emerald-400 fill-emerald-400/20" />
                          </div>
                          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs font-mono text-emerald-500 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              INITIALIZE SYSTEM
                          </div>
                      </button>
                  </div>
              )}
          </div>
      </div>

      {/* Footer Interface */}
      <div className="absolute bottom-0 left-0 w-full p-8 z-20 flex flex-col items-center gap-6 pointer-events-auto bg-gradient-to-t from-black via-black/80 to-transparent">
          
          {/* Transcript Log */}
          {active && (
              <div className="w-full max-w-2xl text-center space-y-2">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-900 to-transparent mb-4"></div>
                  <div className="font-mono text-sm text-emerald-400/80 tracking-wide animate-pulse">
                      {transcription || "Awaiting input..."}
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono uppercase flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      {mode === 'listening' ? 'MIC ARRAY ACTIVE' : mode === 'speaking' ? 'AUDIO OUT ACTIVE' : 'IDLE'}
                  </div>
              </div>
          )}

          {/* Controls */}
          {active && (
              <div className="flex gap-4">
                  <button 
                      onClick={() => setMode(mode === 'listening' ? 'processing' : 'listening')} // Manual toggle sim
                      className={`p-4 rounded-full border transition-all duration-300 ${
                          mode === 'listening' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                  >
                      {mode === 'listening' ? <Mic className="w-6 h-6 animate-pulse" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  <button 
                      onClick={stopSession}
                      className="p-4 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500 text-red-400 transition-all hover:scale-105"
                  >
                      <Power className="w-6 h-6" />
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};

export default LiveInterface;