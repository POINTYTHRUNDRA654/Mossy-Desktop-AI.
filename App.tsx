import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SystemMonitor from './components/SystemMonitor';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import ImageSuite from './components/ImageSuite';
import TTSPanel from './components/TTSPanel';
import DesktopBridge from './components/DesktopBridge';
import Workshop from './components/Workshop';
import WorkflowOrchestrator from './components/WorkflowOrchestrator';
import Lorekeeper from './components/Lorekeeper';
import Holodeck from './components/Holodeck';
import TheVault from './components/TheVault';
import HyperTerminal from './components/HyperTerminal';
import TheCortex from './components/TheCortex';
import TheLens from './components/TheLens';
import TheNexus from './components/TheNexus';
import TheConduit from './components/TheConduit';
import TheSynapse from './components/TheSynapse';
import TheHive from './components/TheHive';
import TheBlueprint from './components/TheBlueprint';
import TheGenome from './components/TheGenome';
import TheReverie from './components/TheReverie';
import TheAnima from './components/TheAnima';
import TheSplicer from './components/TheSplicer';
import ThePrism from './components/ThePrism';
import TheFabric from './components/TheFabric';
import TheCatalyst from './components/TheCatalyst';

// Define window interface for AI Studio helpers
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const App: React.FC = () => {
  // Ensure API Key selection for paid features (Veo/Pro Image) if applicable
  // This is a safety check on mount.
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          // We prompt once on load if missing, to ensure "Integrate with all my systems" (i.e. having access) is true
          try {
             await window.aistudio.openSelectKey();
          } catch (e) {
             console.log("User dismissed key selection");
          }
        }
      }
    };
    checkKey();
  }, []);

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-forge-dark text-slate-200">
        <Sidebar />
        <main className="flex-1 relative overflow-hidden">
          <Routes>
            <Route path="/" element={<TheNexus />} />
            <Route path="/monitor" element={<SystemMonitor />} />
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/lens" element={<TheLens />} />
            <Route path="/synapse" element={<TheSynapse />} />
            <Route path="/hive" element={<TheHive />} />
            <Route path="/blueprint" element={<TheBlueprint />} />
            <Route path="/genome" element={<TheGenome />} />
            <Route path="/reverie" element={<TheReverie />} />
            <Route path="/anima" element={<TheAnima />} />
            <Route path="/splicer" element={<TheSplicer />} />
            <Route path="/prism" element={<ThePrism />} />
            <Route path="/fabric" element={<TheFabric />} />
            <Route path="/catalyst" element={<TheCatalyst />} />
            <Route path="/conduit" element={<TheConduit />} />
            <Route path="/cortex" element={<TheCortex />} />
            <Route path="/terminal" element={<HyperTerminal />} />
            <Route path="/orchestrator" element={<WorkflowOrchestrator />} />
            <Route path="/lore" element={<Lorekeeper />} />
            <Route path="/holo" element={<Holodeck />} />
            <Route path="/vault" element={<TheVault />} />
            <Route path="/workshop" element={<Workshop />} />
            <Route path="/live" element={<LiveInterface />} />
            <Route path="/images" element={<ImageSuite />} />
            <Route path="/tts" element={<TTSPanel />} />
            <Route path="/bridge" element={<DesktopBridge />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;