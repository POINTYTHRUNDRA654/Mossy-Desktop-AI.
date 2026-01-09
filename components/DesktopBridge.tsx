import React, { useState, useEffect, useRef } from 'react';
import { Monitor, CheckCircle2, Wifi, Shield, Cpu, Terminal, Power, Layers, Box, Code, Image as ImageIcon, MessageSquare, Activity, RefreshCw, Lock, AlertOctagon } from 'lucide-react';

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
    { id: 'blender', name: 'Blender 4.0 API', icon: Box, status: 'inactive', version: '4.0.2', latency: 0, permissions: ['bpy.ops', 'bpy.data'] },
    { id: 'vscode', name: 'VS Code Host', icon: Code, status: 'inactive', version: '1.85.1', latency: 0, permissions: ['editor.action', 'workspace'] },
    { id: 'adobe', name: 'Photoshop Remote', icon: ImageIcon, status: 'inactive', version: '25.0.0', latency: 0, permissions: ['jsx.eval', 'layer.mod'] },
    { id: 'discord', name: 'Discord RPC', icon: MessageSquare, status: 'inactive', version: 'Gateway v9', latency: 0, permissions: ['rpc.activity'] },
];

const DesktopBridge: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [repairing, setRepairing] = useState(false);

  // Auto-connect simulates simulated local bridge existing
  useEffect(() => {
      const checkBridge = () => {
          const active = localStorage.getItem('mossy_bridge_active') === 'true';
          if (active) {
              toggleDriver('os_shell', true);
          }
      };
      
      checkBridge();
      
      const handleConnect = () => {
          checkBridge();
          addLog('System', 'External Connection Signal Received.', 'ok');
      };
      window.addEventListener('mossy-bridge-connected', handleConnect);
      return () => window.removeEventListener('mossy-bridge-connected', handleConnect);
  }, []);

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Simulate telemetry
  useEffect(() => {
      const interval = setInterval(() => {
          setDrivers(prev => prev.map(d => {
              if (d.status === 'active') {
                  return { ...d, latency: Math.floor(Math.random() * 15) + 5 };
              }
              return d;
          }));
      }, 1000);
      return () => clearInterval(interval);
  }, []);

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
          
          const newState = forceState !== undefined ? (forceState ? 'active' : 'inactive') : (d.status === 'active' ? 'inactive' : 'mounting');
          
          if (newState === 'mounting') {
              // Simulate mounting process
              setTimeout(() => {
                  setDrivers(curr => curr.map(cd => cd.id === id ? { ...cd, status: 'active' } : cd));
                  addLog(d.name, 'Socket handshake established', 'ok');
                  addLog(d.name, `PID Attached. Latency: 12ms`, 'ok');
                  
                  // If shell, update global state
                  if (id === 'os_shell') {
                      localStorage.setItem('mossy_bridge_active', 'true');
                      window.dispatchEvent(new Event('storage'));
                  }
              }, 1500);
              addLog('Bridge', `Mounting driver: ${d.name}...`, 'warn');
          } else if (newState === 'inactive') {
              addLog(d.name, 'SIGTERM sent. Connection closed.', 'warn');
              if (id === 'os_shell') {
                  localStorage.removeItem('mossy_bridge_active');
                  window.dispatchEvent(new Event('storage'));
              }
          }

          return { ...d, status: newState };
      }));
  };

  const handleRepair = () => {
      if (repairing) return;
      setRepairing(true);
      addLog('Diagnostics', 'Initiating self-repair sequence...', 'warn');
      
      let step = 0;
      const interval = setInterval(() => {
          step++;
          if (step === 1) addLog('Diagnostics', 'Scanning local ports 21337-21340...', 'ok');
          if (step === 2) addLog('Diagnostics', 'Flushing socket buffers...', 'ok');
          if (step === 3) {
              clearInterval(interval);
              toggleDriver('os_shell', true);
              setRepairing(false);
              addLog('System', 'Bridge connection re-established.', 'success');
              // Force global update
              localStorage.setItem('mossy_bridge_active', 'true');
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('mossy-bridge-connected'));
          }
      }, 1000);
  };

  return (
    <div className="h-full bg-[#050910] p-8 overflow-y-auto font-sans text-slate-200">
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Monitor className="w-8 h-8 text-emerald-400" />
                    Neural Interconnect
                </h2>
                <p className="text-slate-400 mt-2 font-mono text-sm">
                    Localhost Bridge Service v2.4.0 <span className="text-slate-600">|</span> Port: 21337
                </p>
            </div>
            <div className="flex gap-4 items-center">
                <button 
                    onClick={handleRepair}
                    className={`flex items-center gap-2 px-4 py-2 rounded bg-slate-800 border border-slate-600 text-xs font-bold hover:bg-slate-700 transition-colors ${repairing ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <RefreshCw className={`w-3 h-3 ${repairing ? 'animate-spin' : ''}`} />
                    {repairing ? 'Diagnosing...' : 'Repair Link'}
                </button>
                <div className="h-10 w-px bg-slate-800"></div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-500 uppercase">Active Threads</div>
                    <div className="text-blue-400 font-mono text-lg">{drivers.filter(d => d.status === 'active').length}</div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
            {/* Driver Grid */}
            <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {drivers.map(driver => (
                        <div 
                            key={driver.id}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 p-5 ${
                                driver.status === 'active' 
                                ? 'bg-slate-900/80 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                : driver.status === 'mounting'
                                ? 'bg-slate-900 border-yellow-500/50'
                                : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${
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
                                            <span className="text-blue-400 font-mono">{driver.latency}ms</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
                                            <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '100%' }}></div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {driver.status === 'active' && (
                                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-1">
                                    {driver.permissions.map(perm => (
                                        <span key={perm} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">
                                            {perm}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Telemetry & Log */}
            <div className="flex flex-col gap-6">
                {/* Security Card */}
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
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Read-Only Default</span>
                        </div>
                        <div className="mt-4 p-3 bg-red-900/10 border border-red-900/30 rounded-lg flex gap-3">
                            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0" />
                            <div className="text-xs text-red-200">
                                <span className="font-bold block mb-1">Sandbox Warning</span>
                                Drivers have direct memory access to target applications. Ensure plugins are trusted.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Log */}
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