import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Cpu, HardDrive, Activity, Terminal, Trash2, Search, CheckCircle2, Database, Layers, Radio, ShieldCheck, Zap, History, Archive, FileCode, XCircle, RefreshCw, Save, Clock, RotateCcw, Upload, Download, DownloadCloud, Box, Settings, Hexagon, BrainCircuit } from 'lucide-react';

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type?: 'info' | 'warning' | 'error' | 'archive';
}

interface Integration {
  id: string;
  name: string;
  category: 'AI' | 'Modding' | 'System';
  path: string;
  status: 'linked' | 'detected' | 'scanning';
}

interface ScanSnapshot {
  id: string;
  timestamp: string;
  integrations: Integration[];
}

interface SystemModule {
    id: string;
    name: string;
    status: 'online' | 'standby' | 'offline';
    load: number;
}

const modulesList: SystemModule[] = [
    { id: 'cortex', name: 'The Cortex', status: 'online', load: 45 },
    { id: 'splicer', name: 'The Splicer', status: 'standby', load: 10 },
    { id: 'hive', name: 'The Hive', status: 'online', load: 72 },
    { id: 'anima', name: 'The Anima', status: 'online', load: 88 },
    { id: 'lens', name: 'The Lens', status: 'standby', load: 5 },
    { id: 'fabric', name: 'The Fabric', status: 'standby', load: 0 },
    { id: 'prism', name: 'The Prism', status: 'online', load: 30 },
    { id: 'conduit', name: 'The Conduit', status: 'online', load: 12 },
    { id: 'blueprint', name: 'The Blueprint', status: 'standby', load: 0 },
    { id: 'crucible', name: 'The Crucible', status: 'online', load: 55 },
    { id: 'assembler', name: 'The Assembler', status: 'standby', load: 0 },
    { id: 'registry', name: 'The Registry', status: 'online', load: 20 },
    { id: 'reverie', name: 'The Reverie', status: 'online', load: 95 },
];

const SystemMonitor: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [modules, setModules] = useState<SystemModule[]>(modulesList);
  
  // History State
  const [scanHistory, setScanHistory] = useState<ScanSnapshot[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Model Hub State
  const [showModelHub, setShowModelHub] = useState(false);
  const [modelConfig, setModelConfig] = useState({
    name: 'Llama-3-8B-Instruct',
    format: 'GGUF',
    quantization: 'Q4_K_M'
  });
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);

  // New State for Validation Toggles
  const [validationOptions, setValidationOptions] = useState({
    shaderFlags: false,
    collisionLayers: true,
    nodeHierarchy: false
  });

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize logs & history
  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    if (logs.length === 0 && !isScanning && integrations.length === 0) {
        setLogs([
        { id: 'init-1', time: t, msg: "[SYSTEM] Mossy Backend Services Active...", type: 'info' },
        { id: 'init-2', time: t, msg: "[WAITING] Passive monitoring initialized...", type: 'warning' },
        ]);
    }
  }, []);

  // Update Module loads randomly
  useEffect(() => {
      const interval = setInterval(() => {
          setModules(prev => prev.map(m => ({
              ...m,
              load: m.status === 'online' ? Math.max(10, Math.min(100, m.load + (Math.random() * 20 - 10))) : 0
          })));
      }, 2000);
      return () => clearInterval(interval);
  }, []);

  // Chart data simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      
      const cpuVal = Math.min(100, Math.floor(Math.random() * 30) + 20);
      const memVal = Math.min(100, Math.floor(Math.random() * 20) + 40);
      const gpuVal = Math.min(100, Math.floor(Math.random() * 40) + 10);
      const neuralVal = Math.min(100, Math.floor(Math.random() * 40) + 30);

      const newPoint = {
        name: time,
        cpu: cpuVal,
        memory: memVal,
        gpu: gpuVal,
        neural: neuralVal,
      };

      setData(prev => {
        const newData = [...prev, newPoint];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string, type: 'info' | 'warning' | 'error' | 'archive' = 'info') => {
    setLogs(prev => {
        const newEntry = {
            id: Date.now().toString() + Math.random(),
            time: new Date().toLocaleTimeString(),
            msg: msg,
            type
        };
        return [...prev, newEntry].slice(-50);
    });
  };

  const startScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setIntegrations([]);
    addLog("[CORE] Initiating Deep System Scan...", 'info');

    let step = 0;
    const scanInterval = setInterval(() => {
        step += 2;
        setScanProgress(step);

        if (step === 10) addLog("[SCAN] Verifying Neural Subsystems...", 'info');
        if (step === 50) addLog("[SCAN] Checking Localhost Bridge...", 'warning');
        if (step === 80) addLog("[SCAN] Syncing Knowledge Graph...", 'info');

        if (step >= 100) {
            clearInterval(scanInterval);
            setIsScanning(false);
            addLog("[CORE] Scan Complete. All modules nominal.", 'info');
            // Mock found integrations
            setIntegrations([
                { id: '1', name: 'Blender 4.2', category: 'Modding', path: '/usr/bin/blender', status: 'linked' },
                { id: '2', name: 'Ollama', category: 'AI', path: 'localhost:11434', status: 'linked' }
            ]);
        }
    }, 50);
  };

  return (
    <div className="h-full w-full p-6 bg-forge-dark text-slate-200 overflow-y-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative">
        <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2 text-forge-accent">
            <Activity className="w-6 h-6" />
            System Monitor
            </h2>
            <p className="text-slate-400 text-sm">Real-time telemetry and module status.</p>
        </div>
        
        <div className="flex gap-2 relative">
            <button 
                onClick={startScan}
                disabled={isScanning}
                className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg border ${
                    isScanning 
                    ? 'bg-slate-800 border-slate-600 text-slate-400 cursor-wait'
                    : 'bg-emerald-500/10 border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 hover:shadow-emerald-500/20'
                }`}
            >
                {isScanning ? <Zap className="w-5 h-5 animate-pulse" /> : <Search className="w-5 h-5" />}
                {isScanning ? `Scanning... ${scanProgress}%` : 'Full System Scan'}
            </button>
        </div>
      </div>

      {/* Enhanced Progress Bar */}
      {isScanning && (
          <div className="mb-10 px-1">
            <div className="flex justify-between text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">
               <span className="animate-pulse">System Analysis In Progress</span>
               <span className="text-forge-accent">{scanProgress}%</span>
            </div>
            <div className="relative w-full h-3 bg-slate-800 rounded-full">
               <div 
                 className="absolute top-0 left-0 h-full bg-forge-accent shadow-[0_0_15px_#38bdf8] transition-all duration-100 ease-linear rounded-full opacity-80"
                 style={{ width: `${scanProgress}%` }}
               />
            </div>
          </div>
      )}

      {/* Module Grid */}
      <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
              <BrainCircuit className="w-4 h-4" /> Neural Modules
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {modules.map(mod => (
                  <div key={mod.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300">{mod.name}</span>
                          <div className={`w-2 h-2 rounded-full ${mod.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div 
                              className={`h-full transition-all duration-1000 ${mod.status === 'online' ? 'bg-forge-accent' : 'bg-slate-600'}`}
                              style={{ width: `${mod.load}%` }}
                          ></div>
                      </div>
                      <div className="text-[10px] text-slate-500 text-right">{mod.load.toFixed(0)}% Load</div>
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* CPU/GPU Load */}
        <div className="bg-forge-panel p-4 rounded-xl border border-slate-700 shadow-lg h-64">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" /> Computation Load
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorNeural" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="cpu" stackId="1" stroke="#38bdf8" fill="url(#colorCpu)" name="CPU Usage" />
              <Area type="monotone" dataKey="neural" stackId="1" stroke="#a855f7" fill="url(#colorNeural)" name="Neural Engine" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Memory/VRAM */}
        <div className="bg-forge-panel p-4 rounded-xl border border-slate-700 shadow-lg h-64">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400" /> Resource Allocation
          </h3>
           <ResponsiveContainer width="100%" height="80%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
              <Bar dataKey="memory" fill="#f59e0b" radius={[4, 4, 0, 0]} name="RAM (GB)" />
              <Bar dataKey="gpu" fill="#ef4444" radius={[4, 4, 0, 0]} name="VRAM (GB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Terminal Log */}
      <div className="bg-black p-4 rounded-xl border border-slate-700 shadow-lg font-mono text-sm h-72 flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Terminal className="w-3 h-3" /> MOSSY INTEGRATION LOG
              </h3>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar" ref={logsContainerRef}>
          {logs.map((log) => (
            <div key={log.id} className={`text-xs flex gap-3 hover:bg-white/5 p-0.5 rounded ${
                log.type === 'error' ? 'text-red-400' :
                log.type === 'warning' ? 'text-yellow-400' :
                log.type === 'archive' ? 'text-slate-500' :
                'text-terminal-green'
            }`}>
              <span className="opacity-40 whitespace-nowrap min-w-[80px] font-mono">[{log.time}]</span>
              <span className="break-all font-mono">{log.msg}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;