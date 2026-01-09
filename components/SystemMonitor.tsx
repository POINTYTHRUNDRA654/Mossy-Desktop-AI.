import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Cpu, HardDrive, Activity, Terminal, Trash2, Search, CheckCircle2, Database, Layers, Radio, ShieldCheck, Zap, History, Archive, FileCode, XCircle, RefreshCw, Save, Clock, RotateCcw, Upload, Download, DownloadCloud, Box, Settings, Hexagon, BrainCircuit, Package, Share2, Users, Key, Globe, Lock, Link, FileText, Copy, Command, Play, HardDriveDownload, Network } from 'lucide-react';

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type?: 'info' | 'warning' | 'error' | 'archive' | 'success';
}

interface Integration {
  id: string;
  name: string;
  category: 'AI' | 'Modding' | 'System' | 'Creative' | 'Dev';
  path: string;
  status: 'linked' | 'detected' | 'scanning';
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
  const [activeTab, setActiveTab] = useState<'telemetry' | 'deploy'>('telemetry');
  
  // Telemetry State - Initialize from LocalStorage if available
  const [integrations, setIntegrations] = useState<Integration[]>(() => {
      try {
          const saved = localStorage.getItem('mossy_integrations');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  const [data, setData] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [modules, setModules] = useState<SystemModule[]>(modulesList);
  
  // Deployment State
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'complete' | 'error'>('idle');
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [version, setVersion] = useState('1.0.0-beta');
  const [testerKeys, setTesterKeys] = useState<string[]>([]);
  const [releaseUrl, setReleaseUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Installer Wizard State
  const [showInstaller, setShowInstaller] = useState(false);
  const [installStep, setInstallStep] = useState(0); // 0: Init, 1: Scanning, 2: Installing, 3: Done
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [foundTools, setFoundTools] = useState<Array<{name: string, category: string}>>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const buildLogRef = useRef<HTMLDivElement>(null);
  const installLogRef = useRef<HTMLDivElement>(null);
  
  // Persist Integrations whenever they change
  useEffect(() => {
      localStorage.setItem('mossy_integrations', JSON.stringify(integrations));
  }, [integrations]);

  // Robust Fallback: If bridge is active, ensure we have integrations populated
  useEffect(() => {
      const bridgeActive = localStorage.getItem('mossy_bridge_active') === 'true';
      if (bridgeActive && integrations.length < 3) {
          // If bridge is on but we lost the data (e.g. reload), restore robust defaults
          const restoredIntegrations: Integration[] = [
                { id: 'res-1', name: 'Blender 4.2', category: 'Creative', path: 'C:/Program Files/Blender Foundation/', status: 'linked' },
                { id: 'res-2', name: 'Ollama', category: 'AI', path: 'localhost:11434', status: 'linked' },
                { id: 'res-3', name: 'VS Code', category: 'Dev', path: 'C:/AppData/Code/', status: 'linked' },
                { id: 'res-4', name: 'Mod Organizer 2', category: 'Modding', path: 'D:/MO2/', status: 'linked' },
                { id: 'res-5', name: 'ComfyUI', category: 'AI', path: 'D:/AI/ComfyUI/', status: 'linked' },
                { id: 'res-6', name: 'Photoshop 2024', category: 'Creative', path: 'C:/Adobe/', status: 'linked' },
                { id: 'res-7', name: 'Git', category: 'Dev', path: '/bin/git', status: 'linked' }
          ];
          setIntegrations(restoredIntegrations);
          addLog("Restored Integration Map from Persistent Bridge.", 'success');
      }
  }, []);

  // Initialize logs
  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    if (logs.length === 0 && !isScanning) {
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

      setData(prev => {
        const newData = [...prev, { name: time, cpu: cpuVal, memory: memVal, gpu: gpuVal, neural: neuralVal }];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll installer log
  useEffect(() => {
      if (installLogRef.current) {
          installLogRef.current.scrollTop = installLogRef.current.scrollHeight;
      }
  }, [installLog]);

  const addLog = (msg: string, type: 'info' | 'warning' | 'error' | 'archive' | 'success' = 'info') => {
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
    setIntegrations([]); // Clear visual list for dramatic effect, will repopulate
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
            // Restore integrations + some random noise if user clicks manual scan
            const restored: Integration[] = [
                { id: '1', name: 'Blender 4.2', category: 'Creative', path: '/usr/bin/blender', status: 'linked' },
                { id: '2', name: 'Ollama', category: 'AI', path: 'localhost:11434', status: 'linked' },
                { id: '3', name: 'VS Code', category: 'Dev', path: 'code.exe', status: 'linked' },
                { id: '4', name: 'KoboldCPP', category: 'AI', path: 'koboldcpp.exe', status: 'linked' },
                { id: '5', name: 'Stable Diffusion', category: 'AI', path: 'webui-user.bat', status: 'linked' }
            ];
            setIntegrations(restored);
        }
    }, 50);
  };

  // --- Deployment Logic ---
  const startBuild = () => {
      setBuildStatus('building');
      setBuildProgress(0);
      setBuildLog(['Initializing Build Sequence...']);
      
      const steps = [
          "Compiling TypeScript Source...",
          "Optimizing Neural Weights (Quantization: INT4)...",
          "Bundling React Components...",
          "Injecting Desktop Bridge Drivers...",
          "Running Unit Tests (243/243 Passed)...",
          "Signing Binary with Forge Certificate...",
          "Packaging Assets...",
          "Build Successful."
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
          if (currentStep >= steps.length) {
              clearInterval(interval);
              setBuildStatus('complete');
              setReleaseUrl(window.location.href.split('#')[0] + '#/beta/invite/' + Math.random().toString(36).substring(7));
              return;
          }

          setBuildLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[currentStep]}`]);
          setBuildProgress(prev => Math.min(100, prev + (100 / steps.length)));
          currentStep++;
      }, 800);
  };

  const generateTesterKeys = () => {
      const newKey = `BETA-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setTesterKeys(prev => [...prev, newKey]);
  };

  const startInstaller = () => {
      setShowInstaller(true);
      setInstallStep(1);
      setInstallLog(['> Initializing Setup Wizard v2.4.2', '> Checking Permissions... OK', '> Mounting Local File System...']);
      setFoundTools([]);

      // Enhanced Simulation Sequence - Huge List
      const scanSequence = [
          // OS / Drivers
          { path: 'C:/Windows/System32/drivers/etc/hosts', found: true, name: 'System32 Host', cat: 'System' },
          { path: 'C:/Windows/System32/nvidia-smi.exe', found: true, name: 'NVIDIA Drivers', cat: 'System' },
          { path: 'C:/Windows/System32/wsl.exe', found: true, name: 'WSL 2 (Ubuntu)', cat: 'System' },
          
          // Creative
          { path: 'C:/Program Files/Adobe/Adobe Photoshop 2024/Photoshop.exe', found: true, name: 'Photoshop 2024', cat: 'Creative' },
          { path: 'C:/Program Files/Adobe/Adobe Illustrator 2024/Support Files/Contents/Windows/Illustrator.exe', found: false, name: '', cat: '' },
          { path: 'C:/Program Files/Blender Foundation/Blender 4.0/blender.exe', found: true, name: 'Blender 4.0', cat: 'Creative' },
          { path: 'C:/Program Files/Pixologic/ZBrush 2022/ZBrush.exe', found: true, name: 'ZBrush 2022', cat: 'Creative' },
          
          // AI & Neural Services - NETWORK SCAN
          { path: 'tcp://localhost:11434', found: true, name: 'Ollama (Active Service)', cat: 'AI' },
          { path: 'tcp://localhost:5000', found: true, name: 'KoboldCPP (API)', cat: 'AI' },
          { path: 'tcp://localhost:7860', found: true, name: 'Stable Diffusion WebUI', cat: 'AI' },
          { path: 'tcp://localhost:8188', found: true, name: 'ComfyUI Server', cat: 'AI' },

          // AI - FILESYSTEM SCAN
          { path: 'C:/Program Files/LM Studio/LM Studio.exe', found: true, name: 'LM Studio', cat: 'AI' },
          { path: 'C:/Program Files/GPT4All/bin/chat.exe', found: true, name: 'GPT4All', cat: 'AI' },
          { path: 'D:/AI/text-generation-webui/start_windows.bat', found: true, name: 'Oobabooga WebUI', cat: 'AI' },
          { path: 'D:/AI/LocalAI/local-ai.exe', found: true, name: 'LocalAI', cat: 'AI' },

          // Dev
          { path: 'C:/Users/User/AppData/Local/Programs/Microsoft VS Code/Code.exe', found: true, name: 'VS Code', cat: 'Dev' },
          { path: 'C:/Program Files/Git/bin/git.exe', found: true, name: 'Git', cat: 'Dev' },
          { path: 'C:/Program Files/Docker/Docker/Docker Desktop.exe', found: true, name: 'Docker Desktop', cat: 'Dev' },
          { path: 'C:/Python311/python.exe', found: true, name: 'Python 3.11', cat: 'Dev' },

          // Modding
          { path: 'C:/Program Files (x86)/Steam/steamapps/common/Fallout 4/Fallout4.exe', found: true, name: 'Fallout 4', cat: 'Modding' },
          { path: 'D:/Modding/MO2/ModOrganizer.exe', found: true, name: 'Mod Organizer 2', cat: 'Modding' },
          { path: 'D:/Tools/xEdit/FO4Edit.exe', found: true, name: 'FO4Edit', cat: 'Modding' },
          { path: 'D:/Tools/NifSkope/NifSkope.exe', found: true, name: 'NifSkope', cat: 'Modding' },
      ];

      let i = 0;
      const scanInterval = setInterval(() => {
          if (i >= scanSequence.length) {
              clearInterval(scanInterval);
              setInstallLog(prev => [...prev, '> Deep Scan Complete.', '> Registering System Hooks...', '> Installing Bridge Service...']);
              setInstallStep(2);
              
              setTimeout(() => {
                  setInstallLog(prev => [...prev, '> Registering Protocol Handlers...', '> Opening Localhost Port 21337...', '> SUCCESS: Bridge Online.']);
                  setInstallStep(3);
                  
                  // ACTUALLY ACTIVATE BRIDGE & SAVE
                  localStorage.setItem('mossy_bridge_active', 'true');
                  window.dispatchEvent(new Event('storage'));
                  window.dispatchEvent(new CustomEvent('mossy-bridge-connected'));
                  
              }, 1500);
              return;
          }
          const item = scanSequence[i];
          
          // Enhanced log messages for Network/AI scans
          let logMsg = `Scanning: ${item.path.substring(0, 40)}...`;
          if (item.path.startsWith('tcp://')) {
              logMsg = `Port Probe: ${item.path} [NET]...`;
          }
          
          // Show skipped items less frequently to avoid clutter but keep speed
          if (item.found || Math.random() > 0.7) {
              setInstallLog(prev => [...prev, `${logMsg} ${item.found ? 'DETECTED' : 'Not Found'}`]);
          }
          
          if (item.found && item.name) {
              setFoundTools(prev => [...prev, { name: item.name!, category: item.cat! }]);
          }
          i++;
      }, 30); // Faster scan
  };

  const handleFinishInstaller = () => {
      setShowInstaller(false);
      setActiveTab('telemetry');
      
      // Auto-populate integrations based on what we found in the wizard
      const newIntegrations: Integration[] = foundTools.map((tool, index) => ({
          id: `linked-${index}`,
          name: tool.name,
          category: tool.category as any,
          path: 'C:/Program Files/...', // Mock path
          status: 'linked'
      }));
      
      // Add a couple default ones if list is empty (fallback)
      if (newIntegrations.length === 0) {
          newIntegrations.push({ id: 'def-1', name: 'Blender 4.0', category: 'Creative', path: '...', status: 'linked' });
          newIntegrations.push({ id: 'def-2', name: 'VS Code', category: 'Dev', path: '...', status: 'linked' });
          newIntegrations.push({ id: 'def-3', name: 'Ollama', category: 'AI', path: '...', status: 'linked' });
      }

      setIntegrations(newIntegrations);
      
      // Sync with Chat Interface's memory (so Chat knows what apps are available)
      const chatApps = newIntegrations.map(i => ({ id: i.id, name: i.name, category: i.category, checked: true }));
      localStorage.setItem('mossy_apps', JSON.stringify(chatApps));
      
      addLog(`Desktop Bridge linked with ${newIntegrations.length} applications.`, 'success');
  };

  const copyLink = () => {
      if (!releaseUrl) return;
      navigator.clipboard.writeText(releaseUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const downloadManual = () => {
      const element = document.createElement("a");
      const file = new Blob(["OmniForge / Mossy User Manual\n\nVersion: 2.4.2\n\n1. Getting Started\n..."], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "Mossy_User_Manual.txt";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  return (
    <div className="h-full w-full bg-forge-dark text-slate-200 flex flex-col overflow-hidden relative">
      
      {/* --- VIRTUAL INSTALLER MODAL --- */}
      {showInstaller && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
              <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Installer Header */}
                  <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 rounded-lg">
                              <Package className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                              <h2 className="text-xl font-bold text-white">OmniForge Setup Wizard</h2>
                              <p className="text-xs text-slate-400">Deep System Analysis & Bridge Configuration</p>
                          </div>
                      </div>
                      {installStep === 3 && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-500/30 text-xs font-bold animate-pulse">
                              <CheckCircle2 className="w-4 h-4" /> INSTALLED
                          </div>
                      )}
                  </div>

                  {/* Installer Content */}
                  <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
                      {installStep === 1 && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                              <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                              <h3 className="text-lg font-bold text-white animate-pulse">Scanning Local Sectors...</h3>
                              <p className="text-sm text-slate-500 text-center max-w-md">
                                  Cataloging installed applications, development SDKs, and neural services.
                              </p>
                          </div>
                      )}

                      {installStep >= 2 && (
                          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                              <div className="text-sm text-slate-400 mb-4 font-bold uppercase tracking-wider flex justify-between items-end">
                                  <span>Detected Environment ({foundTools.length} Items)</span>
                                  <span className="text-emerald-500 text-xs">SCAN COMPLETE</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
                                  {foundTools.map((tool, i) => (
                                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 animate-slide-up hover:border-emerald-500/30 transition-colors" style={{animationDelay: `${i*30}ms`}}>
                                          <div className={`p-1.5 rounded ${
                                              tool.category === 'System' ? 'bg-blue-900/30 text-blue-400' :
                                              tool.category === 'Creative' ? 'bg-purple-900/30 text-purple-400' :
                                              tool.category === 'Modding' ? 'bg-orange-900/30 text-orange-400' :
                                              tool.category === 'AI' ? 'bg-red-900/30 text-red-400' :
                                              'bg-emerald-900/30 text-emerald-400'
                                          }`}>
                                              {tool.category === 'AI' ? <BrainCircuit className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                          </div>
                                          <div className="min-w-0">
                                              <div className="font-bold text-white text-xs truncate max-w-[150px]">{tool.name}</div>
                                              <div className="text-[10px] text-slate-500 uppercase">{tool.category}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Log Output */}
                      <div className="h-32 bg-black rounded-lg border border-slate-800 p-4 font-mono text-[10px] text-slate-300 overflow-y-auto" ref={installLogRef}>
                          {installLog.map((log, i) => (
                              <div key={i} className={`mb-1 ${log.includes('DETECTED') ? 'text-emerald-400' : log.includes('Port Probe') ? 'text-blue-400' : log.includes('Not Found') ? 'text-slate-600' : ''}`}>
                                  {log}
                              </div>
                          ))}
                          {installStep === 2 && <div className="text-emerald-500 animate-pulse">_</div>}
                      </div>
                  </div>

                  {/* Installer Footer */}
                  <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                      {installStep < 3 ? (
                          <button disabled className="px-6 py-2 bg-slate-800 text-slate-500 font-bold rounded-lg cursor-not-allowed">
                              Processing...
                          </button>
                      ) : (
                          <button 
                              onClick={handleFinishInstaller}
                              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                          >
                              <Play className="w-4 h-4 fill-current" /> Launch Mossy
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700 bg-forge-panel px-6 pt-4 gap-1">
          <button 
            onClick={() => setActiveTab('telemetry')}
            className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'telemetry' 
                ? 'bg-slate-800 text-white border-t border-x border-slate-700' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
              <Activity className="w-4 h-4" /> Telemetry
          </button>
          <button 
            onClick={() => setActiveTab('deploy')}
            className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'deploy' 
                ? 'bg-slate-800 text-emerald-400 border-t border-x border-slate-700' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
              <Package className="w-4 h-4" /> Deploy & Release
          </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
      
      {/* TELEMETRY TAB */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-2 text-forge-accent">
                    <Activity className="w-6 h-6" />
                    System Monitor
                    </h2>
                    <p className="text-slate-400 text-sm">Real-time telemetry and module status.</p>
                </div>
                
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

            {/* Integration List (New Feature) */}
            {integrations.length > 0 && (
                <div className="mb-8 animate-fade-in">
                    <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                        <Link className="w-4 h-4" /> Active Integrations
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {integrations.map(app => (
                            <div key={app.id} className="bg-slate-800 border border-slate-700 p-3 rounded-lg flex flex-col justify-between shadow-sm hover:border-forge-accent transition-colors h-full">
                                <div className="flex items-start gap-3 mb-2">
                                    <div className={`p-1.5 rounded text-slate-300 ${app.category === 'AI' ? 'bg-red-900/30' : 'bg-slate-900'}`}>
                                        {app.category === 'AI' ? <BrainCircuit className="w-4 h-4 text-red-400" /> : <Box className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-white truncate" title={app.name}>{app.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase truncate">{app.category}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/20 rounded border border-emerald-500/30 w-fit">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase">Linked</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Scan Progress */}
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
                {/* Charts */}
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
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} itemStyle={{ color: '#e2e8f0' }} />
                    <Area type="monotone" dataKey="cpu" stackId="1" stroke="#38bdf8" fill="url(#colorCpu)" name="CPU Usage" />
                    <Area type="monotone" dataKey="neural" stackId="1" stroke="#a855f7" fill="url(#colorNeural)" name="Neural Engine" />
                    </AreaChart>
                </ResponsiveContainer>
                </div>

                <div className="bg-forge-panel p-4 rounded-xl border border-slate-700 shadow-lg h-64">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-400" /> Resource Allocation
                </h3>
                <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" hide />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
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
                        log.type === 'success' ? 'text-emerald-400' :
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
      )}

      {/* DEPLOY TAB */}
      {activeTab === 'deploy' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Build Config */}
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-6">
                          <div>
                              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                  <Package className="w-6 h-6 text-emerald-400" />
                                  Deployment Pipeline
                              </h3>
                              <p className="text-sm text-slate-400 mt-1">Configure and compile application build artifacts.</p>
                          </div>
                          <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-slate-500 uppercase">Target Version</span>
                              <input 
                                  type="text" 
                                  value={version}
                                  onChange={(e) => setVersion(e.target.value)}
                                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-28 text-right focus:border-emerald-500 outline-none"
                              />
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="p-4 bg-slate-900 rounded-lg border border-emerald-500/30 flex flex-col gap-2 cursor-pointer hover:bg-slate-900/80">
                              <Globe className="w-6 h-6 text-emerald-400" />
                              <span className="font-bold text-white text-sm">Web (PWA)</span>
                              <span className="text-xs text-emerald-400 font-mono">ACTIVE</span>
                          </div>
                          <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 flex flex-col gap-2 opacity-50 cursor-not-allowed">
                              <Settings className="w-6 h-6 text-slate-400" />
                              <span className="font-bold text-slate-300 text-sm">Windows .exe</span>
                              <span className="text-xs text-slate-500 font-mono">MISSING SDK</span>
                          </div>
                          <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 flex flex-col gap-2 opacity-50 cursor-not-allowed">
                              <Terminal className="w-6 h-6 text-slate-400" />
                              <span className="font-bold text-slate-300 text-sm">Linux AppImage</span>
                              <span className="text-xs text-slate-500 font-mono">MISSING SDK</span>
                          </div>
                      </div>

                      {/* Build Console */}
                      <div className="bg-black rounded-lg border border-slate-700 font-mono text-xs p-4 h-64 overflow-y-auto mb-6 flex flex-col">
                          {buildLog.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-slate-600">
                                  Waiting for build command...
                              </div>
                          ) : (
                              <div className="space-y-1">
                                  {buildLog.map((log, i) => (
                                      <div key={i} className="text-slate-300">{log}</div>
                                  ))}
                                  {buildStatus === 'complete' && <div className="text-emerald-400 font-bold mt-2">Build sequence finished.</div>}
                                  <div ref={buildLogRef} />
                              </div>
                          )}
                      </div>

                      {/* Controls */}
                      <div className="flex gap-4">
                          {buildStatus === 'building' ? (
                              <div className="flex-1 bg-slate-700 rounded-lg h-12 relative overflow-hidden">
                                  <div className="absolute inset-0 bg-emerald-600 transition-all duration-300" style={{ width: `${buildProgress}%` }}></div>
                                  <div className="absolute inset-0 flex items-center justify-center font-bold text-white drop-shadow-md">
                                      Compiling... {buildProgress.toFixed(0)}%
                                  </div>
                              </div>
                          ) : (
                              <button 
                                  onClick={startBuild}
                                  disabled={buildStatus === 'complete'}
                                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                  <RefreshCw className="w-5 h-5" />
                                  Initialize Build
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Release Management Panel - Only shows after build */}
                  {buildStatus === 'complete' && (
                      <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-6 animate-fade-in shadow-2xl">
                          <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-emerald-500/20 rounded-full">
                                  <Share2 className="w-5 h-5 text-emerald-400" />
                              </div>
                              <h3 className="text-lg font-bold text-white">Release Management</h3>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2 bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col gap-2">
                                  <label className="text-[10px] text-slate-500 uppercase font-bold">Public Beta Link</label>
                                  <div className="flex gap-2">
                                      <div className="flex-1 bg-black rounded px-3 py-2 text-sm font-mono text-emerald-400 border border-slate-800 truncate">
                                          {releaseUrl}
                                      </div>
                                      <button 
                                          onClick={copyLink}
                                          className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
                                      >
                                          {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                      </button>
                                  </div>
                              </div>

                              <button 
                                  onClick={startInstaller}
                                  className="p-3 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-white transition-colors shadow-lg shadow-purple-900/20"
                              >
                                  <HardDriveDownload className="w-4 h-4" /> Launch Connection Wizard
                              </button>

                              <button 
                                  onClick={downloadManual}
                                  className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-white transition-colors"
                              >
                                  <FileText className="w-4 h-4" /> Download Manual
                              </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-4 italic text-center">
                              Use the <strong>Connection Wizard</strong> to simulate scanning this machine and establish a persistent bridge connection.
                          </p>
                      </div>
                  )}
              </div>

              {/* Beta Management */}
              <div className="space-y-6">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
                      <div className="mb-6">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <Users className="w-5 h-5 text-blue-400" />
                              Beta Access
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">Manage tester invitations.</p>
                      </div>

                      <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700 p-4 mb-4 overflow-y-auto">
                          {testerKeys.length === 0 ? (
                              <div className="text-center text-slate-500 text-xs mt-10">
                                  No active keys generated.
                              </div>
                          ) : (
                              <div className="space-y-2">
                                  {testerKeys.map((key, i) => (
                                      <div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded border border-slate-800">
                                          <div className="flex items-center gap-2">
                                              <Key className="w-3 h-3 text-yellow-500" />
                                              <span className="font-mono text-xs text-slate-300">{key}</span>
                                          </div>
                                          <span className="text-[10px] text-emerald-500">ACTIVE</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <button 
                          onClick={generateTesterKeys}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                      >
                          <Share2 className="w-4 h-4" />
                          Generate Invite Key
                      </button>
                      
                      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-lg flex gap-3">
                          <Lock className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-yellow-200/70 leading-relaxed">
                              Keys grant full read/write access to the project file. Share only with trusted testers.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      </div>
    </div>
  );
};

export default SystemMonitor;