import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SystemMonitor from './components/SystemMonitor';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import ImageSuite from './components/ImageSuite';
import TTSPanel from './components/TTSPanel';

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
            <Route path="/" element={<SystemMonitor />} />
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/live" element={<LiveInterface />} />
            <Route path="/images" element={<ImageSuite />} />
            <Route path="/tts" element={<TTSPanel />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;