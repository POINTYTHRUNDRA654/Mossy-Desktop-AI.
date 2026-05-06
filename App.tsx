import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MossyObserver from './components/MossyObserver';
import CommandPalette from './components/CommandPalette';
import SystemBus from './components/SystemBus';
import ClipboardBanner from './components/ClipboardBanner';
import ApiKeySetup from './components/ApiKeySetup';
import { MossyContextBusProvider } from './components/MossyContextBus';
import { Loader2, Zap } from 'lucide-react';
import { LiveProvider } from './components/LiveContext';
import { hasApiKey, isConfigured } from './utils/apiKey';

// --- LAZY LOAD MODULES ---
const SystemMonitor = React.lazy(() => import('./components/SystemMonitor'));
const ChatInterface = React.lazy(() => import('./components/ChatInterface').then(module => ({ default: module.ChatInterface })));
const DesktopBridge = React.lazy(() => import('./components/DesktopBridge'));
const Workshop = React.lazy(() => import('./components/Workshop'));
const WorkflowOrchestrator = React.lazy(() => import('./components/WorkflowOrchestrator'));
const TheVault = React.lazy(() => import('./components/TheVault'));
const HyperTerminal = React.lazy(() => import('./components/HyperTerminal'));
const TheCortex = React.lazy(() => import('./components/TheCortex'));
const TheLens = React.lazy(() => import('./components/TheLens'));
const TheNexus = React.lazy(() => import('./components/TheNexus'));
const TheHive = React.lazy(() => import('./components/TheHive'));
const TheBlueprint = React.lazy(() => import('./components/TheBlueprint'));
const ThePrism = React.lazy(() => import('./components/ThePrism'));
const TheOrganizer = React.lazy(() => import('./components/TheOrganizer'));
const TheCrucible = React.lazy(() => import('./components/TheCrucible'));
const TheAssembler = React.lazy(() => import('./components/TheAssembler'));
const TheScribe = React.lazy(() => import('./components/TheScribe'));
const ThePlanner = React.lazy(() => import('./components/ThePlanner'));

// ── Gamer Tools ──
const GamerHub = React.lazy(() => import('./components/GamerHub'));
const GameScriptForge = React.lazy(() => import('./components/GameScriptForge'));
const GameVision = React.lazy(() => import('./components/GameVision'));
const SteamPanel = React.lazy(() => import('./components/SteamPanel'));
const ModBrowser = React.lazy(() => import('./components/ModBrowser'));
const LoadOrderAnalyzer = React.lazy(() => import('./components/LoadOrderAnalyzer'));
const BlenderForge = React.lazy(() => import('./components/BlenderForge'));
const GodotForge = React.lazy(() => import('./components/GodotForge'));
const MapForge = React.lazy(() => import('./components/MapForge'));
const AssetForge3D = React.lazy(() => import('./components/AssetForge3D'));
const VoiceForge = React.lazy(() => import('./components/VoiceForge'));
const TextureUpscaler = React.lazy(() => import('./components/TextureUpscaler'));
const WolvenKitPanel = React.lazy(() => import('./components/WolvenKitPanel'));
// ── Fallout 4 Modding Tools ──
const FO4EditPanel   = React.lazy(() => import('./components/FO4EditPanel'));
const BA2Browser     = React.lazy(() => import('./components/BA2Browser'));
const PapyrusIDE     = React.lazy(() => import('./components/PapyrusIDE'));
const FOMODBuilder   = React.lazy(() => import('./components/FOMODBuilder'));
const CellEditor     = React.lazy(() => import('./components/CellEditor'));
const F4SEScaffolder = React.lazy(() => import('./components/F4SEScaffolder'));
// ── Advanced Modding Tools (New) ──
const MO2Manager     = React.lazy(() => import('./components/MO2Manager'));
const NIFViewer      = React.lazy(() => import('./components/NIFViewer'));
const INITweaker     = React.lazy(() => import('./components/INITweaker'));
const PluginMerger   = React.lazy(() => import('./components/PluginMerger'));
const ModDiagnostics = React.lazy(() => import('./components/ModDiagnostics'));
// ── Desktop Tutor Bridge ──
const MossyTutorBridge = React.lazy(() => import('./components/MossyTutorBridge'));
// ── Gemma Fine-Tuner + Reasoning Chain (LangChain) ──
const Gemma4FineTuner  = React.lazy(() => import('./components/Gemma4FineTuner'));
const ReasoningChain   = React.lazy(() => import('./components/ReasoningChain'));
// ── Multi-Agent Collaboration monitor ──
const AgentCollaboration = React.lazy(() => import('./components/AgentCollaboration'));

// Define window interface for AI Studio helpers & Custom Events
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
  interface WindowEventMap {
    'mossy-control': CustomEvent<{ action: string; payload: any }>;
  }
}

// Controller Component to handle AI Navigation Commands
const NeuralController: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleControl = (e: CustomEvent<{ action: string; payload: any }>) => {
      const { action, payload } = e.detail;
      
      console.log(`[Neural Control] Executing: ${action}`, payload);

      if (action === 'navigate') {
        if (location.pathname !== payload.path) {
          navigate(payload.path);
        }
      }
      
      if (action === 'open_palette') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
      }
    };

    window.addEventListener('mossy-control', handleControl as EventListener);
    return () => window.removeEventListener('mossy-control', handleControl as EventListener);
  }, [navigate, location]);

  return null;
};

const ModuleLoader = () => (
  <div className="flex h-full w-full items-center justify-center bg-forge-dark text-emerald-500">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-4 h-4 fill-current animate-pulse" />
        </div>
      </div>
      <span className="text-xs font-mono tracking-widest uppercase animate-pulse">Loading Module...</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [keyReady, setKeyReady] = useState(isConfigured());

  if (!keyReady) {
    return <ApiKeySetup onConfigured={() => setKeyReady(true)} />;
  }

  return (
    <LiveProvider>
      <MossyContextBusProvider>
        <HashRouter>
          <div className="flex h-screen w-screen overflow-hidden bg-forge-dark text-slate-200">
            <NeuralController />
            <CommandPalette />
            <SystemBus />
            <Sidebar />
            <main className="flex-1 relative overflow-hidden bg-[#050910]">
              <MossyObserver />
              <ClipboardBanner />
              <Suspense fallback={<ModuleLoader />}>
              <Routes>
                {/* ── Core ── */}
                <Route path="/" element={<TheNexus />} />
                <Route path="/chat" element={<ChatInterface />} />
                <Route path="/monitor" element={<SystemMonitor />} />
                <Route path="/terminal" element={<HyperTerminal />} />
                <Route path="/bridge" element={<DesktopBridge />} />
                <Route path="/workshop" element={<Workshop />} />

                {/* ── Intelligence ── */}
                <Route path="/cortex" element={<TheCortex />} />
                <Route path="/planner" element={<ThePlanner />} />
                <Route path="/lens" element={<TheLens />} />
                <Route path="/prism" element={<ThePrism />} />
                <Route path="/hive" element={<TheHive />} />

                {/* ── Build & Craft ── */}
                <Route path="/blueprint" element={<TheBlueprint />} />
                <Route path="/assembler" element={<TheAssembler />} />
                <Route path="/crucible" element={<TheCrucible />} />

                {/* ── Data & Memory ── */}
                <Route path="/vault" element={<TheVault />} />
                <Route path="/organizer" element={<TheOrganizer />} />
                <Route path="/scribe" element={<TheScribe />} />

                {/* ── Orchestration ── */}
                <Route path="/orchestrator" element={<WorkflowOrchestrator />} />

                {/* ── Gamer Tools ── */}
                <Route path="/gamer-hub" element={<GamerHub />} />
                <Route path="/game-scripts" element={<GameScriptForge />} />
                <Route path="/game-vision" element={<GameVision />} />
                <Route path="/steam" element={<SteamPanel />} />
                <Route path="/mod-browser" element={<ModBrowser />} />
                <Route path="/load-order" element={<LoadOrderAnalyzer />} />
                <Route path="/blender-forge" element={<BlenderForge />} />
                <Route path="/godot-forge" element={<GodotForge />} />
                <Route path="/map-forge" element={<MapForge />} />
                <Route path="/asset-forge" element={<AssetForge3D />} />
                <Route path="/voice-forge" element={<VoiceForge />} />
                <Route path="/texture-upscaler" element={<TextureUpscaler />} />
                <Route path="/wolvenkit" element={<WolvenKitPanel />} />
                {/* ── Fallout 4 Modding Tools ── */}
                <Route path="/fo4edit"     element={<FO4EditPanel />} />
                <Route path="/ba2"         element={<BA2Browser />} />
                <Route path="/papyrus"     element={<PapyrusIDE />} />
                <Route path="/fomod"       element={<FOMODBuilder />} />
                <Route path="/cell-editor" element={<CellEditor />} />
                <Route path="/f4se"        element={<F4SEScaffolder />} />
                {/* ── Advanced Modding Tools ── */}
                <Route path="/mo2"         element={<MO2Manager />} />
                <Route path="/nif-viewer"  element={<NIFViewer />} />
                <Route path="/ini-tweaker" element={<INITweaker />} />
                <Route path="/merger"      element={<PluginMerger />} />
                <Route path="/diagnostics" element={<ModDiagnostics />} />
                {/* ── Desktop Tutor Bridge ── */}
                <Route path="/tutor-bridge"    element={<MossyTutorBridge />} />
                {/* ── AI Tools ── */}
                <Route path="/gemma-tuner"     element={<Gemma4FineTuner />} />
                <Route path="/reasoning"       element={<ReasoningChain />} />
                <Route path="/agent-collab"    element={<AgentCollaboration />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </HashRouter>
      </MossyContextBusProvider>
    </LiveProvider>
  );
};

export default App;