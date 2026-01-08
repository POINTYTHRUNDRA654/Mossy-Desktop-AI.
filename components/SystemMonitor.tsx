import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Cpu, HardDrive, Activity, Terminal, Trash2, Search, CheckCircle, Database, Layers, Radio, ShieldCheck, Zap, History, Archive, FileCode, XCircle, RefreshCw, Save, Clock, RotateCcw, Upload, Download, DownloadCloud, Box, Settings } from 'lucide-react';

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

const SystemMonitor: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [nifProcess, setNifProcess] = useState<{ pid: number; file: string; status: 'idle' | 'running' | 'terminated' }>({ pid: 0, file: '', status: 'idle' });
  
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

  // Resource Monitoring State
  const [flashState, setFlashState] = useState<{ cpu: boolean; memory: boolean }>({ cpu: false, memory: false });
  const highUsageTracker = useRef<{ cpu: number | null; memory: number | null; gpu: number | null }>({ cpu: null, memory: null, gpu: null });
  const warningLogged = useRef<{ cpu: boolean; memory: boolean; gpu: boolean }>({ cpu: false, memory: false, gpu: false });

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const nifInputRef = useRef<HTMLInputElement>(null);
  const historyInputRef = useRef<HTMLInputElement>(null);

  // Initialize logs & history
  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    if (logs.length === 0 && !isScanning && integrations.length === 0) {
        setLogs([
        { id: 'init-1', time: t, msg: "[SYSTEM] Mossy Backend Services Active...", type: 'info' },
        { id: 'init-2', time: t, msg: "[WAITING] Passive monitoring initialized...", type: 'warning' },
        ]);
    }

    // Load history
    const saved = localStorage.getItem('omniforge_scan_history');
    if (saved) {
      try {
        setScanHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Auto-scroll logs only if we are at the bottom or it's a new live log
  useEffect(() => {
    if (logsContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [logs]);

  // Chart data simulation & Monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      // Load increases if scanning or many integrations found
      // Modified logic to allow higher spikes for monitoring testing
      const baseLoad = isScanning ? 60 : (integrations.length * 5) + 10;
      
      const cpuVal = Math.min(100, Math.floor(Math.random() * 30) + baseLoad);
      const memVal = Math.min(100, Math.floor(Math.random() * 20) + baseLoad + 10);
      const gpuVal = Math.min(100, Math.floor(Math.random() * 40) + (isScanning ? 30 : 10));
      const neuralVal = Math.min(100, Math.floor(Math.random() * 40) + (integrations.length > 0 ? 30 : 0));

      const newPoint = {
        name: time,
        cpu: cpuVal,
        memory: memVal,
        gpu: gpuVal,
        neural: neuralVal,
      };

      // --- Monitor High Usage Logic ---
      const checkMetric = (metric: 'cpu' | 'memory' | 'gpu', val: number, chartKey: 'cpu' | 'memory') => {
        const threshold = 85;
        const duration = 30000; // 30s in ms

        if (val > threshold) {
          if (highUsageTracker.current[metric] === null) {
            highUsageTracker.current[metric] = Date.now();
          } else {
            const elapsed = Date.now() - highUsageTracker.current[metric]!;
            if (elapsed > duration && !warningLogged.current[metric]) {
              // Trigger Log
              setLogs(prev => {
                 const newEntry: LogEntry = {
                    id: Date.now().toString() + Math.random(),
                    time: new Date().toLocaleTimeString(),
                    msg: `[WARNING] High ${metric.toUpperCase()} usage detected (>85%) for 30s! System performance may degrade.`,
                    type: 'warning'
                 };
                 const updated = [...prev, newEntry];
                 return updated.length > 200 ? updated.slice(updated.length - 200) : updated;
              });

              // Trigger Warning Flag to prevent spam
              warningLogged.current[metric] = true;

              // Trigger Visual Flash
              setFlashState(prev => ({ ...prev, [chartKey]: true }));
              setTimeout(() => {
                setFlashState(prev => ({ ...prev, [chartKey]: false }));
              }, 2000); // Flash duration
            }
          }
        } else {
          // Reset tracking if drops below threshold
          highUsageTracker.current[metric] = null;
          warningLogged.current[metric] = false;
        }
      };

      // Monitor Metrics
      checkMetric('cpu', cpuVal, 'cpu');
      checkMetric('memory', memVal, 'memory');
      checkMetric('gpu', gpuVal, 'memory'); // GPU is in the second chart (Resource Allocation)

      setData(prev => {
        const newData = [...prev, newPoint];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isScanning, integrations.length]);

  // Random logs if active
  useEffect(() => {
      if (integrations.length === 0 && !isScanning) return;

      const interval = setInterval(() => {
        if (Math.random() > 0.7) {
            const activeApps = integrations.map(i => i.name);
            const app = activeApps[Math.floor(Math.random() * activeApps.length)] || "System";
            
            const messages = [
                `[${app}] Syncing context data...`,
                `[DAEMON] Watchdog check active...`,
                `[BRIDGE] Pipeline optimized (14ms)...`,
                `[NETWORK] Localhost packet received...`,
                `[AI] Inference pattern update...`
            ];
            addLog(messages[Math.floor(Math.random() * messages.length)], 'info');
        }
      }, 2000);
      return () => clearInterval(interval);
  }, [integrations, isScanning]);

  const addLog = (msg: string, type: 'info' | 'warning' | 'error' | 'archive' = 'info') => {
    setLogs(prev => {
        const newEntry = {
            id: Date.now().toString() + Math.random(),
            time: new Date().toLocaleTimeString(),
            msg: msg,
            type
        };
        const updated = [...prev, newEntry];
        return updated.length > 200 ? updated.slice(updated.length - 200) : updated;
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const loadArchivedLogs = () => {
    const archives: LogEntry[] = [];
    const baseTime = new Date();
    baseTime.setDate(baseTime.getDate() - 1); // Yesterday

    const historicalEvents = [
        { msg: "System kernel update successful (v4.2.0)", type: 'info' },
        { msg: "Backup routine completed: 45GB transferred", type: 'info' },
        { msg: "Warning: High memory usage detected in render pipeline", type: 'warning' },
        { msg: "Mossy service restarted by user", type: 'info' },
        { msg: "Connection established with external drive 'Vault_111'", type: 'info' },
        { msg: "NifSkope plugin registered successfully", type: 'info' },
        { msg: "Failed to connect to local Ollama instance (Timeout)", type: 'error' }
    ];

    historicalEvents.forEach((event, i) => {
        const t = new Date(baseTime.getTime() + i * 15 * 60000); // 15 min increments
        archives.push({
            id: `archive-${Date.now()}-${i}`,
            time: t.toLocaleTimeString(),
            msg: `[ARCHIVE] ${event.msg}`,
            type: event.type as any
        });
    });
    
    setLogs(prev => [...archives, ...prev]);
    // Scroll to top to show loaded archives
    if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = 0;
    }
  };

  // --- Snapshot History Logic ---

  const saveSnapshot = (items: Integration[]) => {
    if (items.length === 0) return;
    const newSnapshot: ScanSnapshot = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        integrations: items
    };
    const updated = [newSnapshot, ...scanHistory].slice(0, 10); // Keep last 10
    setScanHistory(updated);
    localStorage.setItem('omniforge_scan_history', JSON.stringify(updated));
    addLog(`[HISTORY] System snapshot saved: ${newSnapshot.timestamp}`, 'archive');
  };

  const loadSnapshot = (snapshot: ScanSnapshot) => {
    setIntegrations(snapshot.integrations);
    addLog(`[HISTORY] Restored snapshot from ${snapshot.timestamp}`, 'info');
    setShowHistoryPanel(false);
  };

  const clearHistory = () => {
    setScanHistory([]);
    localStorage.removeItem('omniforge_scan_history');
    addLog(`[HISTORY] Snapshot archive cleared.`, 'warning');
  };

  const exportHistory = () => {
    if (scanHistory.length === 0) {
        addLog("[HISTORY] No data to export.", 'warning');
        return;
    }
    const dataStr = JSON.stringify(scanHistory, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mossy_history_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("[HISTORY] Exported scan history to JSON.", 'archive');
  };

  const handleImportHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const result = event.target?.result as string;
            const parsed = JSON.parse(result);
            if (!Array.isArray(parsed)) throw new Error("Invalid format");
            
            // Validate basic structure of items
            const validItems = parsed.filter(p => p.id && p.timestamp && Array.isArray(p.integrations));
            
            if (validItems.length === 0) {
                 addLog("[HISTORY] No valid snapshots found in file.", 'warning');
                 return;
            }

            setScanHistory(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newItems = validItems.filter(p => !existingIds.has(p.id));
                const combined = [...newItems, ...prev].slice(0, 20); // Keep max 20 when importing
                localStorage.setItem('omniforge_scan_history', JSON.stringify(combined));
                return combined;
            });
            addLog(`[HISTORY] Imported ${validItems.length} snapshots successfully.`, 'info');
        } catch (error) {
            addLog("[ERROR] Failed to import history: Invalid JSON.", 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  // --- Model Hub Logic ---
  
  const toggleModelHub = () => {
    setShowModelHub(!showModelHub);
    if (!showModelHub) setShowHistoryPanel(false);
  };
  
  const toggleHistory = () => {
    setShowHistoryPanel(!showHistoryPanel);
    if (!showHistoryPanel) setShowModelHub(false);
  };

  const startModelDownload = () => {
    if (isDownloadingModel) return;
    setIsDownloadingModel(true);
    setModelDownloadProgress(0);
    addLog(`[HUB] Initiating download: ${modelConfig.name} [${modelConfig.format}/${modelConfig.quantization}]`, 'info');

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 5) + 1;
        if (progress > 100) progress = 100;
        
        setModelDownloadProgress(progress);
        
        if (progress % 20 === 0 && progress < 100) {
            addLog(`[NETWORK] Downloading chunk ${(progress / 100 * 4.2).toFixed(1)}GB / 4.2GB... (${(Math.random() * 15 + 10).toFixed(1)} MB/s)`, 'info');
        }

        if (progress === 100) {
            clearInterval(interval);
            setIsDownloadingModel(false);
            addLog(`[HUB] Download complete. Verifying SHA256 checksum...`, 'info');
            setTimeout(() => {
                addLog(`[HUB] Integrity verified. Model mounted to /models/${modelConfig.format.toLowerCase()}/`, 'info');
                setShowModelHub(false);
            }, 800);
        }
    }, 200);
  };

  // -----------------------------

  const handleNifSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Simulate a realistic path for the file in the virtual environment
        const virtualPath = `D:/Modding/Fallout4/Data/Meshes/Weapons/${file.name}`;
        
        addLog(`[BRIDGE] Intercepting file selection from Shell...`, 'info');
        
        setTimeout(() => {
             const newPid = Math.floor(Math.random() * 8000) + 1000;
             addLog(`[CMD] Executing: "C:/Tools/NifSkope/NifSkope.exe" "${virtualPath}"`, 'info');
             
             // Randomly simulate success or error (mostly success)
             const isError = Math.random() > 0.95;
             
             setTimeout(() => {
                 if (isError) {
                     addLog(`[ERROR] NifSkope process exited with code 1`, 'error');
                     addLog(`[STDERR] Fatal: "${file.name}" contains invalid NiNode block structure.`, 'error');
                     setNifProcess({ pid: 0, file: '', status: 'terminated' });
                 } else {
                     addLog(`[NIFSKOPE] Process attached (PID: ${newPid})`, 'info');
                     addLog(`[NIFSKOPE] Loaded "${file.name}" (${(file.size / 1024).toFixed(2)} KB)`, 'info');
                     addLog(`[NIFSKOPE] Render viewport initialized in 240ms`, 'info');
                     setNifProcess({ pid: newPid, file: file.name, status: 'running' });

                     // Simulated NIF Validation based on user selection
                     setTimeout(() => {
                        addLog(`[VALIDATOR] Initiating custom validation sequence...`, 'info');
                        
                        setTimeout(() => {
                           let issues = 0;
                           const seed = Math.random(); // Deterministic enough for this run

                           if (validationOptions.nodeHierarchy) {
                               if (seed > 0.7) {
                                   addLog(`[HIERARCHY] Warning: NiTriShape "Receiver01": Normals detected but Tangents missing.`, 'warning');
                                   issues++;
                               } else {
                                   addLog(`[HIERARCHY] Node structure verified (BSConnectPoint::Parents found).`, 'info');
                               }
                               
                               // Log stats about graph structure
                               const niNodeCount = 12 + Math.floor(Math.random() * 15);
                               const shapeCount = 4 + Math.floor(Math.random() * 6);
                               const stripCount = Math.floor(Math.random() * 2);
                               const avgDepth = (2.5 + Math.random() * 1.5).toFixed(2);
                               
                               addLog(`[STATS] Scene Graph: NiNode(${niNodeCount}), NiTriShape(${shapeCount}), NiTriStrips(${stripCount})`, 'info');
                               addLog(`[STATS] Spatial Complexity: Avg Depth ${avgDepth} | Root Bounds Verified`, 'info');

                               // Missing Geometry Data Check (Orphan Nodes)
                               if (Math.random() > 0.8) {
                                   const orphanNodes = ['NiTriShape "Trigger_Poly"', 'NiTriShape "Bolt_Catch"', 'NiTriShape "Muzzle_Break"'];
                                   const orphan = orphanNodes[Math.floor(Math.random() * orphanNodes.length)];
                                   addLog(`[HIERARCHY] Critical Error: ${orphan} has no associated NiTriShapeData or NiTriStripsData block. Mesh is empty/invisible.`, 'error');
                                   issues++;
                               }

                               // Deep Hierarchy Check (> 5 Levels)
                               if (parseFloat(avgDepth) > 3.0 || Math.random() > 0.65) {
                                    const deepNodes = [`NiNode "Finger_02_L"`, `NiTriShape "Bolt_LP_01"`, `NiNode "Sight_Rear_Att"`, `NiNode "Helper_Mag_Release"`];
                                    const targetNode = deepNodes[Math.floor(Math.random() * deepNodes.length)];
                                    const depthLevel = 6 + Math.floor(Math.random() * 4);
                                    addLog(`[HIERARCHY] Depth Warning: ${targetNode} is ${depthLevel} levels deep (Limit: 5). Flattening hierarchy recommended.`, 'warning');
                                    issues++;
                               }

                               // Unexpected Naming Convention Check
                               if (Math.random() > 0.6) {
                                   const suspiciousNames = [`Cylinder.001`, `Cube.004`, `Material.001`, `Shape_Indexed_11`];
                                   const detectedName = suspiciousNames[Math.floor(Math.random() * suspiciousNames.length)];
                                   addLog(`[HIERARCHY] Naming Alert: Node '${detectedName}' violates Fallout 4 naming conventions. Expected descriptive names (e.g., 'Receiver', 'Stock').`, 'warning');
                                   issues++;
                               }
                           }

                           if (validationOptions.shaderFlags) {
                               const shaderRoll = Math.random();
                               
                               // Expanded check logic
                               if (seed > 0.5 && seed < 0.6) {
                                   addLog(`[SHADERS] Warning: Block 12 (BSLightingShaderProperty): SLSF2_Double_Sided flag mismatch. Mesh may cull backfaces incorrectly.`, 'warning');
                                   issues++;
                               } else if (shaderRoll > 0.8) {
                                   addLog(`[SHADERS] Error: Texture Slot 4 (Cubemap) detected but SLSF1_Environment_Mapping flag is disabled. Reflections will not render.`, 'error');
                                   issues++;
                               } else if (shaderRoll < 0.15) {
                                   addLog(`[SHADERS] Error: Glow Map (_g.dds) detected in Slot 3, but SLSF1_External_Emissive flag is MISSING. Mesh will appear dark.`, 'error');
                                   issues++;
                               } else if (seed < 0.1) {
                                   addLog(`[SHADERS] Warning: Vertex Colors present in mesh data, but SLSF2_Vertex_Colors flag is disabled.`, 'warning');
                                   issues++;
                               } else {
                                   addLog(`[SHADERS] Flags optimized for Creation Engine (PBR). Environment, Emissive, and Alpha flags verified.`, 'info');
                               }
                           }

                           if (validationOptions.collisionLayers) {
                               if (seed < 0.15) {
                                   addLog(`[COLLISION] Error: NiNode "ProjectileNode" has no child collision object.`, 'error');
                                   issues++;
                               } else if (seed >= 0.15 && seed < 0.35) {
                                   const intentRoll = Math.random();
                                   let intent = "Static Mesh";
                                   let recommended = "OL_STATIC";
                                   
                                   // Fix Logic: Ensure Projectile can be reached
                                   if (intentRoll > 0.85) {
                                       intent = "Dynamic Projectile";
                                       recommended = "OL_PROJECTILE";
                                   } else if (intentRoll > 0.6) {
                                       intent = "Animated Object";
                                       recommended = "OL_ANIM_STATIC";
                                   } else if (intentRoll > 0.4) {
                                       intent = "Trigger Volume";
                                       recommended = "OL_TRIGGER";
                                   }

                                   const wrongLayers = ['OL_CLUTTER', 'OL_BIPED', 'OL_WATER', 'OL_NONCOLLIDABLE', 'OL_TRANSPARENT'];
                                   const detected = wrongLayers[Math.floor(Math.random() * wrongLayers.length)];

                                   addLog(`[COLLISION] Analysis: Geometry topology suggests usage as ${intent}.`, 'warning');
                                   addLog(`[COLLISION] Layer Violation: Found "${detected}". Expected "${recommended}" for correct physics simulation.`, 'warning');
                                   issues++;
                               } else {
                                   addLog(`[COLLISION] Havok physics data validated (Layer: OL_WEAPON).`, 'info');
                               }
                           }
                           
                           if (issues > 0) {
                               addLog(`[VALIDATOR] Analysis complete: ${issues} issues found. Review required.`, 'warning');
                           } else {
                               addLog(`[VALIDATOR] All checks passed. Asset ready for CK import.`, 'info');
                           }
                        }, 600);
                     }, 500);
                 }
             }, 800);
        }, 400);
    }
    // Reset to allow selecting same file
    if (e.target) e.target.value = '';
  };

  const handleTerminateNif = () => {
    if (nifProcess.status !== 'running') return;
    addLog(`[KILL] Sending SIGTERM to process ${nifProcess.pid}...`, 'warning');
    setTimeout(() => {
        setNifProcess(prev => ({ ...prev, status: 'terminated' }));
        addLog(`[SYSTEM] Process ${nifProcess.pid} terminated successfully. Resources released.`, 'info');
    }, 600);
  };

  const handleCheckStatusNif = () => {
    if (nifProcess.status === 'running') {
        addLog(`[QUERY] Polling PID ${nifProcess.pid}...`, 'info');
        setTimeout(() => {
            // Simulate dynamic values for more realistic monitoring
            const memUsage = 140 + Math.floor(Math.random() * 45);
            const threadCount = 6 + Math.floor(Math.random() * 4);
            addLog(`[STATUS] PID ${nifProcess.pid} is RESPONDING. Mem: ${memUsage}MB. Threads: ${threadCount}.`, 'info');
        }, 400);
    } else {
        addLog(`[QUERY] Checking NifSkope service status...`, 'info');
        setTimeout(() => {
            addLog(`[STATUS] Service is IDLE. No active file loaded.`, 'warning');
        }, 400);
    }
  };

  const startScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setIntegrations([]);
    addLog("[CORE] Initiating Deep System Scan...", 'info');

    const targets = [
        { name: 'Blender 4.2 LTS', category: 'Modding', path: '/usr/bin/blender' },
        { name: 'Creation Kit (FO4)', category: 'Modding', path: 'C:/Steam/Fallout4/CK.exe' },
        { name: 'NifSkope 2.0', category: 'Modding', path: 'C:/Tools/NifSkope/NifSkope.exe' },
        { name: 'Ollama Service', category: 'AI', path: 'localhost:11434' },
        { name: 'AMUSE', category: 'AI', path: 'C:/Program Files/Amuse/Amuse.exe' },
        { name: 'PhotoDemon', category: 'System', path: 'E:/Tools/PhotoDemon/PhotoDemon.exe' },
        { name: 'GIMP 3.0.4', category: 'System', path: 'C:/Program Files/GIMP 3/bin/gimp-3.0.exe' },
    ];
    
    // Use a copy for processing to allow capturing all found items for the snapshot
    const queue = [...targets];
    const detectedSession: Integration[] = [];

    let step = 0;
    
    const scanInterval = setInterval(() => {
        step += 2;
        setScanProgress(step);

        // Simulation events
        if (step === 10) addLog("[SCAN] Enumerating filesystem (Depth: 3)...", 'info');
        if (step === 25) addLog("[SCAN] Analyzing registry keys for 3D tools...", 'info');
        if (step === 40) addLog("[SCAN] Port scan 3000-9000 (Local Services)...", 'warning');
        if (step === 60) addLog("[SCAN] Verifying python environment dependencies...", 'info');
        
        // Discovery events
        if (step % 14 === 0 && queue.length > 0) {
            const target = queue.shift();
            if (target) {
                const newInt = { ...target, id: step.toString(), status: 'linked' } as Integration;
                detectedSession.push(newInt);
                addLog(`[DISCOVERY] Found compatible integration: ${target.name}`, 'info');
                setIntegrations(prev => [...prev, newInt]);
            }
        }

        if (step >= 100) {
            clearInterval(scanInterval);
            setIsScanning(false);
            addLog("[CORE] Scan Complete. Ecosystem synchronized.", 'info');
            addLog("[SYSTEM] All bridges active. Ready for workflow.", 'info');
            saveSnapshot(detectedSession); // Auto-save snapshot
        }
    }, 100);
  };

  return (
    <div className="h-full w-full p-6 bg-forge-dark text-slate-200 overflow-y-auto">
      {/* Hidden inputs */}
      <input 
        type="file" 
        ref={nifInputRef} 
        className="hidden" 
        accept=".nif,.nif_w" 
        onChange={handleNifSelect} 
      />
      <input
        type="file"
        ref={historyInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImportHistory}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative">
        <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2 text-forge-accent">
            <Activity className="w-6 h-6" />
            Mossy System Map
            </h2>
            <p className="text-slate-400 text-sm">Real-time telemetry and bridge status.</p>
        </div>
        
        <div className="flex gap-2 relative">
            <button
                onClick={toggleModelHub}
                className={`px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition-all border ${
                    showModelHub
                    ? 'bg-forge-accent text-slate-900 border-forge-accent'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
                <DownloadCloud className="w-5 h-5" />
                Model Hub
            </button>
            <button 
                onClick={toggleHistory}
                className={`px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition-all border ${
                    showHistoryPanel 
                    ? 'bg-forge-accent text-slate-900 border-forge-accent' 
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
                <History className="w-5 h-5" />
                Snapshots
            </button>
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
                {isScanning ? `Scanning... ${scanProgress}%` : 'Scan Local Ecosystem'}
            </button>

            {/* Model Hub Panel Dropdown */}
            {showModelHub && (
                <div className="absolute top-14 right-0 w-96 bg-forge-panel border border-slate-600 rounded-xl shadow-2xl z-20 p-5">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                        <h4 className="font-bold text-white flex items-center gap-2">
                            <Box className="w-4 h-4 text-forge-accent" /> AI Model Manager
                        </h4>
                        <button onClick={() => setShowModelHub(false)} className="text-slate-500 hover:text-white">
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Model Architecture</label>
                            <select 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-forge-accent focus:outline-none"
                                value={modelConfig.name}
                                onChange={(e) => setModelConfig({...modelConfig, name: e.target.value})}
                                disabled={isDownloadingModel}
                            >
                                <option value="Llama-3-8B-Instruct">Llama 3 8B Instruct</option>
                                <option value="Mistral-7B-v0.3">Mistral 7B v0.3</option>
                                <option value="Gemma-7B-it">Gemma 7B Instruct</option>
                                <option value="Stable-Diffusion-XL-Turbo">Stable Diffusion XL Turbo</option>
                                <option value="Whisper-Large-v3">Whisper Large v3 (Audio)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Format</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-forge-accent focus:outline-none"
                                    value={modelConfig.format}
                                    onChange={(e) => setModelConfig({...modelConfig, format: e.target.value})}
                                    disabled={isDownloadingModel}
                                >
                                    <option value="GGUF">GGUF (CPU/Edge)</option>
                                    <option value="ONNX">ONNX (Generic)</option>
                                    <option value="SafeTensors">SafeTensors (GPU)</option>
                                    <option value="CoreML">CoreML (Apple)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Quantization</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-forge-accent focus:outline-none"
                                    value={modelConfig.quantization}
                                    onChange={(e) => setModelConfig({...modelConfig, quantization: e.target.value})}
                                    disabled={isDownloadingModel}
                                >
                                    <option value="Q4_K_M">Q4_K_M (Balanced)</option>
                                    <option value="Q5_K_M">Q5_K_M (High Quality)</option>
                                    <option value="Q8_0">Q8_0 (Lossless)</option>
                                    <option value="FP16">FP16 (Raw)</option>
                                </select>
                            </div>
                        </div>

                        {/* Progress Section */}
                        {isDownloadingModel ? (
                            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-forge-accent animate-pulse">Downloading...</span>
                                    <span>{modelDownloadProgress}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-forge-accent transition-all duration-200" 
                                        style={{width: `${modelDownloadProgress}%`}}
                                    />
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1 text-center font-mono">
                                    Downloading from HuggingFace Hub...
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={startModelDownload}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                <DownloadCloud className="w-5 h-5" />
                                Fetch Model
                            </button>
                        )}
                        
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-center border-t border-slate-700 pt-3">
                             <Settings className="w-3 h-3" /> Configures local inference endpoints automatically.
                        </div>
                    </div>
                </div>
            )}

            {/* History Panel Dropdown */}
            {showHistoryPanel && (
                <div className="absolute top-14 right-0 w-80 bg-forge-panel border border-slate-600 rounded-xl shadow-2xl z-20 p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Scan History
                        </h4>
                        <button 
                            onClick={clearHistory}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:bg-red-900/20 px-2 py-1 rounded"
                        >
                            <Trash2 className="w-3 h-3" /> Clear
                        </button>
                    </div>

                     {/* Import/Export Controls */}
                    <div className="flex gap-2 mb-3">
                         <button onClick={exportHistory} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded border border-slate-600 flex items-center justify-center gap-1 transition-colors">
                            <Download className="w-3 h-3" /> Export
                         </button>
                         <button onClick={() => historyInputRef.current?.click()} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded border border-slate-600 flex items-center justify-center gap-1 transition-colors">
                            <Upload className="w-3 h-3" /> Import
                         </button>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                        {scanHistory.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-xs italic">
                                No snapshots saved.<br/>Run a scan to create one.
                            </div>
                        ) : (
                            scanHistory.map(snap => (
                                <button
                                    key={snap.id}
                                    onClick={() => loadSnapshot(snap)}
                                    className="w-full text-left p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 border border-slate-700 hover:border-forge-accent group transition-all"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-forge-accent">{snap.timestamp}</span>
                                        <RotateCcw className="w-3 h-3 text-slate-600 group-hover:text-forge-accent" />
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex gap-2">
                                        <span>{snap.integrations.length} Active Services</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
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
               {/* Milestones */}
               {[
                 { pct: 10, label: 'File Sys' },
                 { pct: 25, label: 'Registry' },
                 { pct: 40, label: 'Network' },
                 { pct: 60, label: 'Deps' }
               ].map((m) => (
                 <div key={m.pct} className="absolute top-0 h-full w-px" style={{ left: `${m.pct}%` }}>
                    {/* Tick */}
                    <div className={`w-0.5 h-full absolute ${scanProgress >= m.pct ? 'bg-forge-accent' : 'bg-slate-600'} transition-colors`} />
                    {/* Label */}
                    <div className={`absolute top-5 left-1/2 -translate-x-1/2 text-[10px] uppercase font-mono tracking-tight whitespace-nowrap transition-colors duration-300 ${scanProgress >= m.pct ? 'text-forge-accent' : 'text-slate-600'}`}>
                        {m.label}
                    </div>
                 </div>
               ))}

               {/* Fill */}
               <div 
                 className="absolute top-0 left-0 h-full bg-forge-accent shadow-[0_0_15px_#38bdf8] transition-all duration-100 ease-linear rounded-full opacity-80"
                 style={{ width: `${scanProgress}%` }}
               />
            </div>
          </div>
      )}

      {/* Integration Grid */}
      {integrations.length > 0 && (
          <div className="mb-8">
             <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4" /> ACTIVE BRIDGES
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 {integrations.map((app) => (
                     <div key={app.id} className="bg-forge-panel border border-slate-700 p-4 rounded-xl flex flex-col gap-2 hover:border-forge-accent transition-colors group">
                         <div className="flex justify-between items-start">
                             <div className={`p-2 rounded-lg ${
                                 app.category === 'AI' ? 'bg-purple-500/20 text-purple-400' :
                                 app.category === 'Modding' ? 'bg-orange-500/20 text-orange-400' :
                                 'bg-blue-500/20 text-blue-400'
                             }`}>
                                 {app.category === 'AI' ? <Database className="w-4 h-4" /> : 
                                  app.category === 'Modding' ? <Layers className="w-4 h-4" /> : 
                                  <Terminal className="w-4 h-4" />}
                             </div>
                             <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                 Linked
                             </div>
                         </div>
                         <div>
                             <div className="font-bold text-slate-200">{app.name}</div>
                             <div className="text-xs text-slate-500 font-mono truncate" title={app.path}>{app.path}</div>
                         </div>
                         
                         {/* NifSkope Specific Actions */}
                         {app.name.includes('NifSkope') && (
                           <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase text-slate-500 font-bold">Bridge Status</span>
                                    <span className={`text-[10px] px-1.5 rounded ${nifProcess.status === 'running' ? 'text-emerald-400 bg-emerald-900/30' : nifProcess.status === 'terminated' ? 'text-red-400 bg-red-900/30' : 'text-slate-400 bg-slate-800'}`}>
                                        {nifProcess.status === 'running' ? `ACTIVE (${nifProcess.pid})` : nifProcess.status === 'terminated' ? 'TERMINATED' : 'IDLE'}
                                    </span>
                                </div>
                                
                                {/* Validation Toggles */}
                                <div className="my-3 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                  <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Validation Rules</div>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-2 cursor-pointer hover:text-slate-200 text-xs text-slate-400">
                                      <input 
                                        type="checkbox" 
                                        checked={validationOptions.shaderFlags}
                                        onChange={(e) => setValidationOptions(prev => ({...prev, shaderFlags: e.target.checked}))}
                                        className="rounded border-slate-600 bg-slate-800 text-forge-accent focus:ring-0 w-3 h-3"
                                      />
                                      Check Shader Flags
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer hover:text-slate-200 text-xs text-slate-400">
                                      <input 
                                        type="checkbox" 
                                        checked={validationOptions.collisionLayers}
                                        onChange={(e) => setValidationOptions(prev => ({...prev, collisionLayers: e.target.checked}))}
                                        className="rounded border-slate-600 bg-slate-800 text-forge-accent focus:ring-0 w-3 h-3"
                                      />
                                      Verify Collision Layers
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer hover:text-slate-200 text-xs text-slate-400">
                                      <input 
                                        type="checkbox" 
                                        checked={validationOptions.nodeHierarchy}
                                        onChange={(e) => setValidationOptions(prev => ({...prev, nodeHierarchy: e.target.checked}))}
                                        className="rounded border-slate-600 bg-slate-800 text-forge-accent focus:ring-0 w-3 h-3"
                                      />
                                      Analyze Node Hierarchy
                                    </label>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                    <button 
                                        onClick={() => {
                                            addLog("[SYSTEM] Opening local file interface...", 'info');
                                            nifInputRef.current?.click();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-forge-accent text-xs font-bold py-2 rounded border border-slate-600 transition-colors group-hover:bg-slate-700"
                                    >
                                        <FileCode className="w-3 h-3" />
                                        {nifProcess.status === 'running' ? 'Load New .NIF' : 'Link .NIF File'}
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={handleCheckStatusNif}
                                            className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-blue-900/30 text-slate-300 text-[10px] font-bold py-1.5 rounded border border-slate-600 transition-colors"
                                            title="Check process status"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Status
                                        </button>
                                        <button
                                            onClick={handleTerminateNif}
                                            disabled={nifProcess.status !== 'running'}
                                            className={`flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded border border-slate-600 transition-colors ${
                                                nifProcess.status === 'running' 
                                                ? 'bg-slate-800 hover:bg-red-900/30 text-red-400 cursor-pointer' 
                                                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                            }`}
                                            title="Terminate Process"
                                        >
                                            <XCircle className="w-3 h-3" />
                                            Terminate
                                        </button>
                                    </div>
                                </div>
                           </div>
                         )}
                     </div>
                 ))}
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* CPU/GPU Load */}
        <div className={`bg-forge-panel p-4 rounded-xl border shadow-lg h-64 transition-all duration-300 ${flashState.cpu ? 'animate-pulse border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'border-slate-700'}`}>
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
        <div className={`bg-forge-panel p-4 rounded-xl border shadow-lg h-64 transition-all duration-300 ${flashState.memory ? 'animate-pulse border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'border-slate-700'}`}>
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
              <div className="flex gap-1">
                 <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
              </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={loadArchivedLogs}
                    className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-white/5 border border-transparent hover:border-slate-800"
                    title="Load previous session logs"
                >
                    <Archive className="w-3 h-3" /> Load Archives
                </button>
                <button 
                    onClick={handleClearLogs}
                    className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-white/5 border border-transparent hover:border-slate-800"
                    title="Clear Logs"
                >
                    <Trash2 className="w-3 h-3" /> Clear
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar" ref={logsContainerRef}>
          {logs.length === 0 && (
             <div className="text-slate-600 italic text-xs text-center mt-12 flex flex-col items-center gap-2 opacity-50">
                 <History className="w-6 h-6" />
                 Logs cleared. Monitoring active services...
             </div>
          )}
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