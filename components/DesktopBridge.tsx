import React, { useState, useEffect } from 'react';
import { Download, Monitor, CheckCircle, Loader2, Wifi, Shield, Cpu, HardDrive, AlertTriangle, RefreshCw, Terminal, Power } from 'lucide-react';

const DesktopBridge: React.FC = () => {
  const [status, setStatus] = useState<'disconnected' | 'downloading' | 'waiting' | 'connected'>('disconnected');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  useEffect(() => {
      const active = localStorage.getItem('mossy_bridge_active') === 'true';
      if (active) {
          setStatus('connected');
      }
  }, []);

  const handleDownload = () => {
      setStatus('downloading');
      let p = 0;
      const interval = setInterval(() => {
          p += Math.floor(Math.random() * 15);
          if (p >= 100) {
              p = 100;
              clearInterval(interval);
              setTimeout(() => {
                  setStatus('waiting');
                  // Auto-download simulation (saving file)
                  const link = document.createElement("a");
                  link.href = "data:text/plain;charset=utf-8,Mossy_Installer_Dummy_File";
                  link.download = "MossyBridge_Setup_v2.2.exe";
                  link.click();
              }, 800);
          }
          setDownloadProgress(p);
      }, 300);
  };

  const attemptHandshake = () => {
      setConnectionAttempts(prev => prev + 1);
      setTimeout(() => {
          // Simulate successful connection
          localStorage.setItem('mossy_bridge_active', 'true');
          setStatus('connected');
      }, 2000);
  };

  const disconnect = () => {
      localStorage.removeItem('mossy_bridge_active');
      setStatus('disconnected');
      setConnectionAttempts(0);
  };

  return (
    <div className="h-full bg-forge-dark p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-10 border-b border-slate-700 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Monitor className="w-8 h-8 text-emerald-400" />
                    Mossy Desktop Bridge
                </h2>
                <p className="text-slate-400 mt-2">
                    Enable deep system integration, local file access, and hardware acceleration.
                </p>
            </div>
            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 font-mono text-sm ${
                status === 'connected' 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}>
                <Wifi className={`w-4 h-4 ${status === 'connected' ? 'animate-pulse' : ''}`} />
                {status === 'connected' ? 'BRIDGE ACTIVE' : 'DISCONNECTED'}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Action Card */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Status: Disconnected */}
                {status === 'disconnected' && (
                    <div className="bg-forge-panel border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-700">
                            <Download className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Install Local Client</h3>
                        <p className="text-slate-400 mb-8 max-w-md mx-auto">
                            To allow Mossy to edit files, manage mods, and scan your registry, you need to install the companion executable.
                        </p>
                        <button 
                            onClick={handleDownload}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 mx-auto transition-all shadow-lg shadow-emerald-900/20 hover:scale-105"
                        >
                            <Download className="w-5 h-5" />
                            Download Installer (64MB)
                        </button>
                        <p className="mt-4 text-xs text-slate-500">Windows 10/11 • 64-bit • v2.2.1 Stable</p>
                    </div>
                )}

                {/* Status: Downloading */}
                {status === 'downloading' && (
                    <div className="bg-forge-panel border border-slate-700 rounded-2xl p-12 text-center">
                         <h3 className="text-xl font-bold text-white mb-4">Downloading Installer...</h3>
                         <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden mb-2">
                             <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                         </div>
                         <p className="text-mono text-emerald-400 text-sm">{downloadProgress}%</p>
                    </div>
                )}

                {/* Status: Waiting for Install */}
                {status === 'waiting' && (
                    <div className="bg-forge-panel border border-slate-700 rounded-2xl p-8 text-center animate-pulse-border border-emerald-500/30">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Waiting for Connection...</h3>
                        <p className="text-slate-400 mb-6">
                            Please run <strong>MossyBridge_Setup.exe</strong> to complete installation.<br/>
                            We are listening on <span className="font-mono text-slate-300">ws://localhost:21337</span>
                        </p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={attemptHandshake}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white font-bold flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${connectionAttempts > 0 ? 'animate-spin' : ''}`} />
                                {connectionAttempts > 0 ? 'Retrying...' : 'I have installed it'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status: Connected */}
                {status === 'connected' && (
                    <div className="bg-emerald-900/10 border border-emerald-500/30 rounded-2xl p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
                                <CheckCircle className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">Bridge Operational</h3>
                                <p className="text-emerald-400 text-sm font-mono">Secure Tunnel Established</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Latency</div>
                                <div className="text-2xl font-mono text-emerald-400">12ms</div>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Permissions</div>
                                <div className="text-2xl font-mono text-emerald-400">RWX</div>
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-slate-300 h-40 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-2 text-slate-600"><Terminal className="w-4 h-4" /></div>
                            <p className="text-emerald-500">$ mossy-bridge status</p>
                            <p>> Service Active (PID: 9422)</p>
                            <p>> Filesystem Watcher: ACTIVE (D:/Modding/)</p>
                            <p>> Registry Hook: ACTIVE</p>
                            <p>> GPU Acceleration: CUDA 12.1 Detected</p>
                            <p>> Ready for instruction...</p>
                            <div className="animate-pulse mt-1">_</div>
                        </div>

                        <button onClick={disconnect} className="mt-6 text-sm text-red-400 hover:text-red-300 flex items-center gap-2">
                            <Power className="w-4 h-4" /> Disconnect Bridge
                        </button>
                    </div>
                )}
            </div>

            {/* Feature Sidebar */}
            <div className="space-y-4">
                <div className="bg-forge-panel p-6 rounded-xl border border-slate-700">
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-forge-accent" /> Integration Level
                    </h4>
                    <ul className="space-y-3">
                        <li className={`flex items-center gap-3 text-sm ${status === 'connected' ? 'text-slate-200' : 'text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                            Direct File System Access
                        </li>
                        <li className={`flex items-center gap-3 text-sm ${status === 'connected' ? 'text-slate-200' : 'text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                            Registry & Environment Sync
                        </li>
                        <li className={`flex items-center gap-3 text-sm ${status === 'connected' ? 'text-slate-200' : 'text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                            Hardware Control (RGB/Fans)
                        </li>
                        <li className={`flex items-center gap-3 text-sm ${status === 'connected' ? 'text-slate-200' : 'text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                            Local LLM Inference
                        </li>
                    </ul>
                </div>

                <div className="bg-forge-panel p-6 rounded-xl border border-slate-700">
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-forge-accent" /> System Requirements
                    </h4>
                    <div className="space-y-3 text-sm text-slate-400">
                        <div className="flex justify-between border-b border-slate-700/50 pb-2">
                            <span>OS</span>
                            <span className="text-slate-200">Windows 10/11</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700/50 pb-2">
                            <span>RAM</span>
                            <span className="text-slate-200">8GB Min</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700/50 pb-2">
                            <span>Storage</span>
                            <span className="text-slate-200">200MB</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Network</span>
                            <span className="text-slate-200">Localhost Only</span>
                        </div>
                    </div>
                </div>

                {status !== 'connected' && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                        <div className="text-xs text-yellow-200/80">
                            Without the bridge, Mossy runs in <strong>Sandbox Mode</strong>. She can generate text and images but cannot directly edit files on your hard drive.
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopBridge;