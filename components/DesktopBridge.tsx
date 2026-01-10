import React, { useState, useEffect, useRef } from 'react';
import { Monitor, CheckCircle2, Wifi, Shield, Cpu, Terminal, Power, Layers, Box, Code, Image as ImageIcon, MessageSquare, Activity, RefreshCw, Lock, AlertOctagon, Link, Zap, Eye, Globe, Database, Wrench, FolderOpen, HardDrive, ArrowRightLeft, ArrowRight, Keyboard, Download, Server, Clipboard } from 'lucide-react';

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

// Initial drivers
const initialDrivers: Driver[] = [
    { id: 'os_shell', name: 'Windows Shell', icon: Terminal, status: 'inactive', version: '10.0.19045', latency: 0, permissions: ['fs.read', 'fs.write', 'exec'] },
    { id: 'fs_watcher', name: 'File System Watcher', icon: Eye, status: 'inactive', version: '2.1.0', latency: 0, permissions: ['fs.watch', 'read.recursive'] },
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
                  return s ? { ...d, status: s.status } : d;
              });
          }
      } catch {}
      return initialDrivers;
  });

  // Load initial logs from storage
  const [logs, setLogs] = useState<LogEntry[]>(() => {
      try {
          const saved = localStorage.getItem('mossy_bridge_logs');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  const logEndRef = useRef<HTMLDivElement>(null);
  
  // New Add-on State
  const [serverActive, setServerActive] = useState(false);
  const [blenderConnected, setBlenderConnected] = useState(false);
  const [port, setPort] = useState(21337);
  const blenderCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Visualizer State
  const [cubeRotationSpeed, setCubeRotationSpeed] = useState(0.02);
  const [cubeScale, setCubeScale] = useState(1);
  const [lastCommand, setLastCommand] = useState<string>('');

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Sync logs from storage (updated by SystemBus)
  useEffect(() => {
      const syncLogs = () => {
          try {
              const saved = localStorage.getItem('mossy_bridge_logs');
              if (saved) {
                  const parsed = JSON.parse(saved);
                  setLogs(parsed);
                  
                  // Check for Blender commands to update visualizer
                  const lastLog = parsed[parsed.length - 1];
                  if (lastLog && lastLog.source === 'Blender' && lastLog.status === 'warn') {
                      const cmd = lastLog.event.toLowerCase();
                      setLastCommand(lastLog.event);
                      
                      if (cmd.includes('rotate') || cmd.includes('spin')) {
                          setCubeRotationSpeed(0.2);
                          setTimeout(() => setCubeRotationSpeed(0.02), 2000);
                      } else if (cmd.includes('scale') || cmd.includes('resize')) {
                          setCubeScale(1.5);
                          setTimeout(() => setCubeScale(1), 500);
                      } else if (cmd.includes('cube') || cmd.includes('add')) {
                          setCubeScale(0.1);
                          setTimeout(() => setCubeScale(1), 300);
                      }
                  }
              }
          } catch {}
      };
      
      window.addEventListener('storage', syncLogs);
      const interval = setInterval(syncLogs, 1000);
      
      return () => {
          window.removeEventListener('storage', syncLogs);
          clearInterval(interval);
      };
  }, []);

  // Persist drivers
  useEffect(() => {
      localStorage.setItem('mossy_bridge_drivers', JSON.stringify(drivers.map(d => ({ id: d.id, status: d.status }))));
      const anyActive = drivers.some(d => d.status === 'active') || blenderConnected;
      localStorage.setItem('mossy_bridge_active', anyActive.toString());
      window.dispatchEvent(new Event('mossy-bridge-connected'));
      window.dispatchEvent(new Event('mossy-driver-update'));
  }, [drivers, blenderConnected]);

  // --- BLENDER ADD-ON LOGIC (CLIPBOARD RELAY) ---
  const handleDownloadAddon = () => {
      const addonCode = `
bl_info = {
    "name": "Mossy Link",
    "author": "OmniForge",
    "version": (4, 0, 0),
    "blender": (3, 4, 0),
    "location": "View3D > Sidebar > Mossy",
    "description": "Clipboard Relay v4.0: Bulletproof 'MOSSY_CUBE' token support and enhanced error reporting.",
    "warning": "",
    "wiki_url": "",
    "category": "System",
}

import bpy
import bmesh

# --- Helpers ---
def get_3d_view_override(context):
    """Finds a 3D View area to run operators in."""
    for window in context.window_manager.windows:
        screen = window.screen
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                for region in area.regions:
                    if region.type == 'WINDOW':
                        return {'window': window, 'screen': screen, 'area': area, 'region': region, 'scene': context.scene}
    return None

def create_cube_data_api():
    """Creates a cube using low-level Data API. Works without context."""
    mesh = bpy.data.meshes.new('MossyCube')
    obj = bpy.data.objects.new('MossyCube', mesh)
    
    # Link to collection
    if bpy.context.collection:
        bpy.context.collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
        
    # Create Geometry
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bm.to_mesh(mesh)
    bm.free()
    
    print("Mossy: Created Cube via Data API")

# --- Global State ---
class MossyState:
    last_clipboard = ""
    last_command_display = "Waiting..."
    queued_command = ""

# --- Deferred Execution ---
def execute_queued_command():
    """Runs the command on the main thread."""
    cmd = MossyState.queued_command
    if not cmd:
        return None # Unregister timer
    
    MossyState.queued_command = ""
    
    try:
        print(f"Mossy: Executing: {cmd[:50]}...")
        
        # --- V4.0 FEATURE: BYPASS EXEC FOR COMMON COMMANDS ---
        if "MOSSY_CUBE" in cmd:
            create_cube_data_api()
            # Force Redraw
            try:
                bpy.context.view_layer.update()
            except:
                pass
            return None # Stop here, no exec needed
            
        # Standard Exec Path
        # Inject our helper so scripts can use it
        exec_globals = globals().copy()
        exec_globals['create_cube_data_api'] = create_cube_data_api
        
        # Try override first
        override = get_3d_view_override(bpy.context)
        if override:
            with bpy.context.temp_override(**override):
                exec(cmd, exec_globals)
        else:
            exec(cmd, exec_globals)
            
        # Force Redraw
        try:
            bpy.context.view_layer.update()
        except:
            pass
            
        # Force Redraw UI
        for wm in bpy.data.window_managers:
            for win in wm.windows:
                for area in win.screen.areas:
                    area.tag_redraw()
                    
    except Exception as e:
        print(f"Mossy Error: {e}")
        MossyState.last_command_display = f"Error: {str(e)[:30]}"
        # Log to Info Panel
        def draw_error(self, context):
            self.layout.label(text=f"Mossy Error: {str(e)}")
        bpy.context.window_manager.popup_menu(draw_error, title="Script Failed", icon='ERROR')
        
    return None

# --- Operator: Listener ---
class MOSSY_OT_Connect(bpy.types.Operator):
    """Start Clipboard Listener"""
    bl_idname = "mossy.connect"
    bl_label = "Start Listener"
    
    _timer = None

    def modal(self, context, event):
        if event.type == 'TIMER':
            try:
                clipboard = context.window_manager.clipboard
                if clipboard != MossyState.last_clipboard:
                    MossyState.last_clipboard = clipboard
                    if clipboard.startswith("MOSSY_CMD:"):
                        cmd = clipboard[10:]
                        # Remove nonce if present (marked by # ID:)
                        if "# ID:" in cmd:
                            cmd = cmd.split("# ID:")[0]
                            
                        MossyState.last_command_display = cmd[:30] + "..."
                        self.report({'INFO'}, f"Mossy Recv: {cmd[:20]}...")
                        MossyState.queued_command = cmd
                        bpy.app.timers.register(execute_queued_command)
            except Exception:
                pass
        return {'PASS_THROUGH'}

    def execute(self, context):
        self.report({'INFO'}, "Mossy: Listening...")
        wm = context.window_manager
        self._timer = wm.event_timer_add(0.5, window=context.window)
        wm.modal_handler_add(self)
        return {'RUNNING_MODAL'}

    def cancel(self, context):
        wm = context.window_manager
        wm.event_timer_remove(self._timer)

# --- Operator: Force Cube ---
class MOSSY_OT_ForceCube(bpy.types.Operator):
    """Adds a cube using Data API (No Context Needed)"""
    bl_idname = "mossy.force_cube"
    bl_label = "Force Cube (Data API)"

    def execute(self, context):
        create_cube_data_api()
        # Ensure it appears
        bpy.context.view_layer.update()
        return {'FINISHED'}

# --- Operator: Paste & Run ---
class MOSSY_OT_PasteRun(bpy.types.Operator):
    """Run clipboard content manually"""
    bl_idname = "mossy.paste_run"
    bl_label = "Paste & Run"

    def execute(self, context):
        clipboard = context.window_manager.clipboard
        cmd = clipboard.replace("MOSSY_CMD:", "")
        # Remove nonce
        if "# ID:" in cmd:
            cmd = cmd.split("# ID:")[0]
            
        MossyState.queued_command = cmd
        bpy.app.timers.register(execute_queued_command)
        return {'FINISHED'}

# --- Panel ---
class MOSSY_PT_MainPanel(bpy.types.Panel):
    bl_label = "Mossy Bridge v4.0"
    bl_idname = "MOSSY_PT_MainPanel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Mossy'

    def draw(self, context):
        layout = self.layout
        layout.label(text="Status: Active")
        box = layout.box()
        box.label(text="Last Recv:")
        box.label(text=MossyState.last_command_display)
        
        layout.separator()
        layout.operator("mossy.connect", icon='URL')
        
        layout.separator()
        layout.label(text="Debug Tools:")
        layout.operator("mossy.paste_run", icon='PASTEDOWN')
        layout.operator("mossy.force_cube", icon='MESH_CUBE')

# --- Registration ---
classes = (
    MOSSY_OT_Connect,
    MOSSY_OT_PasteRun,
    MOSSY_OT_ForceCube,
    MOSSY_PT_MainPanel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    print("Mossy Link: Registered Successfully")

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    print("Mossy Link: Unregistered")

if __name__ == "__main__":
    register()
      `;
      
      const blob = new Blob([addonCode], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mossy_link.py'; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addLog('System', 'Generated mossy_link.py (v4.0)', 'success');
  };

  const toggleServer = () => {
      if (serverActive) {
          setServerActive(false);
          setBlenderConnected(false);
          localStorage.removeItem('mossy_blender_active');
          addLog('Server', 'Relay stopped.', 'warn');
      } else {
          setServerActive(true);
          addLog('Server', `Clipboard Relay initialized.`, 'ok');
          
          // Simulate Handshake
          setTimeout(() => {
              setBlenderConnected(true);
              localStorage.setItem('mossy_blender_active', 'true');
              addLog('Blender', 'Ready to transmit via Clipboard.', 'success');
              window.dispatchEvent(new Event('mossy-bridge-connected'));
          }, 1000);
      }
  };

  const addLog = (source: string, event: string, status: 'ok' | 'warn' | 'err' | 'success' = 'ok') => {
      const newLog = {
          id: Date.now().toString() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          source,
          event,
          status
      };
      
      setLogs(prev => {
          const next = [...prev.slice(-19), newLog];
          localStorage.setItem('mossy_bridge_logs', JSON.stringify(next));
          return next;
      });
  };

  const toggleDriver = (id: string) => {
      setDrivers(prev => prev.map(d => {
          if (d.id !== id) return d;
          return { ...d, status: d.status === 'active' ? 'inactive' : 'active' };
      }));
  };

  // --- BLENDER VISUALIZER ---
  useEffect(() => {
      if (!blenderConnected || !blenderCanvasRef.current) return;
      const canvas = blenderCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frameId: number;
      let rotation = 0;
      let currentScale = 1;

      const render = () => {
          rotation += cubeRotationSpeed;
          
          // Smooth scale transition
          currentScale = currentScale + (cubeScale - currentScale) * 0.1;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const size = 30 * currentScale;

          const vertices = [
              {x: -1, y: -1, z: -1}, {x: 1, y: -1, z: -1}, {x: 1, y: 1, z: -1}, {x: -1, y: 1, z: -1},
              {x: -1, y: -1, z: 1}, {x: 1, y: -1, z: 1}, {x: 1, y: 1, z: 1}, {x: -1, y: 1, z: 1}
          ];

          const projected = vertices.map(v => {
              let x = v.x * Math.cos(rotation) - v.z * Math.sin(rotation);
              let z = v.x * Math.sin(rotation) + v.z * Math.cos(rotation);
              let y = v.y * Math.cos(rotation * 0.5) - z * Math.sin(rotation * 0.5);
              z = v.y * Math.sin(rotation * 0.5) + z * Math.cos(rotation * 0.5);
              const scale = 100 / (100 + z * 30);
              return { x: cx + x * size * scale, y: cy + y * size * scale };
          });

          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          const edges = [
              [0,1], [1,2], [2,3], [3,0],
              [4,5], [5,6], [6,7], [7,4],
              [0,4], [1,5], [2,6], [3,7]
          ];

          edges.forEach(([i, j]) => {
              ctx.moveTo(projected[i].x, projected[i].y);
              ctx.lineTo(projected[j].x, projected[j].y);
          });
          ctx.stroke();

          frameId = requestAnimationFrame(render);
      };
      
      render();
      return () => cancelAnimationFrame(frameId);
  }, [blenderConnected, cubeRotationSpeed, cubeScale]);

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
                <div className="flex items-center gap-4 mt-2">
                    <p className="text-slate-400 font-mono text-sm">
                        Localhost Bridge Service v4.0.0 <span className="text-slate-600">|</span> Relay: Clipboard
                    </p>
                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        <div className={`w-2 h-2 rounded-full ${serverActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {serverActive ? 'RELAY ACTIVE' : 'RELAY STOPPED'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
            {/* Left Column: Driver Grid */}
            <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* BLENDER ADD-ON CARD */}
                <div className={`rounded-xl border p-6 relative overflow-hidden transition-all duration-500 ${
                    blenderConnected ? 'bg-orange-900/10 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.15)]' : 'bg-slate-900 border-slate-700'
                }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Box className={`w-32 h-32 ${blenderConnected ? 'text-orange-500 animate-spin-slow' : 'text-slate-600'}`} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Box className={`w-6 h-6 ${blenderConnected ? 'text-orange-400' : 'text-slate-400'}`} />
                                    Blender Integration
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">Requires external add-on installation.</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                blenderConnected 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                                : serverActive 
                                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 animate-pulse'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                                {blenderConnected ? 'LINKED' : serverActive ? 'WAITING...' : 'OFFLINE'}
                            </div>
                        </div>

                        {!blenderConnected ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-black/40 rounded-lg border border-slate-700/50 text-sm text-slate-300">
                                    <h4 className="font-bold text-white mb-2 flex items-center gap-2"><Clipboard className="w-4 h-4"/> Clipboard Relay Mode (v4.0)</h4>
                                    <ol className="list-decimal pl-4 space-y-2">
                                        <li>Download <strong>mossy_link.py</strong> (v4.0) below.</li>
                                        <li>In Blender, remove old version. Install new file.</li>
                                        <li>Enable the add-on.</li>
                                        <li>In 3D View Sidebar (Press 'N'), click <strong>"Start Listener"</strong>.</li>
                                        <li>If objects don't appear, ensure window is active.</li>
                                    </ol>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleDownloadAddon}
                                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> Download Add-on (v4.0)
                                    </button>
                                    <button 
                                        onClick={toggleServer}
                                        className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                            serverActive 
                                            ? 'bg-red-900/30 border border-red-500/50 text-red-400 hover:bg-red-900/50' 
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                                        }`}
                                    >
                                        <Server className="w-4 h-4" /> {serverActive ? 'Stop Relay' : 'Activate Relay'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-6 items-center">
                                <div className="flex-1">
                                    <div className="text-xs text-slate-500 font-mono mb-2">RELAY STREAM</div>
                                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-orange-300 h-24 overflow-hidden border border-orange-900/30">
                                        > Relay Active<br/>
                                        > Mode: Deferred Clipboard Polling<br/>
                                        > last_cmd: {lastCommand || "IDLE"}<br/>
                                        <span className="animate-pulse">_</span>
                                    </div>
                                </div>
                                <div className="w-32 h-32 bg-black rounded border border-slate-700 relative flex items-center justify-center">
                                    <div className="absolute top-1 left-1 text-[8px] text-slate-500">VISUALIZER</div>
                                    <canvas ref={blenderCanvasRef} width={128} height={128} className="w-full h-full" />
                                </div>
                            </div>
                        )}
                        
                        {blenderConnected && (
                            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-xs text-slate-500">Ready to transmit commands.</span>
                                <button onClick={toggleServer} className="text-xs text-red-400 hover:text-red-300 underline">Disconnect</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Other Drivers code remains the same */}
                <div className="flex justify-between items-center mb-2 mt-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Standard Drivers
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {drivers.map(driver => (
                        <div 
                            key={driver.id}
                            className={`relative overflow-hidden rounded-xl border transition-all p-4 group ${
                                driver.status === 'active' 
                                ? 'bg-slate-900 border-emerald-500/50' 
                                : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${driver.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                        <driver.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm">{driver.name}</div>
                                        <div className="text-[10px] text-slate-500">v{driver.version}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => toggleDriver(driver.id)}
                                    className={`p-1.5 rounded border transition-colors ${driver.status === 'active' ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-slate-700 hover:text-white'}`}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
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
                            <span>Clipboard Access Granted</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-black border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Event Log
                        </span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] text-emerald-500">LIVE</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">
                        {logs.length === 0 && (
                            <div className="text-slate-700 italic text-center mt-10">Awaiting traffic...</div>
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