import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, Activity, Wifi, Cpu, Disc, Power, Maximize2, Minimize2, Sparkles, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { useLive } from './LiveContext';

const LiveInterface: React.FC = () => {
  const { isActive, status, volume, mode, transcription, connect, disconnect } = useLive();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom Avatar State
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => localStorage.getItem('mossy_avatar_custom'));
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const mousePos = useRef({ x: 0, y: 0 });

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
  };

  const processFile = async (file: File) => {
      try {
          // Resize and compress image to fit in localStorage
          const compressed = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const maxSize = 400; // Limit size to 400px to ensure it saves
                      let width = img.width;
                      let height = img.height;
                      
                      if (width > height) {
                          if (width > maxSize) {
                              height *= maxSize / width;
                              width = maxSize;
                          }
                      } else {
                          if (height > maxSize) {
                              width *= maxSize / height;
                              height = maxSize;
                          }
                      }
                      
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx?.drawImage(img, 0, 0, width, height);
                      // Compress to JPEG 70% quality
                      resolve(canvas.toDataURL('image/jpeg', 0.7));
                  };
                  img.src = e.target?.result as string;
              };
              reader.readAsDataURL(file);
          });

          setCustomAvatar(compressed);
          try {
              localStorage.setItem('mossy_avatar_custom', compressed);
              // Manually dispatch storage event so MossyObserver updates immediately
              window.dispatchEvent(new Event('storage'));
          } catch (e) {
              console.error("Storage quota exceeded", e);
              alert("Image saved for this session only (Storage Full).");
          }
          
      } catch (err) {
          console.error("Failed to process avatar:", err);
          alert("Could not process image. Try a standard JPG/PNG.");
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
          processFile(file);
      }
  };

  const clearAvatar = () => {
      setCustomAvatar(null);
      localStorage.removeItem('mossy_avatar_custom');
      window.dispatchEvent(new Event('storage'));
  };

  // --- VISUALIZATION ENGINE ---
  useEffect(() => {
    // Only run canvas if no custom avatar
    if (customAvatar) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Procedural Avatar Configuration
    const rings = [
        { radius: 80, speed: 0.02, angle: 0, width: 4, color: 'rgba(255,255,255,0.1)' },
        { radius: 120, speed: -0.015, angle: 1, width: 2, color: 'rgba(255,255,255,0.05)' },
        { radius: 160, speed: 0.01, angle: 2, width: 1, color: 'rgba(255,255,255,0.03)' },
    ];

    let time = 0;

    const render = () => {
        if (!canvas || !ctx) return;
        
        // Resize handling
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- 1. DETERMINE COLORS & STATE ---
        let baseHue = 150; // Emerald
        if (mode === 'listening') baseHue = 35; // Amber
        if (mode === 'processing') baseHue = 270; // Purple
        if (mode === 'speaking') baseHue = 150; // Emerald (Active)

        // Audio reactivity factor (0.0 to 1.0)
        const audioLevel = Math.min(1, volume / 100);
        const pulse = 1 + audioLevel * 0.5;

        // --- 2. DRAW BACKGROUND AMBIENCE (Neural Network) ---
        // Faint connections in background
        ctx.strokeStyle = `hsla(${baseHue}, 50%, 50%, 0.05)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const nodeCount = 20; // Reduced for performance
        const radius = 300 + audioLevel * 50;
        
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2 + time * 0.05;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            // Draw line to center
            ctx.moveTo(x, y);
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();


        // --- 3. DRAW ORBITAL RINGS ---
        rings.forEach((ring, i) => {
            ring.angle += ring.speed * (mode === 'processing' ? 4 : 1); // Spin fast when thinking
            
            ctx.beginPath();
            ctx.ellipse(cx, cy, ring.radius * pulse, ring.radius * pulse * 0.8, ring.angle, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${baseHue}, 70%, 60%, ${0.2 - i * 0.05})`;
            ctx.lineWidth = ring.width;
            ctx.stroke();
            
            // Add a "satellite" on the ring
            const satX = cx + Math.cos(ring.angle) * ring.radius * pulse * Math.cos(ring.angle) - Math.sin(ring.angle) * ring.radius * pulse * 0.8 * Math.sin(ring.angle);
            const satY = cy + Math.sin(ring.angle) * ring.radius * pulse * Math.cos(ring.angle) + Math.cos(ring.angle) * ring.radius * pulse * 0.8 * Math.sin(ring.angle);
            
            ctx.fillStyle = `hsla(${baseHue}, 100%, 80%, 0.8)`;
            ctx.beginPath();
            ctx.arc(satX, satY, 3, 0, Math.PI * 2);
            ctx.fill();
        });


        // --- 4. DRAW CENTRAL CORE (The Avatar) ---
        
        // Inner Glow
        const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 100 * pulse);
        gradient.addColorStop(0, `hsla(${baseHue}, 90%, 60%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${baseHue}, 80%, 40%, 0.2)`);
        gradient.addColorStop(1, `hsla(${baseHue}, 80%, 20%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 120 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Waveform Surface (Spikes based on audio)
        ctx.strokeStyle = `hsla(${baseHue}, 100%, 85%, 0.9)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const coreRadius = 50;
        const numPoints = 60;
        
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const smoothVol = audioLevel * 0.8; // Smoothing factor
            
            // Create "spikes" that rotate
            const waveOffset = Math.sin(angle * 8 + time * 5) * 10 * smoothVol;
            const noiseOffset = Math.random() * 5 * smoothVol;
            
            const r = coreRadius + waveOffset + noiseOffset + (audioLevel * 20);
            
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Solid Center Eye
        ctx.fillStyle = `hsla(${baseHue}, 100%, 95%, 1)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + (audioLevel * 10), 0, Math.PI * 2);
        ctx.fill();


        // --- 5. TEXT OVERLAY (Status) ---
        if (isActive) {
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillStyle = `hsla(${baseHue}, 50%, 50%, 0.7)`;
            ctx.textAlign = 'center';
            ctx.fillText(mode.toUpperCase(), cx, cy + 140);
        }

        time += 0.01;
        animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [mode, volume, isActive, customAvatar]);

  // Track Mouse
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          mousePos.current = { x: e.clientX, y: e.clientY };
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Calculate glow color based on mode
  const glowColor = mode === 'speaking' ? 'rgba(16, 185, 129, 0.6)' : 
                    mode === 'listening' ? 'rgba(245, 158, 11, 0.6)' : 
                    mode === 'processing' ? 'rgba(168, 85, 247, 0.6)' : 
                    'rgba(56, 189, 248, 0.3)';
  
  const borderColor = mode === 'speaking' ? 'border-emerald-500' : 
                      mode === 'listening' ? 'border-amber-500' : 
                      mode === 'processing' ? 'border-purple-500' : 
                      'border-slate-700';

  return (
    <div 
        className={`h-full flex flex-col bg-[#050505] text-slate-200 relative overflow-hidden transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0f172a] via-[#050505] to-[#000000] z-0 pointer-events-none"></div>
      
      {/* Drag Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-emerald-500/20 backdrop-blur-sm border-4 border-emerald-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-white flex items-center gap-4 animate-bounce">
                  <Upload className="w-12 h-12" /> Drop Image to Set Avatar
              </div>
          </div>
      )}

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
              {/* Avatar Upload Control */}
              <div className="relative group">
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                  />
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                      title="Upload Custom Avatar"
                  >
                      <ImageIcon className="w-4 h-4" />
                  </button>
                  {customAvatar && (
                      <button 
                          onClick={clearAvatar}
                          className="absolute -bottom-8 right-0 p-2 bg-red-900/80 hover:bg-red-700 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Reset Avatar"
                      >
                          <Trash2 className="w-3 h-3" />
                      </button>
                  )}
              </div>

              <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isActive ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-red-900/20 border-red-500/50 text-red-400'
              }`}>
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  {status}
              </div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
          </div>
      </div>

      {/* Main Hologram Stage */}
      <div className="flex-1 relative z-10 flex items-center justify-center">
          
          {customAvatar ? (
              <div className="relative flex items-center justify-center">
                  {/* Status Ring */}
                  <div 
                      className={`absolute inset-0 rounded-full border-2 opacity-50 transition-all duration-300 ${borderColor}`}
                      style={{ 
                          transform: `scale(${1 + (volume/100) * 0.3})`,
                          boxShadow: `0 0 ${volume + 20}px ${glowColor}` 
                      }}
                  ></div>
                  
                  {/* The Image */}
                  <img 
                      src={customAvatar} 
                      alt="Avatar" 
                      className="w-64 h-64 rounded-full object-cover border-4 border-slate-900 shadow-2xl relative z-10 transition-transform duration-100"
                      style={{ 
                          transform: `scale(${1 + (volume/200) * 0.1})` 
                      }}
                  />
                  
                  {/* Status Overlay Text */}
                  {isActive && (
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-xs font-mono text-slate-400 uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full backdrop-blur">
                          {mode}
                      </div>
                  )}
              </div>
          ) : (
              <canvas ref={canvasRef} className="w-full h-full absolute inset-0 z-10" />
          )}
          
          {/* Start Button Overlay (if inactive) */}
          {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                  <button 
                      onClick={connect}
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

      {/* Footer Interface */}
      <div className="absolute bottom-0 left-0 w-full p-8 z-20 flex flex-col items-center gap-6 pointer-events-auto bg-gradient-to-t from-black via-black/80 to-transparent">
          
          {/* Transcript Log */}
          {isActive && (
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
          {isActive && (
              <div className="flex gap-4">
                  <button 
                      onClick={disconnect}
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