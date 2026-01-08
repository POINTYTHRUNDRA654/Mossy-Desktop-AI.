import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, Radio, Image, Volume2, Activity } from 'lucide-react';

const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', icon: Activity, label: 'System Monitor' },
    { to: '/chat', icon: MessageSquare, label: 'Expert Chat' },
    { to: '/live', icon: Radio, label: 'Live Voice' },
    { to: '/images', icon: Image, label: 'Image Studio' },
    { to: '/tts', icon: Volume2, label: 'Speech Lab' },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tighter">
          OMNI<span className="text-forge-accent">FORGE</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">AI Integrated Workspace</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? 'bg-forge-accent text-slate-900 font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        v1.0.4 | Gemini 3 Pro
      </div>
    </div>
  );
};

export default Sidebar;
