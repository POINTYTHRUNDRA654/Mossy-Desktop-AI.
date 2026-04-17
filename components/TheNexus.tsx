import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAiClient } from '../utils/aiClient';
import { LayoutDashboard, Zap, Clock, Shield, Activity, Star, ArrowRight, MessageSquare, Terminal, Aperture, GitBranch, Cpu, AlertTriangle, Calendar, Bell, Package, Library, Bug, BookOpen, Feather, BrainCircuit, Hexagon } from 'lucide-react';

interface Insight {
  id: string;
  type: 'info' | 'warning' | 'suggestion';
  message: string;
  action?: string;
  actionLink?: string;
}

interface JournalEntry {
  date: string;
  bullets: string;
}

const TheNexus: React.FC = () => {
  const [greeting, setGreeting] = useState("Initializing...");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [bridgeStatus, setBridgeStatus] = useState(false);
  const [systemLoad, setSystemLoad] = useState(34);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // ── On mount: load local state ──────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning. I'm ready.");
    else if (hour < 18) setGreeting("Good Afternoon. What are we building?");
    else setGreeting("Good Evening. Let's get to work.");

    const savedProject = localStorage.getItem('mossy_project');
    if (savedProject) setActiveProject(JSON.parse(savedProject));

    const bridge = localStorage.getItem('mossy_bridge_active') === 'true';
    setBridgeStatus(bridge);

    const staticInsights: Insight[] = [
      { id: '1', type: 'suggestion', message: 'Ask Mossy to read or write any file on your machine.', action: 'Open Chat', actionLink: '/chat' },
      { id: '2', type: 'info', message: 'Use The Workshop to create new programs and scripts.', action: 'Open Workshop', actionLink: '/workshop' },
    ];
    if (!bridge) {
      staticInsights.push({ id: '3', type: 'warning', message: 'Desktop Bridge offline — file access and app control limited.', action: 'Connect', actionLink: '/bridge' });
    } else {
      staticInsights.push({ id: '4', type: 'info', message: 'Desktop Bridge online — Mossy can read/write files and launch apps.', action: 'View Bridge', actionLink: '/bridge' });
    }
    setInsights(staticInsights);

    const interval = setInterval(() => {
      setSystemLoad(prev => Math.min(100, Math.max(10, prev + (Math.random() * 10 - 5))));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // ── Journal: read last 5 entries + generate pending summary ────────────
  useEffect(() => {
    const loadJournal = async () => {
      const api = window.electronAPI;

      // 1. If a pending session exists, summarise it first
      const pendingMessages = localStorage.getItem('mossy_pending_journal_messages');
      const pendingDate     = localStorage.getItem('mossy_pending_journal_date');

      if (pendingMessages && pendingDate && api) {
        try {
          setBriefingLoading(true);
          const msgs = JSON.parse(pendingMessages);
          const excerpt = msgs
            .filter((m: any) => m.role !== 'system')
            .slice(-20)
            .map((m: any) => `${m.role === 'user' ? 'User' : 'Mossy'}: ${m.text.slice(0, 200)}`)
            .join('\n');

          const ai = getAiClient();
          const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `You are summarising a chat session. Produce exactly 3 bullet points (each starting with "• ") capturing the key topics, decisions, or work done. Be concise — each bullet ≤ 15 words.\n\nSession transcript:\n${excerpt}`,
          });

          const summary = res.text?.trim() || '• Session recorded.';
          const timestamp = new Date(pendingDate).toLocaleString();

          if (api.journalWriteEntry) {
            await api.journalWriteEntry({ summary, timestamp });
          }

          localStorage.removeItem('mossy_pending_journal_messages');
          localStorage.removeItem('mossy_pending_journal_date');
          setBriefingLoading(false);
        } catch (e) {
          console.error('[Journal] Summary failed:', e);
          setBriefingLoading(false);
          localStorage.removeItem('mossy_pending_journal_messages');
          localStorage.removeItem('mossy_pending_journal_date');
        }
      }

      // 2. Read last 5 journal entries
      if (api?.journalReadLast) {
        try {
          const result: any = await api.journalReadLast(5);
          if (result?.entries?.length) {
            const parsed: JournalEntry[] = result.entries.map((raw: string) => {
              const lines = raw.trim().split('\n').filter(Boolean);
              const dateLine = lines.find(l => l.startsWith('###')) || '';
              const date = dateLine.replace('### ', '').trim();
              const bullets = lines.filter(l => !l.startsWith('###')).join('\n');
              return { date, bullets };
            });
            setJournalEntries(parsed.reverse()); // newest first
          }
        } catch {}
      }
    };

    loadJournal();
  }, []);

  return (
    <div className="h-full flex flex-col bg-forge-dark text-slate-200 overflow-y-auto custom-scrollbar p-8">

      {/* Hero Section */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-2 font-mono text-xs tracking-widest uppercase">
            <Activity className="w-3 h-3 animate-pulse" />
            RobCo Termlink Active
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
            {greeting}
          </h1>
          <p className="text-slate-400 max-w-lg">
            Mossy Second Brain v3.0 online. All systems nominal.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 min-w-[140px]">
            <div className="text-slate-500 text-xs uppercase font-bold mb-1">Reactor Output</div>
            <div className="text-2xl font-mono text-emerald-400">{systemLoad.toFixed(0)}%</div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${systemLoad}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Feed + Journal + Project */}
        <div className="lg:col-span-2 space-y-6">

          {/* Overseer's Feed */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-32 h-32 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" /> Overseer's Feed
            </h2>
            <div className="space-y-3 relative z-10">
              {insights.map(insight => (
                <div key={insight.id} className="bg-black/20 backdrop-blur rounded-xl p-4 border border-white/5 flex items-start gap-4 hover:bg-black/30 transition-colors">
                  <div className={`mt-1 p-1.5 rounded-full ${insight.type === 'warning' ? 'bg-red-500/20 text-red-400' : insight.type === 'suggestion' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : insight.type === 'suggestion' ? <Star className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm leading-relaxed">{insight.message}</p>
                    {insight.action && (
                      <Link to={insight.actionLink || '#'} className="inline-flex items-center gap-1 text-xs font-bold text-forge-accent mt-2 hover:underline">
                        {insight.action} <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session Journal */}
          <div className="bg-forge-panel rounded-3xl p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Feather className="w-5 h-5 text-amber-400" /> Session Journal
                {briefingLoading && <span className="text-xs text-slate-500 font-normal animate-pulse ml-2">summarising…</span>}
              </h2>
              <Link to="/scribe" className="text-xs text-slate-400 hover:text-white">Open Scribe</Link>
            </div>

            {journalEntries.length === 0 ? (
              <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                <Feather className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No journal entries yet.</p>
                <p className="text-xs mt-1">Mossy will auto-write a summary when you finish each chat session.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((entry, i) => (
                  <div key={i} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                    <div className="text-[10px] font-mono text-emerald-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {entry.date}
                    </div>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{entry.bullets}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Project Card */}
          <div className="bg-forge-panel rounded-3xl p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-400" /> Active Mod Project
              </h2>
              <Link to="/workshop" className="text-xs text-slate-400 hover:text-white">View All</Link>
            </div>

            {activeProject ? (
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-600">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">{activeProject.name}</h3>
                  <span className="px-2 py-0.5 bg-green-900 text-green-300 text-[10px] uppercase font-bold rounded">Active</span>
                </div>
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{activeProject.notes}</p>
                <div className="flex gap-4 text-xs text-slate-500 font-mono">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Created: {activeProject.timestamp}</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Status: {activeProject.status}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to="/workshop" className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg text-center transition-colors">
                    Open Workbench
                  </Link>
                  <Link to="/assembler" className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold rounded-lg text-center transition-colors">
                    Build FOMOD
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                <p className="mb-2">No active project initialized.</p>
                <Link to="/chat" className="text-forge-accent hover:underline text-sm font-bold">Ask Mossy to start one</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Launch */}
        <div className="space-y-6">
          <div className="bg-forge-panel rounded-3xl p-6 border border-slate-700 h-full">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-forge-accent" /> Quick Launch
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-4">

              <Link to="/chat" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-emerald-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">Chat</span>
              </Link>

              <Link to="/workshop" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-purple-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Terminal className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">Scripting</span>
              </Link>

              <Link to="/organizer" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-yellow-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Library className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">Organizer</span>
              </Link>

              <Link to="/crucible" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-red-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bug className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">Crucible</span>
              </Link>

              <Link to="/cortex" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-blue-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BrainCircuit className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">The Cortex</span>
              </Link>

              <Link to="/hive" className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-600 hover:border-pink-500 transition-all group flex flex-col items-center justify-center text-center gap-2 aspect-square">
                <div className="w-10 h-10 bg-pink-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Hexagon className="w-5 h-5 text-pink-400" />
                </div>
                <span className="text-sm font-bold text-slate-200">The Hive</span>
              </Link>

            </div>

            {/* System Status Mini */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">System Bridge</h3>
              <div className={`p-3 rounded-xl flex items-center gap-3 ${bridgeStatus ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                <div className={`w-3 h-3 rounded-full ${bridgeStatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                <div>
                  <div className={`text-sm font-bold ${bridgeStatus ? 'text-emerald-400' : 'text-red-400'}`}>
                    {bridgeStatus ? 'Connected' : 'Disconnected'}
                  </div>
                  <div className="text-[10px] text-slate-500">Localhost:21337</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper icon
const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
);

export default TheNexus;
