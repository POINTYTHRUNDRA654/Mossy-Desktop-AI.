import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Radio, Image, Mic2, Activity, Heart, Leaf, Monitor, Wifi, WifiOff, Hammer, GitBranch, Network, Gamepad2, Container, SquareTerminal, BrainCircuit, Aperture, LayoutDashboard, Satellite, Workflow, Hexagon, DraftingCompass, Dna, Sparkles, Flame, Binary, Triangle, PenTool, FlaskConical, Map, FileDigit, Library, Bug, Package } from 'lucide-react';

const Sidebar: React.FC = () => {
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const location = useLocation();
  const [moodColor, setMoodColor] = useState('text-emerald-400');
  const [glowColor, setGlowColor] = useState('border-emerald-500/30');
  const [shadowColor, setShadowColor] = useState('shadow-[0_0_15px_rgba(16,185,129,0.2)]');

  // Poll for bridge status check
  useEffect(() => {
    const checkBridge = () => {
        const isConnected = localStorage.getItem('mossy_bridge_active') === 'true';
        setBridgeConnected(isConnected);
    };
    checkBridge();
    const interval = setInterval(checkBridge, 2000); // Check every 2s
    return () => clearInterval(interval);
  }, []);

  // Context-Aware Mood System
  useEffect(() => {
      const path = location.pathname;
      if (path.includes('crucible') || path.includes('terminal')) {
          setMoodColor('text-red-400');
          setGlowColor('border-red-500/50');
          setShadowColor('shadow-[0_0_15px_rgba(248,113,113,0.3)]');
      } else if (path.includes('reverie') || path.includes('prism') || path.includes('anima')) {
          setMoodColor('text-purple-400');
          setGlowColor('border-purple-500/50');
          setShadowColor('shadow-[0_0_15px_rgba(168,85,247,0.3)]');
      } else if (path.includes('splicer') || path.includes('blueprint') || path.includes('fabric')) {
          setMoodColor('text-blue-400');
          setGlowColor('border-blue-500/50');
          setShadowColor('shadow-[0_0_15px_rgba(96,165,250,0.3)]');
      } else if (path.includes('workshop') || path.includes('assembler')) {
          setMoodColor('text-amber-400');
          setGlowColor('border-amber-500/50');
          setShadowColor('shadow-[0_0_15px_rgba(251,191,36,0.3)]');
      } else {
          setMoodColor('text-emerald-400');
          setGlowColor('border-emerald-500/30');
          setShadowColor('shadow-[0_0_15px_rgba(16,185,129,0.2)]');
      }
  }, [location]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'The Nexus' },
    { to: '/chat', icon: MessageSquare, label: 'Talk to Mossy' },
    { to: '/organizer', icon: Library, label: 'The Organizer' },
    { to: '/assembler', icon: Package, label: 'The Assembler' },
    { to: '/crucible', icon: Bug, label: 'The Crucible' },
    { to: '/catalyst', icon: FlaskConical, label: 'The Catalyst' },
    { to: '/fabric', icon: PenTool, label: 'The Fabric' },
    { to: '/prism', icon: Triangle, label: 'The Prism' },
    { to: '/anima', icon: Flame, label: 'The Anima' },
    { to: '/reverie', icon: Sparkles, label: 'The Reverie' },
    { to: '/genome', icon: Dna, label: 'The Genome' },
    { to: '/hive', icon: Hexagon, label: 'The Hive' },
    { to: '/cartographer', icon: Map, label: 'The Cartographer' },
    { to: '/registry', icon: FileDigit, label: 'The Registry' },
    { to: '/blueprint', icon: DraftingCompass, label: 'The Blueprint' },
    { to: '/synapse', icon: Workflow, label: 'The Synapse' },
    { to: '/splicer', icon: Binary, label: 'The Splicer' },
    { to: '/lens', icon: Aperture, label: 'The Lens' },
    { to: '/conduit', icon: Satellite, label: 'The Conduit' },
    { to: '/cortex', icon: BrainCircuit, label: 'The Cortex' },
    { to: '/terminal', icon: SquareTerminal, label: 'HyperTerminal' },
    { to: '/holo', icon: Gamepad2, label: 'The Holodeck' },
    { to: '/orchestrator', icon: GitBranch, label: 'The Orchestrator' },
    { to: '/vault', icon: Container, label: 'The Vault' },
    { to: '/lore', icon: Network, label: 'The Lorekeeper' },
    { to: '/workshop', icon: Hammer, label: 'The Workshop' },
    { to: '/images', icon: Image, label: 'Image Studio' },
    { to: '/tts', icon: Mic2, label: 'Audio Studio' },
    { to: '/monitor', icon: Activity, label: 'System Map' },
    { to: '/live', icon: Radio, label: 'Live Voice' },
    { to: '/bridge', icon: Monitor, label: 'Desktop Bridge' },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full relative z-50 transition-colors duration-500">
      {/* Live Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="relative w-12 h-12">
            {/* Holographic Container - Dynamic */}
            <div className={`absolute inset-0 rounded-full border-2 overflow-hidden bg-black transition-all duration-500 ${glowColor} ${shadowColor}`}>
                <img 
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
                    className="w-full h-full object-cover opacity-80 animate-pulse-slow transition-all duration-500"
                    style={{ filter: `contrast(1.2) hue-rotate(${moodColor.includes('red') ? '140deg' : moodColor.includes('purple') ? '240deg' : moodColor.includes('blue') ? '180deg' : '20deg'})` }}
                    alt="Mossy AI"
                />
                {/* Scanline overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-50 pointer-events-none"></div>
            </div>
            {/* Online Dot */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full animate-pulse transition-colors duration-500 ${moodColor.replace('text-', 'bg-').replace('-400', '-500')}`}></div>
        </div>
        
        <div>
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

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-xs font-medium group ${
                isActive 
                  ? `bg-slate-800 ${moodColor} font-bold border border-slate-700 shadow-md` 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className={`w-4 h-4 transition-transform group-hover:scale-110`} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="text-[10px] text-slate-600 text-center font-mono flex justify-center items-center gap-2">
          <span>v2.5.0-RC1</span>
          <span className={`w-1 h-1 rounded-full ${moodColor.replace('text-', 'bg-').replace('-400', '-600')}`}></span>
          <span>CORE: ACTIVE</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;