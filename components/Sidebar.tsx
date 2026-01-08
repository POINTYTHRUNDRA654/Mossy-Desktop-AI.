import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Radio, Image, Mic2, Activity, Heart, Leaf, Monitor, Wifi, WifiOff, Hammer, GitBranch, Network, Gamepad2, Container, SquareTerminal, BrainCircuit, Aperture, LayoutDashboard, Satellite, Workflow, Hexagon, DraftingCompass, Dna, Sparkles, Flame, Binary, Triangle, PenTool, FlaskConical, Map, FileDigit, Library } from 'lucide-react';

const Sidebar: React.FC = () => {
  const [bridgeConnected, setBridgeConnected] = useState(false);

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

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'The Nexus' },
    { to: '/chat', icon: MessageSquare, label: 'Talk to Mossy' },
    { to: '/organizer', icon: Library, label: 'The Organizer' },
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
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 flex items-center gap-2">
        <Leaf className="w-6 h-6 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tighter">
            MOSSY<span className="text-emerald-400">.AI</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
             {bridgeConnected ? (
                 <span className="text-emerald-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> LINKED</span>
             ) : (
                 <span className="text-slate-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> WEB MODE</span>
             )}
          </p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      {/* Donation/Sponsor Section */}
      <div className="p-4 border-t border-slate-800">
        <button className="w-full mb-4 group relative px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 hover:border-pink-500/50 hover:from-pink-500/20 hover:to-rose-500/20 transition-all cursor-pointer">
            <Heart className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform group-hover:fill-pink-400/20" />
            <span className="text-sm font-semibold text-pink-300 group-hover:text-pink-200">Support Mossy</span>
        </button>
        <div className="text-xs text-slate-600 text-center">
          v2.4.0 | Workshop Enabled
        </div>
      </div>
    </div>
  );
};

export default Sidebar;