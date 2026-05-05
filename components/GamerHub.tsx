import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gamepad2, Code2, Monitor, PackageSearch, List, Box,
  Wind, Map, Mic, Layers3, ChevronRight, Cpu, Zap,
  Sparkles, PackageOpen,
} from 'lucide-react';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  status: 'ready' | 'requires-setup' | 'experimental';
  badge?: string;
}

const TOOLS: ToolCard[] = [
  {
    title: 'Script Forge',
    description: 'Generate Papyrus, GDScript, Lua, AutoHotkey & Unity C# scripts with DeepSeek Coder V2.',
    icon: Code2,
    path: '/game-scripts',
    status: 'ready',
    badge: 'AI',
  },
  {
    title: 'Steam Library',
    description: 'Browse your Steam game library, achievements, and playtime stats via the Web API.',
    icon: Gamepad2,
    path: '/steam',
    status: 'requires-setup',
    badge: 'API Key',
  },
  {
    title: 'Game Vision',
    description: 'Capture & analyse game screens with OpenCV — HUD detection, OCR, game state.',
    icon: Monitor,
    path: '/game-vision',
    status: 'experimental',
    badge: 'Port 8005',
  },
  {
    title: 'Mod Browser',
    description: 'Search Nexus Mods for Skyrim, FO4, Cyberpunk 2077, Baldur\'s Gate 3 & more.',
    icon: PackageSearch,
    path: '/mod-browser',
    status: 'requires-setup',
    badge: 'API Key',
  },
  {
    title: 'Load Order',
    description: 'Run LOOT, analyse plugin conflicts, and get AI-powered explanations from Mossy.',
    icon: List,
    path: '/load-order',
    status: 'requires-setup',
    badge: 'LOOT',
  },
  {
    title: 'Blender Forge',
    description: 'Generate bpy Python scripts for UV unwrapping, LODs, rigging, and more.',
    icon: Box,
    path: '/blender-forge',
    status: 'ready',
    badge: 'AI',
  },
  {
    title: 'Godot Forge',
    description: 'Generate GDScript 4.x files with player controllers, AI, save/load, and scenes.',
    icon: Wind,
    path: '/godot-forge',
    status: 'ready',
    badge: 'AI',
  },
  {
    title: 'Map Forge',
    description: 'Procedurally generate Tiled-compatible 2D maps: dungeons, towns, caves & more.',
    icon: Map,
    path: '/map-forge',
    status: 'ready',
    badge: 'Built-in',
  },
  {
    title: '3D Asset Forge',
    description: 'Generate 3D meshes from images using TripoSR — export OBJ/GLB for Blender.',
    icon: Layers3,
    path: '/asset-forge',
    status: 'experimental',
    badge: 'Port 8007',
  },
  {
    title: 'Voice Forge',
    description: 'Convert voices with RVC models and train custom voice models locally.',
    icon: Mic,
    path: '/voice-forge',
    status: 'experimental',
    badge: 'Port 8008',
  },
  {
    title: 'Texture Upscaler',
    description: 'Upscale game textures 2×–4× with Real-ESRGAN AI. Auto-downloads models from HuggingFace.',
    icon: Sparkles,
    path: '/texture-upscaler',
    status: 'experimental',
    badge: 'Real-ESRGAN',
  },
  {
    title: 'WolvenKit',
    description: 'Automate Cyberpunk 2077 & Witcher 3 modding — extract, pack, convert and search archives.',
    icon: PackageOpen,
    path: '/wolvenkit',
    status: 'requires-setup',
    badge: 'REDengine',
  },
];

const STATUS_STYLES = {
  ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'requires-setup': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  experimental: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const STATUS_DOT = {
  ready: 'bg-emerald-500',
  'requires-setup': 'bg-amber-500',
  experimental: 'bg-purple-500',
};

const GamerHub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Gamepad2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gamer Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Mossy AI · Modding &amp; Game Dev Workstation
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-slate-300 font-mono">10 Tools Active</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'AI-Powered', value: '5', icon: Zap, color: 'text-emerald-400' },
          { label: 'Require API Key', value: '2', icon: Code2, color: 'text-amber-400' },
          { label: 'Experimental', value: '3', icon: Cpu, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.path}
              className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center group-hover:bg-slate-600 transition-colors">
                    <Icon className="w-4.5 h-4.5 text-emerald-400 w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{tool.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[tool.status]}`}>
                        {tool.badge}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full mt-1 ${STATUS_DOT[tool.status]}`} />
              </div>

              <p className="text-slate-400 text-xs leading-relaxed flex-1">
                {tool.description}
              </p>

              <button
                onClick={() => navigate(tool.path)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/20 hover:border-emerald-500/40 transition-all group/btn"
              >
                <span>Open Tool</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center">
        <p className="text-slate-500 text-xs">
          🎮 Mossy Gamer Tools — built for modders, mappers, and indie devs.
          Services run locally on ports 8005–8008 via Python FastAPI.
        </p>
      </div>
    </div>
  );
};

export default GamerHub;
