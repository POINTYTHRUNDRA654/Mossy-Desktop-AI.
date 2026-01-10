import React, { useState, useEffect, useRef } from 'react';
import { Monitor, CheckCircle2, Wifi, Shield, Cpu, Terminal, Power, Layers, Box, Code, Image as ImageIcon, MessageSquare, Activity, RefreshCw, Lock, AlertOctagon, Link, Zap, Eye, Globe, Database, Wrench, FolderOpen, HardDrive, ArrowRightLeft, ArrowRight, Keyboard } from 'lucide-react';

interface Driver {
    id: string;
    name: string;
    icon: React.ElementType;
    status: 'active' | 'inactive' | 'mounting' | 'error';
    version: string;
    latency: number;
    permissions: string[];
}

interface LogEntry {
    id: string;
    timestamp: string;
    source: string;
    event: string;
    status: 'ok' | 'warn' | 'err' | 'success';
}

const initialDrivers: Driver[] = [
    { id: 'os_shell', name: 'Windows Shell', icon: Terminal, status: 'inactive', version: '10.0.19045', latency: 0, permissions: ['fs.read', 'fs.write', 'exec'] },
    { id: 'fs_watcher', name: 'File System Watcher', icon: Eye, status: 'inactive', version: '2.1.0', latency: 0, permissions: ['fs.watch', 'read.recursive'] },
    { id: 'blender', name: 'Blender Link (4.5)', icon: Box, status: 'inactive', version: '4.5.5', latency: 0, permissions: ['mesh.read', 'mesh.write', 'texture.sync'] },
    { id: 'xedit', name: 'xEdit Data Link', icon: Database, status: 'inactive', version: '4.0.4', latency: 0, permissions: ['plugin.read', 'record.edit'] },
    { id: 'ck', name: 'Creation Kit Telemetry', icon: Wrench, status: 'inactive', version: '1.10', latency: 0, permissions: ['cell.view'] },
    { id: 'vscode', name: 'VS Code Host', icon: Code, status: 'inactive', version: '1.85.1', latency: 0, permissions: ['editor.action', 'workspace'] },
];

const DesktopBridge: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
      try {
          const saved = localStorage.getItem('mossy_bridge_drivers');
          if (saved) {
              const parsed = JSON.parse(saved);
              return initialDrivers.map(d => {
                  const s = parsed.find((p: any) => p.id === d.id);
                  if (d.id === 'blender') return { ...d, status: 'active', latency: 12 };
                  return s ? { ...d, status: s.status } : d;
              });
          }
      } catch {}
      return initialDrivers.map(d => d.id === 'blender' ? { ...d, status: 'active', latency: 12 } : d);
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [repairing, setRepairing] = useState(false);
  const [mountedPath, setMountedPath] = useState<string | null>(null);
  
  // Blender specific simulation state
  const [blenderActivity, setBlenderActivity] = useState<'idle' | 'syncing' | 'receiving'>('idle');
  const [lastBlenderMsg, setLastBlenderMsg] = useState('Idle');
  const [blenderViewMode, setBlenderViewMode] = useState<'SOLID' | 'WIREFRAME'>('SOLID');
  const blenderCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Persist drivers
  useEffect(() => {
      localStorage.setItem('mossy_bridge_drivers', JSON.stringify(drivers.map(d => ({ id: d.id, status: d.status }))));
      const anyActive = drivers.some(d => d.status === 'active');
      localStorage.setItem('mossy_bridge_active', anyActive.toString());
      window.dispatchEvent(new Event('mossy-bridge-connected'));
      window.dispatchEvent(new Event('mossy-driver-update'));
  }, [drivers]);

  // Listen for remote Blender commands from Chat/Live
  useEffect(() => {
      const handleBlenderCommand = (e: CustomEvent<{code: string, description: string}>) => {
          const { code, description } = e.detail;
          
          setBlenderActivity('receiving');
          setLastBlenderMsg(`Executing: ${description}`);
          addLog('Blender', `Remote CMD: ${description}`, 'warn');
          
          setTimeout(() => {
              addLog('Blender', 'Script executed successfully. Scene Updated.', 'success');
              setLastBlenderMsg('Sync Complete');
              setBlenderActivity('idle');
          }, 2000);
      };

      const handleShortcut = (e: CustomEvent<{keys: string, description: string}>) => {
          const { keys, description } = e.detail;
          setBlenderActivity('receiving');
          setLastBlenderMsg(`Input: ${keys}`);
          addLog('Blender', `Keystroke: [ ${keys} ] - ${description}`, 'warn');
          
          // SIMULATE KEY PRESS EFFECT
          if (keys.toLowerCase() === 'z' || description.toLowerCase().includes('skeletal') || description.toLowerCase().includes('wireframe')) {
              setBlenderViewMode(prev => {
                  const next = prev === 'SOLID' ? 'WIREFRAME' : 'SOLID';
                  addLog('Blender', `Viewport Mode Toggled: ${next}`, 'success');
                  return next;
              });
          }
          
          setTimeout(() => {
              setBlenderActivity('idle');
          }, 800);
      };

      window.addEventListener('mossy-blender-command', handleBlenderCommand as EventListener);
      window.addEventListener('mossy-blender-shortcut', handleShortcut as EventListener);
      
      return () => {
          window.removeEventListener('mossy-blender-command', handleBlenderCommand as EventListener);
          window.removeEventListener('mossy-blender-shortcut', handleShortcut as EventListener);
      };
  }, []);

  // Simulate telemetry
  useEffect(() => {
      const interval = setInterval(() => {
          setDrivers(prev => prev.map(d => {
              if (d.status === 'active') {
                  return { ...d, latency: Math.max(1, Math.min(50, d.latency + (Math.random() * 4 - 2))) };
              }
              return d;
          }));
      }, 1000);
      return () => clearInterval(interval);
  }, []);

  // --- BLENDER 3D CUBE VISUALIZER ---
  useEffect(() => {
      const canvas = blenderCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      let frameId: number;
      let rotation = 0;

      const render = () => {
          rotation += 0.02;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Center
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const size = 30;

          // Vertices of a cube
          const vertices = [
              {x: -1, y: -1, z: -1}, {x: 1, y: -1, z: -1}, {x: 1, y: 1, z: -1}, {x: -1, y: 1, z: -1},
              {x: -1, y: -1, z: 1}, {x: 1, y: -1, z: 1}, {x: 1, y: 1, z: 1}, {x: -1, y: 1, z: 1}
          ];

          // Rotate & Project
          const projected = vertices.map(v => {
              // Rotate Y
              let x = v.x * Math.cos(rotation) - v.z * Math.sin(rotation);
              let z = v.x * Math.sin(rotation) + v.z * Math.cos(rotation);
              // Rotate X
              let y = v.y * Math.cos(rotation * 0.5) - z * Math.sin(rotation * 0.5);
              z = v.y * Math.sin(rotation * 0.5) + z * Math.cos(rotation * 0.5);
              
              // Project
              const scale = 100 / (100 + z * 30);
              return { x: cx + x * size * scale, y: cy + y * size * scale };
          });

          // Draw Edges
          ctx.lineWidth = 2;
          ctx.strokeStyle = blenderViewMode === 'WIREFRAME' ? '#fff' : '#orange'; 
          
          const edges = [
              [0,1], [1,2], [2,3], [3,0], // back
              [4,5], [5,6], [6,7], [7,4], // front
              [0,4], [1,5], [2,6], [3,7]  // connecting
          ];

          // Fill Faces if Solid
          if (blenderViewMode === 'SOLID') {
              ctx.fillStyle = 'rgba(249, 115, 22, 0.2)'; // Orange tint
              // Simple fill logic (front face only for speed/style)
              ctx.beginPath();
              ctx.moveTo(projected[4].x, projected[4].y);
              ctx.lineTo(projected[5].x, projected[5].y);
              ctx.lineTo(projected[6].x, projected[6].y);
              ctx.lineTo(projected[7].x, projected[7].y);
              ctx.closePath();
              ctx.fill();
              
              ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
              ctx.strokeStyle = '#f97316';
          } else {
              ctx.strokeStyle = '#38bdf8'; // Cyan wireframe
          }

          ctx.beginPath();
          edges.forEach(([i, j]) => {
              ctx.moveTo(projected[i].x, projected[i].y);
              ctx.lineTo(projected[j].x, projected[j].y);
          });
          ctx.stroke();

          frameId = requestAnimationFrame(render);
      };
      
      render();
      return () => cancelAnimationFrame(frameId);
  }, [blenderViewMode]);

  const addLog = (source: string, event: string, status: 'ok' | 'warn' | 'err' | 'success' = 'ok') => {
      setLogs(prev => [...prev.slice(-19), {
          id: Date.now().toString() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          source,
          event,
          status
      }]);
  };

  const toggleDriver = (id: string, forceState?: boolean) => {
      setDrivers(prev => prev.map(d => {
          if (d.id !== id) return d;
          
          const currentState = d.status;
          let targetState: 'active' | 'inactive' | 'mounting' = 'mounting';
          
          if (forceState !== undefined) {
              targetState = forceState ? 'active' : 'inactive';
          } else {
              targetState = currentState === 'active' ? 'inactive' : 'mounting';
          }

          if (targetState === 'mounting') {
              setTimeout(() => {
                  setDrivers(curr => curr.map(cd => cd.id === id ? { ...cd, status: 'active', latency: Math.floor(Math.random() * 10) + 5 } : cd));
                  addLog(d.name, 'Socket handshake established', 'ok');
              }, 800);
              addLog('Bridge', `Mounting driver: ${d.name}...`, 'warn');
              return { ...d, status: 'mounting' };
          } 
          
          if (targetState === 'active' && currentState !== 'active') {
               addLog(d.name, 'Connection restored.', 'success');
               return { ...d, status: 'active', latency: 12 };
          }

          if (targetState === 'inactive') {
              addLog(d.name, 'SIGTERM sent. Connection closed.', 'warn');
              return { ...d, status: 'inactive', latency: 0 };
          }

          return d;
      }));
  };

  // --- BLENDER SIMULATION ---
  const pingBlender = () => {
      const blenderDriver = drivers.find(d => d.id === 'blender');
      if (blenderDriver?.status !== 'active') {
          addLog('Blender', 'Cannot ping. Driver offline.', 'err');
          return;
      }
      
      setBlenderActivity('syncing');
      setLastBlenderMsg('Ping sent...');
      
      setTimeout(() => {
          setBlenderActivity('receiving');
          setLastBlenderMsg('Pong received. Latency: 12ms');
          addLog('Blender', 'Echo reply valid. Version 4.5.5', 'success');
          
          setTimeout(() => {
              setBlenderActivity('idle');
          }, 1000);
      }, 800);
  };

  const syncBlenderScene = () => {
      const blenderDriver = drivers.find(d => d.id === 'blender');
      if (blenderDriver?.status !== 'active') return;

      setBlenderActivity('receiving');
      setLastBlenderMsg('Syncing Scene Data...');
      addLog('Blender', 'Requesting Scene Graph...', 'warn');
      
      setTimeout(() => {
          addLog('Blender', 'Received: 14 Meshes, 2 Lights, 1 Camera', 'success');
          setLastBlenderMsg('Sync Complete');
          setBlenderActivity('idle');
      }, 1500);
  };

  // --- NATIVE FILE SYSTEM ACCESS ---
  const handleMountFileSystem = async () => {
      try {
          // @ts-ignore
          if (window.showDirectoryPicker) {
              // @ts-ignore
              const handle = await window.showDirectoryPicker();
              setMountedPath(handle.name);
              addLog('FileSystem', `Access granted to: ${handle.name}`, 'success');
              addLog('Indexer', 'Indexing files...', 'warn');
              let count = 0;
              // @ts-ignore
              for await (const entry of handle.values()) {
                  if (count < 5) addLog('Indexer', `Found: ${entry.name}`, 'ok');
                  count++;
              }
              addLog('Indexer', `Index complete. ${count} items mapped.`, 'success');
              activateSystem();
              return;
          }
      } catch (err) {
          console.log('FileSystem API failed, falling back to input');
      }
      folderInputRef.current?.click();
  };

  const handleFolderFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const path = files[0].webkitRelativePath.split('/')[0] || "Local Folder";
      setMountedPath(path);
      addLog('FileSystem', `Mounted via fallback: ${path}`, 'success');
      addLog('Indexer', `Indexing ${files.length} files...`, 'warn');
      for(let i=0; i<Math.min(5, files.length); i++) {
          addLog('Indexer', `Found: ${files[i].name}`, 'ok');
      }
      addLog('Indexer', 'Index complete.', 'success');
      activateSystem();
  };

  const activateSystem = () => {
      toggleDriver('os_shell', true);
      toggleDriver('fs_watcher', true);
      localStorage.setItem('mossy_bridge_active', 'true');
      window.dispatchEvent(new Event('mossy-bridge-connected'));
  };

  const handleRepair = () => {
      if (repairing) return;
      setRepairing(true);
      setLogs([]); 
      addLog('Diagnostics', 'Initiating full-stack neural repair...', 'warn');
      
      let step = 0;
      const interval = setInterval(() => {
          step++;
          if (step === 1) addLog('Diagnostics', 'Flushing socket buffers...', 'ok');
          if (step === 2) addLog('Diagnostics', 'Renewing TSL certificates...', 'ok');
          if (step === 3) {
              clearInterval(interval);
              drivers.forEach(d => toggleDriver(d.id, true));
              setRepairing(false);
              addLog('System', 'All Systems Nominal. Link Stabilized.', 'success');
          }
      }, 600);
  };

  return (
    <div className="h-full bg-[#050910] p-8 overflow-y-auto font-sans text-slate-200">
      <input type="file" ref={folderInputRef} className="hidden" 
          // @ts-ignore
          webkitdirectory="" directory="" multiple onChange={handleFolderFallback}
      />

      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Monitor className="w-8 h-8 text-emerald-400" />
                    Neural Interconnect
                </h2>
                <div className="flex items-center gap-4 mt-2">
                    <p className="text-slate-400 font-mono text-sm">
                        Localhost Bridge Service v2.4.2 <span className="text-slate-600">|</span> Port: 21337
                    </p>
                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        <div className={`w-2 h-2 rounded-full ${drivers.some(d => d.status === 'active') ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {drivers.some(d => d.status === 'active') ? 'LINK ESTABLISHED' : 'NO CARRIER'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex gap-4 items-center">
                <button 
                    onClick={handleRepair}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-900/40 transition-all shadow-lg shadow-emerald-900/10 ${repairing ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <Zap className={`w-4 h-4 ${repairing ? 'animate-spin' : 'fill-current'}`} />
                    {repairing ? 'Stabilizing...' : 'Repair Neural Link'}
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
            {/* Driver Grid */}
            <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* MOUNT CONTROL */}
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-6 flex justify-between items-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-emerald-400" /> 
                            Local File System Access
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            {mountedPath ? `Linked to: ${mountedPath}` : "Grant permission to access local files/tutorials."}
                        </p>
                    </div>
                    <button 
                        onClick={handleMountFileSystem}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${
                            mountedPath 
                            ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                        }`}
                    >
                        {mountedPath ? <CheckCircle2 className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                        {mountedPath ? 'Drive Mounted' : 'Initialize File Link'}
                    </button>
                </div>

                {/* Blender Special Panel */}
                {drivers.find(d => d.id === 'blender' && d.status === 'active') && (
                    <div className="bg-orange-900/10 border border-orange-500/30 rounded-xl p-6 relative overflow-hidden transition-all">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h3 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                                    <Box className="w-5 h-5" /> Blender Bridge Active
                                </h3>
                                <p className="text-xs text-orange-200/60 font-mono mt-1 flex items-center gap-2">
                                    <Keyboard className="w-3 h-3" /> Input Stream: {lastBlenderMsg}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={pingBlender} className="px-3 py-1 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/30 rounded text-xs text-orange-200 font-bold transition-colors">
                                    Ping
                                </button>
                                <button onClick={syncBlenderScene} className="px-3 py-1 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/30 rounded text-xs text-orange-200 font-bold transition-colors flex items-center gap-1">
                                    <RefreshCw className={`w-3 h-3 ${blenderActivity !== 'idle' ? 'animate-spin' : ''}`} /> Sync
                                </button>
                            </div>
                        </div>
                        
                        {/* Interactive Visualizer */}
                        <div className="flex gap-4">
                            <div className="h-24 flex-1 bg-black/40 rounded border border-orange-900/30 relative flex items-center justify-between px-4 overflow-hidden">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Mossy AI</div>
                                {blenderActivity !== 'idle' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className={`w-full h-1 bg-orange-500 rounded-full animate-slide-ping ${blenderActivity === 'receiving' ? 'animate-reverse' : ''}`}></div>
                                    </div>
                                )}
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Blender 4.5.5</div>
                            </div>
                            
                            {/* Live Viewport Feedback */}
                            <div className="w-24 h-24 bg-black rounded border border-slate-700 relative flex items-center justify-center overflow-hidden">
                                <div className="absolute top-1 left-1 text-[8px] font-mono text-slate-500">VIEWPORT</div>
                                <canvas ref={blenderCanvasRef} width={100} height={100} className="w-full h-full" />
                                <div className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/50 px-1 rounded">
                                    {blenderViewMode}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-2 mt-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Driver Matrix
                    </h3>
                    <button 
                        onClick={() => drivers.forEach(d => toggleDriver(d.id, true))}
                        className="text-xs text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1"
                    >
                        <Link className="w-3 h-3" /> Connect All
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {drivers.map(driver => (
                        <div 
                            key={driver.id}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-500 p-5 group ${
                                driver.status === 'active' 
                                ? 'bg-slate-900/80 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                : driver.status === 'mounting'
                                ? 'bg-slate-900 border-yellow-500/50'
                                : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl transition-colors ${
                                    driver.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 
                                    driver.status === 'mounting' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
                                    'bg-slate-800 text-slate-500'
                                }`}>
                                    <driver.icon className="w-6 h-6" />
                                </div>
                                <button 
                                    onClick={() => toggleDriver(driver.id)}
                                    className={`p-2 rounded-lg border transition-all ${
                                        driver.status === 'active' 
                                        ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400 hover:bg-red-900/30 hover:border-red-500 hover:text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title={driver.status === 'active' ? 'Disconnect' : 'Connect'}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1">{driver.name}</h3>
                            <div className="text-xs text-slate-500 font-mono mb-4">v{driver.version}</div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Status</span>
                                    <span className={`font-bold uppercase tracking-wider ${
                                        driver.status === 'active' ? 'text-emerald-400' : 
                                        driver.status === 'mounting' ? 'text-yellow-400' : 'text-slate-600'
                                    }`}>
                                        {driver.status}
                                    </span>
                                </div>
                                
                                {driver.status === 'active' && (
                                    <>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Latency</span>
                                            <span className="text-blue-400 font-mono">{driver.latency.toFixed(1)}ms</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
                                            <div className="h-full bg-emerald-500 animate-pulse" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Telemetry & Log */}
            <div className="flex flex-col gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Security Protocols
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Localhost Loopback Only</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Process Isolation</span>
                        </div>
                        <div className="mt-4 p-3 bg-red-900/10 border border-red-900/30 rounded-lg flex gap-3">
                            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0" />
                            <div className="text-xs text-red-200">
                                <span className="font-bold block mb-1">Sandbox Warning</span>
                                Drivers have direct memory access. Ensure all plugins are trusted.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-black border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Neural Event Bus
                        </span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] text-emerald-500">LIVE</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">
                        {logs.length === 0 && (
                            <div className="text-slate-700 italic text-center mt-10">Awaiting IPC traffic...</div>
                        )}
                        {logs.map(log => (
                            <div key={log.id} className="flex gap-3 animate-fade-in">
                                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                                <span className={`font-bold shrink-0 w-20 truncate ${
                                    log.status === 'err' ? 'text-red-500' : 
                                    log.status === 'success' ? 'text-emerald-400' : 'text-blue-400'
                                }`}>{log.source}</span>
                                <span className={`break-all ${
                                    log.status === 'warn' ? 'text-yellow-400' :
                                    log.status === 'err' ? 'text-red-400' :
                                    log.status === 'success' ? 'text-emerald-400' :
                                    'text-slate-300'
                                }`}>
                                    {log.event}
                                </span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopBridge;