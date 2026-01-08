import React, { useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Play, FileAudio } from 'lucide-react';

const TTSPanel: React.FC = () => {
  const [text, setText] = useState("System checks complete. Welcome back, user.");
  const [loading, setLoading] = useState(false);
  
  const handleSpeak = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Fenrir sounds deeper/tech
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
         const binaryString = atob(base64Audio);
         const len = binaryString.length;
         const bytes = new Uint8Array(len);
         for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
         
         // Decode usually expects wav/mp3 but gemini raw pcm needs manual handle if not wav container?
         // Actually 2.5 TTS returns WAV usually? 
         // Wait, the docs say "The audio bytes returned by the API is raw PCM data."
         // So we must decode manually like in Live API example.
         
         const dataInt16 = new Int16Array(bytes.buffer);
         const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
         const channelData = buffer.getChannelData(0);
         for(let i=0; i<dataInt16.length; i++) {
             channelData[i] = dataInt16[i] / 32768.0;
         }
         
         const source = audioContext.createBufferSource();
         source.buffer = buffer;
         source.connect(audioContext.destination);
         source.start();
      }

    } catch (e) {
      console.error(e);
      alert('TTS Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-forge-dark p-8">
      <div className="max-w-2xl w-full bg-forge-panel p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-indigo-500/20 rounded-lg">
             <FileAudio className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
             <h2 className="text-2xl font-bold text-white">Neural Voice Synthesis</h2>
             <p className="text-slate-400">Gemini 2.5 Flash TTS</p>
          </div>
        </div>

        <textarea
          className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-lg text-slate-200 focus:border-indigo-500 focus:outline-none resize-none mb-6 font-mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            onClick={handleSpeak}
            disabled={loading}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            {loading ? 'Synthesizing...' : 'Generate Speech'}
            {!loading && <Play className="w-5 h-5 fill-current" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TTSPanel;
