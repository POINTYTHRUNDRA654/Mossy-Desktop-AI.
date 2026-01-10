import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface LiveContextType {
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  status: string;
  volume: number;
  mode: 'idle' | 'listening' | 'processing' | 'speaking';
  transcription: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  // Avatar Management
  customAvatar: string | null;
  updateAvatar: (file: File) => Promise<void>;
  setAvatarFromUrl: (url: string) => Promise<void>;
  clearAvatar: () => void;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export const useLive = () => {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error('useLive must be used within a LiveProvider');
  }
  return context;
};

// --- Audio Helpers ---
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

const decodeAudioData = async (base64String: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
};

export const LiveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Live State
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [volume, setVolume] = useState(0);
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [transcription, setTranscription] = useState('');

  // Avatar State (Global)
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => {
      try {
          return localStorage.getItem('mossy_avatar_custom');
      } catch { return null; }
  });

  // Refs for audio handling - PERSISTENT ACROSS ROUTES
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Ref for Mute state to be accessible in callbacks
  const isMutedRef = useRef(false);

  const toggleMute = () => {
      setIsMuted(prev => {
          const newState = !prev;
          isMutedRef.current = newState;
          // If muting, stop current audio immediately
          if (newState && audioContextRef.current) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setMode('idle');
          }
          return newState;
      });
  };

  // --- Avatar Logic ---
  const processImageToAvatar = async (imgSource: string | File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const maxSize = 300; // Smaller size for better performance/storage
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                  if (width > maxSize) {
                      height *= maxSize / width;
                      width = maxSize;
                  }
              } else {
                  if (height > maxSize) {
                      width *= maxSize / height;
                      height = maxSize;
                  }
              }
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              // Compress to JPEG 60% quality
              resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = reject;

          if (typeof imgSource === 'string') {
              img.src = imgSource;
          } else {
              const reader = new FileReader();
              reader.onload = (e) => {
                  img.src = e.target?.result as string;
              };
              reader.readAsDataURL(imgSource);
          }
      });
  };

  const updateAvatar = async (file: File) => {
      try {
          const compressed = await processImageToAvatar(file);
          setCustomAvatar(compressed);
          try {
              localStorage.setItem('mossy_avatar_custom', compressed);
          } catch (e) {
              console.error("Storage quota exceeded", e);
              alert("Image saved for this session only (Browser Storage Full).");
          }
      } catch (err) {
          console.error("Failed to process avatar:", err);
      }
  };

  const setAvatarFromUrl = async (url: string) => {
      try {
          const compressed = await processImageToAvatar(url);
          setCustomAvatar(compressed);
          try {
              localStorage.setItem('mossy_avatar_custom', compressed);
          } catch (e) {
              console.error("Storage quota exceeded", e);
              alert("Image saved for this session only (Browser Storage Full).");
          }
      } catch (err) {
          console.error("Failed to process avatar url:", err);
      }
  };

  const clearAvatar = () => {
      setCustomAvatar(null);
      localStorage.removeItem('mossy_avatar_custom');
  };

  // --- Live Connection Logic ---
  const disconnect = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    inputContextRef.current?.close();
    audioContextRef.current?.close();
    sessionRef.current?.then((s: any) => s.close && s.close());
    
    // Reset Refs
    inputContextRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsActive(false);
    setStatus('Offline');
    setMode('idle');
    setVolume(0);
  };

  const connect = async () => {
    if (isActive) return;

    try {
      setStatus('Initializing Neural Interface...');
      setMode('processing');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      setStatus('Establishing Uplink...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "You are Mossy, a sentient AI assistant for Fallout 4 modding and creative work. You are helpful, creative, and precise. Keep responses concise and conversational. You are currently running on the user's desktop.",
        },
        callbacks: {
          onopen: () => {
            setStatus('Online');
            setIsActive(true);
            setMode('listening');
            setTranscription(">> Connection established. Listening...");
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Calculate volume for UI
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              
              if (Math.random() > 0.5) setVolume(rms * 500); 

              if (rms > 0.02) setMode('listening'); 
              
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            // CHECK MUTE STATE BEFORE PLAYING
            if (base64Audio && audioContextRef.current && !isMutedRef.current) {
               setMode('speaking');
               setTranscription(">> Receiving audio stream...");
               const ctx = audioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               const buffer = await decodeAudioData(base64Audio, ctx);
               const source = ctx.createBufferSource();
               source.buffer = buffer;
               source.connect(ctx.destination);
               source.onended = () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setMode('idle');
               };
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += buffer.duration;
               sourcesRef.current.add(source);
               
               setVolume(Math.random() * 50 + 20);
            }
            if (msg.serverContent?.interrupted) {
              setTranscription(">> Interrupted.");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setMode('idle');
              setVolume(0);
            }
          },
          onclose: () => { disconnect(); },
          onerror: (err) => { console.error(err); setStatus('Connection Error'); disconnect(); }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
      console.error(e);
      if (e.message && (e.message.includes('503') || e.message.toLowerCase().includes('unavailable'))) {
          setStatus('Service Busy');
      } else {
          setStatus('Init Failed');
      }
      disconnect();
    }
  };

  return (
    <LiveContext.Provider value={{ isActive, isMuted, toggleMute, status, volume, mode, transcription, connect, disconnect, customAvatar, updateAvatar, setAvatarFromUrl, clearAvatar }}>
      {children}
    </LiveContext.Provider>
  );
};