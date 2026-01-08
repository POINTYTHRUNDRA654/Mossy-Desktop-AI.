import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Activity } from 'lucide-react';

const LiveInterface: React.FC = () => {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [volume, setVolume] = useState(0);
  
  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null); // To hold the active session promise
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Helper: Create PCM Blob
  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);
    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  // Helper: Decode Audio
  const decodeAudioData = async (
    base64String: string,
    ctx: AudioContext
  ): Promise<AudioBuffer> => {
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert to Int16 and then float
    const dataInt16 = new Int16Array(bytes.buffer);
    const numChannels = 1;
    const sampleRate = 24000;
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const startSession = async () => {
    try {
      setStatus('Initializing audio...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      setStatus('Connecting to Gemini 2.5 Live...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are OmniForge's voice interface. Keep answers concise and helpful.",
        },
        callbacks: {
          onopen: () => {
            setStatus('Connected. Listening...');
            setActive(true);
            
            // Setup Microphone Input Stream
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Calculate volume for UI
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length) * 100);

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               const ctx = audioContextRef.current;
               // Ensure time is monotonic
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const buffer = await decodeAudioData(base64Audio, ctx);
               const source = ctx.createBufferSource();
               source.buffer = buffer;
               source.connect(ctx.destination);
               source.onended = () => {
                 sourcesRef.current.delete(source);
               };
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += buffer.duration;
               sourcesRef.current.add(source);
            }
            
            if (msg.serverContent?.interrupted) {
              console.log("Interrupted");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setActive(false);
          },
          onerror: (err) => {
            console.error(err);
            setStatus('Error occurred');
            setActive(false);
          }
        }
      });
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setStatus('Failed to start session');
      setActive(false);
    }
  };

  const stopSession = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Cannot explicitly close session with current SDK pattern easily if promise not resolved, 
    // but cleaning up media streams stops input.
    // Ideally call session.close() if exposed.
    if (sessionRef.current) {
        sessionRef.current.then((session: any) => {
            // Check if close exists or just let it timeout/disconnect via socket close
            // session.close(); // Not always available in typed definition depending on version
        });
    }
    setActive(false);
    setStatus('Stopped');
    setVolume(0);
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-forge-dark text-slate-200 p-8">
      <div className="relative mb-12">
        <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${active ? 'border-forge-accent shadow-[0_0_50px_rgba(56,189,248,0.5)]' : 'border-slate-700'}`}>
           {/* Visualizer Circle */}
           <div 
             className="w-full h-full rounded-full bg-forge-accent opacity-20 absolute transition-transform duration-75"
             style={{ transform: `scale(${1 + volume / 50})` }}
           />
           <Activity className={`w-24 h-24 ${active ? 'text-forge-accent' : 'text-slate-600'}`} />
        </div>
      </div>
      
      <h2 className="text-3xl font-bold mb-4">{active ? 'Live Conversation Active' : 'Start Voice Chat'}</h2>
      <p className="text-slate-400 mb-8 font-mono">{status}</p>

      <button
        onClick={active ? stopSession : startSession}
        className={`flex items-center gap-3 px-8 py-4 rounded-full text-xl font-bold transition-all ${
          active 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-2 border-red-500' 
            : 'bg-forge-accent text-slate-900 hover:bg-sky-400'
        }`}
      >
        {active ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        {active ? 'End Session' : 'Start Listening'}
      </button>
      
      <div className="mt-8 text-sm text-slate-500 max-w-md text-center">
        Powered by Gemini 2.5 Native Audio (Live API).<br/>
        Real-time latency. Talk naturally.
      </div>
    </div>
  );
};

export default LiveInterface;
