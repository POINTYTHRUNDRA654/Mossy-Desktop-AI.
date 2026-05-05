import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Activity, Monitor, Hammer, GitBranch, SquareTerminal, BrainCircuit, Aperture, LayoutDashboard, Workflow, Hexagon, DraftingCompass, Triangle, Bug, Package, Library, Feather, Power, Volume2, VolumeX, HardDrive, Container, Wifi, WifiOff, ListTodo, Gamepad2, Code2, Scan, Trophy, PackageSearch, ListOrdered, Map, Layers, Mic, Box, Sparkles, PackageOpen, AlertTriangle, Archive, FileCode2, PackagePlus } from 'lucide-react';
import { useLive } from './LiveContext';
import AvatarCore from './AvatarCore';
import ApiKeySetup from './ApiKeySetup';
import { getProvider } from '../utils/apiKey';

const Sidebar: React.FC = () => {
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const location = useLocation();
  const [moodColor, setMoodColor] = useState('text-emerald-400');
  
  // Consume Global Live Context
  const { isActive, isMuted, toggleMute, disconnect } = useLive();

  // Read auto-launch setting from Electron (if running as a desktop app)
  useEffect(() => {
    const eb = window.electronBridge;
    if (eb?.getAutoLaunch) {
      eb.getAutoLaunch().then((val: boolean) => setAutoLaunchState(val)).catch(() => {});
    }
  }, []);

  const toggleAutoLaunch = () => {
    const eb = window.electronBridge;
    if (!eb?.setAutoLaunch) return;
    const next = !autoLaunch;
    setAutoLaunchState(next);
    eb.setAutoLaunch(next).catch(() => setAutoLaunchState(!next));
  };

  // Poll for bridge status check
  useEffect(() => {
    const checkBridge = () => {
        const isConnected = localStorage.getItem('mossy_bridge_active') === 'true';
        setBridgeConnected(isConnected);
    };
    checkBridge();
    window.addEventListener('storage', checkBridge);
    window.addEventListener('mossy-bridge-connected', checkBridge);
    
    // Fallback poll
    const interval = setInterval(checkBridge, 2000); 
    return () => {
        clearInterval(interval);
        window.removeEventListener('storage', checkBridge);
        window.removeEventListener('mossy-bridge-connected', checkBridge);
    };
  }, []);

  // Context-Aware Mood System
  useEffect(() => {
      const path = location.pathname;
      if (path.includes('crucible') || path.includes('terminal')) {
          setMoodColor('text-red-400');
      } else if (path.includes('prism') || path.includes('hive')) {
          setMoodColor('text-purple-400');
      } else if (path.includes('blueprint') || path.includes('cortex')) {
          setMoodColor('text-blue-400');
      } else if (path.includes('workshop') || path.includes('assembler') || path.includes('scribe')) {
          setMoodColor('text-amber-400');
      } else {
          setMoodColor('text-emerald-400');
      }
  }, [location]);

  const navItems = [
    // ── Core ──────────────────────────────────────────────────────────────
    { to: '/',            icon: LayoutDashboard, label: 'The Nexus',       group: 'Core' },
    { to: '/chat',        icon: MessageSquare,   label: 'Talk to Mossy',   group: 'Core' },
    { to: '/monitor',     icon: Activity,        label: 'System Map',      group: 'Core' },
    { to: '/terminal',    icon: SquareTerminal,  label: 'HyperTerminal',   group: 'Core' },
    { to: '/bridge',      icon: Monitor,         label: 'Desktop Bridge',  group: 'Core' },
    { to: '/workshop',    icon: Hammer,          label: 'The Workshop',    group: 'Core' },

    // ── Intelligence ──────────────────────────────────────────────────────
    { to: '/cortex',      icon: BrainCircuit,    label: 'The Cortex',      group: 'Intelligence' },
    { to: '/planner',     icon: ListTodo,        label: 'The Planner',     group: 'Intelligence' },
    { to: '/lens',        icon: Aperture,        label: 'The Lens',        group: 'Intelligence' },
    { to: '/prism',       icon: Triangle,        label: 'The Prism',       group: 'Intelligence' },
    { to: '/hive',        icon: Hexagon,         label: 'The Hive',        group: 'Intelligence' },

    // ── Build & Craft ─────────────────────────────────────────────────────
    { to: '/blueprint',   icon: DraftingCompass, label: 'The Blueprint',   group: 'Build' },
    { to: '/assembler',   icon: Package,         label: 'The Assembler',   group: 'Build' },
    { to: '/crucible',    icon: Bug,             label: 'The Crucible',    group: 'Build' },

    // ── Data & Memory ─────────────────────────────────────────────────────
    { to: '/vault',       icon: Container,       label: 'The Vault',       group: 'Data' },
    { to: '/organizer',   icon: Library,         label: 'The Organizer',   group: 'Data' },
    { to: '/scribe',      icon: Feather,         label: 'The Scribe',      group: 'Data' },

    // ── Orchestration ─────────────────────────────────────────────────────
    { to: '/orchestrator', icon: GitBranch,      label: 'The Orchestrator', group: 'Orchestration' },

    // ── Gamer Tools ───────────────────────────────────────────────────────────
    { to: '/gamer-hub',    icon: Gamepad2,        label: 'Gamer Hub',       group: 'Gamer' },
    { to: '/game-scripts', icon: Code2,           label: 'Script Forge',    group: 'Gamer' },
    { to: '/game-vision',  icon: Scan,            label: 'Game Vision',     group: 'Gamer' },
    { to: '/steam',        icon: Trophy,          label: 'Steam Library',   group: 'Gamer' },
    { to: '/mod-browser',  icon: PackageSearch,   label: 'Mod Browser',     group: 'Gamer' },
    { to: '/load-order',   icon: ListOrdered,     label: 'Load Order',      group: 'Gamer' },
    { to: '/blender-forge', icon: Box,            label: 'Blender Forge',   group: 'Gamer' },
    { to: '/godot-forge',  icon: Triangle,        label: 'Godot Forge',     group: 'Gamer' },
    { to: '/map-forge',    icon: Map,             label: 'Map Forge',       group: 'Gamer' },
    { to: '/asset-forge',  icon: Layers,          label: '3D Asset Forge',  group: 'Gamer' },
    { to: '/voice-forge',        icon: Mic,         label: 'Voice Forge',     group: 'Gamer' },
    { to: '/texture-upscaler',   icon: Sparkles,    label: 'Texture Upscaler',group: 'Gamer' },
    { to: '/wolvenkit',          icon: PackageOpen, label: 'WolvenKit',       group: 'Gamer' },
    // ── Fallout 4 Modding Tools ──────────────────────────────────────────
    { to: '/fo4edit',      icon: AlertTriangle, label: 'FO4 Conflicts',    group: 'Gamer' },
    { to: '/ba2',          icon: Archive,       label: 'BA2 Browser',      group: 'Gamer' },
    { to: '/papyrus',      icon: FileCode2,     label: 'Papyrus IDE',      group: 'Gamer' },
    { to: '/fomod',        icon: PackagePlus,   label: 'FOMOD Builder',    group: 'Gamer' },
    { to: '/cell-editor',  icon: Layers,        label: 'Cell Editor',      group: 'Gamer' },
  ];

  const groups = ['Core', 'Intelligence', 'Build', 'Data', 'Orchestration', 'Gamer'] as const;


  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full relative z-50 transition-colors duration-500">
      {/* Live Header with Persistent Avatar */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="relative w-12 h-12 flex-shrink-0">
            {/* Replaced static CSS core with the unified AvatarCore */}
            <AvatarCore className="w-12 h-12" showRings={false} />
            
            {/* Online Status Dot */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full transition-colors duration-500 z-20 ${bridgeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
        </div>
        
        <div className="overflow-hidden flex-1">
          <h1 className="text-xl font-bold text-white tracking-tighter leading-none">
            MOSSY<span className={`transition-colors duration-500 ${moodColor}`}>.AI</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
             {bridgeConnected ? (
                 <>
                    <Wifi className={`w-3 h-3 transition-colors duration-500 ${moodColor}`} />
                    <span className={`text-[10px] font-bold tracking-wider transition-colors duration-500 ${moodColor}`}>LINKED</span>
                 </>
             ) : (
                 <>
                    <WifiOff className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] text-slate-600 font-bold tracking-wider">WEB MODE</span>
                 </>
             )}
          </div>
        </div>
      </div>

      {/* Global Live Status */}
      {isActive && (
          <div className="px-4 py-2 bg-red-900/10 border-b border-red-500/20 flex justify-between items-center animate-fade-in">
              <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                      {isMuted ? 'Live Muted' : 'Live Voice Active'}
                  </span>
              </div>
              <div className="flex gap-1">
                  <button 
                      onClick={toggleMute}
                      className={`p-1 rounded-full transition-colors ${isMuted ? 'text-slate-400 hover:text-white' : 'text-red-400 hover:bg-red-500/20'}`}
                      title={isMuted ? "Unmute Live Voice" : "Mute Live Voice"}
                  >
                      {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  <button 
                      onClick={disconnect}
                      className="p-1 hover:bg-red-500/20 rounded-full text-red-400 transition-colors"
                      title="Disconnect Voice"
                  >
                      <Power className="w-3 h-3" />
                  </button>
              </div>
          </div>
      )}

      <nav className="flex-1 p-3 overflow-y-auto custom-scrollbar">
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} className="mb-3">
              <div className="px-3 py-1 text-[9px] font-bold tracking-widest text-slate-600 uppercase">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-xs font-medium group ${
                        isActive
                          ? `bg-slate-800 ${moodColor} font-bold border border-slate-700 shadow-md`
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-3.5 h-3.5 transition-transform group-hover:scale-110 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      
      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] text-slate-600 font-mono">MOSSY BRAIN v3.0</div>
          <div className={`text-[9px] font-bold tracking-widest uppercase ${moodColor}`}>
            {getProvider() === 'gemma4' ? '⚡ LOCAL GPU' : getProvider() === 'ollama' ? '🖥 LOCAL' : '☁ CLOUD'}
          </div>
        </div>
        {/* AI Provider indicator + change button */}
        <button
          onClick={() => setShowKeySetup(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-emerald-500/40 transition-colors group"
          title="Change AI provider / model"
        >
          <HardDrive className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors truncate">
            {getProvider() === 'gemma4' ? 'Gemma 4 · NVIDIA' : getProvider() === 'ollama' ? 'Ollama · Local' : 'Gemini · Cloud'}
          </span>
        </button>

        {/* Auto-launch toggle — only shown when running in Electron */}
        {window.electronBridge?.isElectron && (
          <button
            onClick={toggleAutoLaunch}
            className={`mt-1.5 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors group ${
              autoLaunch
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-500 hover:text-slate-300'
            }`}
            title="Toggle run at system startup"
          >
            <Power className="w-3 h-3 shrink-0" />
            <span className="text-[10px] truncate">
              {autoLaunch ? 'Starts at login ✓' : 'Run at startup'}
            </span>
          </button>
        )}
      </div>

      {/* Provider setup overlay (triggered from footer) */}
      {showKeySetup && (
        <ApiKeySetup onConfigured={() => setShowKeySetup(false)} />
      )}
    </div>
  );
};

export default Sidebar;