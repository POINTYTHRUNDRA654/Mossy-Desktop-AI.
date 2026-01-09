import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Loader2, Bot, Leaf, Search, FolderOpen, Save, Trash2, CheckCircle2, HelpCircle, PauseCircle, ChevronRight, FileText, Cpu, X, CheckSquare, Globe, Mic, Volume2, VolumeX, StopCircle, Wifi, Gamepad2, Terminal, Play, Box, Layout, ArrowUpRight } from 'lucide-react';
import { Message } from '../types';

type OnboardingState = 'init' | 'scanning' | 'integrating' | 'ready' | 'project_setup';

interface DetectedApp {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

interface ProjectData {
  name: string;
  status: string;
  notes: string;
  timestamp: string;
  lastSessionSummary?: string; // New field for long-term memory
  keyDecisions?: string[]; // Permanent memory of choices
}

interface ToolExecution {
    id: string;
    toolName: string;
    args: any;
    status: 'pending' | 'running' | 'success' | 'failed';
    result?: string;
}

// Speech Recognition Type Definition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// --- Tool Definitions ---
const toolDeclarations: FunctionDeclaration[] = [
    {
        name: 'list_files',
        description: 'List files in a specific directory on the user\'s computer.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                path: { type: Type.STRING, description: 'The folder path to list (e.g., D:/Mods).' },
            },
            required: ['path']
        }
    },
    {
        name: 'read_file',
        description: 'Read the contents of a specific file on the user\'s computer. Use this to study tutorials, code, or logs.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                path: { type: Type.STRING, description: 'The full path to the file.' },
            },
            required: ['path']
        }
    },
    {
        name: 'browse_web',
        description: 'Access a URL to read its content for research or studying.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                url: { type: Type.STRING, description: 'The URL to visit.' },
            },
            required: ['url']
        }
    },
    {
        name: 'recommend_software',
        description: 'Analyze the user\'s needs and recommend specific software tools installed or missing from their computer.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING, description: 'The workflow category (e.g., "Modding", "3D Modeling", "Scripting").' },
                context: { type: Type.STRING, description: 'The specific game or context (e.g., "Fallout 4", "General Dev").' },
            },
            required: ['category']
        }
    },
    {
        name: 'run_blender_script',
        description: 'Execute a Python script inside the active Blender instance.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                script: { type: Type.STRING, description: 'The Python code to execute.' },
                description: { type: Type.STRING, description: 'A short description of what the script does.' },
            },
            required: ['script', 'description']
        }
    },
    {
        name: 'system_diagnostic',
        description: 'Run a diagnostic check on system resources (CPU, GPU, RAM).',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        }
    },
    {
        name: 'control_interface',
        description: 'Directly control the Mossy application UI. Use this to navigate to different modules, open tools, or change settings.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: { 
                    type: Type.STRING, 
                    description: 'The action to perform. Options: "navigate", "toggle_sidebar", "open_palette".' 
                },
                target: {
                    type: Type.STRING,
                    description: 'For navigation, the route path (e.g., "/workshop", "/anima", "/monitor").'
                }
            },
            required: ['action']
        }
    }
];

export const ChatInterface: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Voice State
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // Bridge State
  const [isBridgeActive, setIsBridgeActive] = useState(false);
  
  // Tool Execution State
  const [activeTool, setActiveTool] = useState<ToolExecution | null>(null);

  // Game Context State
  const [gameContext, setGameContext] = useState('General');

  // Onboarding & Context
  const [onboardingState, setOnboardingState] = useState<OnboardingState>('init');
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedApps, setDetectedApps] = useState<DetectedApp[]>([]);
  
  // Project Memory
  const [projectContext, setProjectContext] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // --- PERSISTENCE LAYER ---
  useEffect(() => {
    // Check bridge status every mount or focus
    const checkBridge = () => {
        const active = localStorage.getItem('mossy_bridge_active') === 'true';
        setIsBridgeActive(active);
        
        // Auto-scan if bridge is active on mount and we are in init state
        if (active && onboardingState === 'init') {
             const hasScanned = localStorage.getItem('mossy_apps');
             if (!hasScanned) {
                 performSystemScan();
             }
        }
    };
    checkBridge();
    window.addEventListener('focus', checkBridge);
    window.addEventListener('storage', checkBridge);
    
    // Custom event listener for immediate updates from other components
    const handleBridgeConnect = () => {
        setIsBridgeActive(true);
        // If we just connected and haven't scanned, trigger scan automatically
        if (onboardingState === 'init') {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                text: "**Desktop Bridge Connection Established.**\n\nI can now see your local environment. Initiating mandatory system scan..."
            }]);
            setTimeout(() => performSystemScan(), 1000);
        }
    };
    window.addEventListener('mossy-bridge-connected', handleBridgeConnect);

    // Load state from local storage on mount
    const savedMessages = localStorage.getItem('mossy_messages');
    const savedState = localStorage.getItem('mossy_state');
    const savedProject = localStorage.getItem('mossy_project');
    const savedApps = localStorage.getItem('mossy_apps');
    const savedVoice = localStorage.getItem('mossy_voice_enabled');
    const savedGame = localStorage.getItem('mossy_game_context');

    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedState) setOnboardingState(JSON.parse(savedState));
    if (savedProject) {
        const parsed = JSON.parse(savedProject);
        setProjectContext(parsed.name);
        setProjectData(parsed);
        setShowProjectPanel(true);
    }
    if (savedApps) setDetectedApps(JSON.parse(savedApps));
    if (savedVoice) setIsVoiceEnabled(JSON.parse(savedVoice));
    if (savedGame) setGameContext(savedGame);

    // If no history, init
    if (!savedMessages) {
       initMossy();
    }
    return () => {
        window.removeEventListener('focus', checkBridge);
        window.removeEventListener('storage', checkBridge);
        window.removeEventListener('mossy-bridge-connected', handleBridgeConnect);
    };
  }, [onboardingState]); // Depend on onboardingState to check logic inside handleBridgeConnect

  useEffect(() => {
    // Save state on updates
    if (messages.length > 0) localStorage.setItem('mossy_messages', JSON.stringify(messages));
    localStorage.setItem('mossy_state', JSON.stringify(onboardingState));
    if (detectedApps.length > 0) localStorage.setItem('mossy_apps', JSON.stringify(detectedApps));
    localStorage.setItem('mossy_voice_enabled', JSON.stringify(isVoiceEnabled));
    localStorage.setItem('mossy_game_context', gameContext);
    if (projectData) {
        localStorage.setItem('mossy_project', JSON.stringify(projectData));
    } else {
        localStorage.removeItem('mossy_project');
    }
  }, [messages, onboardingState, detectedApps, projectData, isVoiceEnabled, gameContext]);

  const initMossy = () => {
      // Check for previous session memory to simulate "Total Recall"
      const lastSession = localStorage.getItem('mossy_last_session_summary');
      let intro = "Hi there! I'm **Mossy**. I'm here to help you create, mod, and integrate your workflow.\n\nFirst, I need to scan your system to see what tools we have to work with. Shall I begin?";
      
      if (lastSession) {
          intro = `Welcome back! I've recalled our last session: \n\n*${lastSession}*\n\nI'm ready to pick up exactly where we left off. System scan required to verify tool integrity. Ready?`;
      }

      setMessages([
        {
            id: 'init',
            role: 'model',
            text: intro,
        }
      ]);
      setOnboardingState('init');
  };

  const resetMemory = () => {
      if (window.confirm("Are you sure? This will wipe Mossy's memory of your current project.")) {
          localStorage.clear();
          setMessages([]);
          setProjectContext(null);
          setProjectData(null);
          setDetectedApps([]);
          initMossy();
          setShowProjectPanel(false);
      }
  };

  // --- VOICE LOGIC ---

  const toggleVoiceMode = () => {
      if (isVoiceEnabled) {
          stopAudio();
      }
      setIsVoiceEnabled(!isVoiceEnabled);
  };

  const stopAudio = () => {
      if (activeSourceRef.current) {
          activeSourceRef.current.stop();
          activeSourceRef.current = null;
      }
      setIsPlayingAudio(false);
  };

  const startListening = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Speech recognition is not supported in this browser.");
          return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
          setIsListening(true);
      };

      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
      };

      recognition.onend = () => {
          setIsListening(false);
      };

      recognition.start();
  };

  const speakText = async (textToSpeak: string) => {
      // Clean markdown for speech (remove * and #)
      const cleanText = textToSpeak.replace(/[*#]/g, '').substring(0, 800); // Limit length for TTS

      setIsPlayingAudio(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: cleanText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is a good female voice for Mossy
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio returned");

        // Decode and Play
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const ctx = audioContextRef.current;
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for(let i=0; i<dataInt16.length; i++) {
             channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        activeSourceRef.current = source;
        
        source.onended = () => {
            setIsPlayingAudio(false);
            activeSourceRef.current = null;
        };
        
        source.start();

      } catch (e) {
          console.error("TTS Error:", e);
          setIsPlayingAudio(false);
      }
  };


  // --- CHAT LOGIC ---

  const generateSystemContext = () => {
      // Rehydrate memory from state
      let context = `
      **SYSTEM STATUS:**
      *   **Bridge Status:** ${isBridgeActive ? "ACTIVE (Tools Enabled)" : "INACTIVE (Sandbox Mode)"}
      *   **Active Project:** ${projectData ? `${projectData.name} - ${projectData.notes}` : "None"}
      *   **GAME CONTEXT:** ${gameContext}
      *   **Integrated Tools:** ${detectedApps.filter(a => a.checked).map(a => a.name).join(', ') || "None"}
      
      **MEMORY BANKS (Long Term):**
      ${projectData?.lastSessionSummary ? `*   **Last Session Recap:** ${projectData.lastSessionSummary}` : "*   No previous session summary found."}
      ${projectData?.keyDecisions ? `*   **Key Decisions:** ${projectData.keyDecisions.join(', ')}` : ""}
      `;
      return context;
  };

  const systemInstruction = `You are **Mossy**, a friendly, intelligent, and highly structured desktop AI assistant.
  You have complete control over the app UI and a persistent memory of the user's project.
  
  ${generateSystemContext()}
  
  **Your Core Rules:**
  1.  **Beginner First:** Assume the user has zero prior knowledge. Explain jargon if used.
  2.  **Tool Use:** If the Bridge is Active, you CAN use tools to list files, run scripts, etc. Suggest this when relevant.
  3.  **App Control:** You can navigate the user to different screens. If they ask to "Go to the workshop" or "Open settings", use the 'control_interface' tool.
  4.  **One Step at a Time:** THIS IS CRITICAL. When guiding a user:
      *   Give **ONE** clear instruction.
      *   **STOP** and wait for the user to confirm they are done.
  
  **Bridge Capabilities (Only if ACTIVE):**
  *   **Control UI:** Use 'control_interface' to navigate or toggle panels.
  *   **Software Recommendations:** If the user asks what tools to use, use 'recommend_software'.
      *   For **Fallout 4**, prefer: **Mod Organizer 2** (Manager), **xEdit/FO4Edit** (Data), **NifSkope** (Meshes), **Outfit Studio** (Bodies), **Creation Kit** (Quests/World).
  *   **Learning:** If the user asks to **study** or **learn from** local files, use 'read_file'.
  *   **Web Research:** If the user mentions a **web tutorial**, use 'browse_web'.
  *   **Automation:** If asked to automate Blender, use 'run_blender_script'.
  `;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, scanProgress, onboardingState, activeTool]);

  const performSystemScan = () => {
    // Prevent double scanning
    if (onboardingState === 'scanning' || onboardingState === 'integrating') return;

    setOnboardingState('scanning');
    setScanProgress(0);
    
    // Scan simulation: If Bridge is active, it's faster and finds more
    const speed = isBridgeActive ? 20 : 60;
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        setScanProgress(progress);
        if (progress >= 100) {
            clearInterval(interval);
            const foundApps: DetectedApp[] = [
                { id: '1', name: 'Blender 4.2', category: '3D', checked: true },
                { id: '2', name: 'Creation Kit (FO4)', category: 'Game Dev', checked: true },
                { id: '3', name: 'GIMP 3.0.4', category: '2D Art', checked: true },
                { id: '4', name: 'PhotoDemon', category: 'Photo Editing', checked: true },
                { id: '5', name: 'AMUSE (AMD AI)', category: 'Generative AI', checked: true },
                { id: '6', name: 'NifSkope', category: 'Utility', checked: true },
            ];
            
            // Bridge finds extra stuff
            // Always show these if bridge is active to simulate deep integration
            if (isBridgeActive || localStorage.getItem('mossy_bridge_active') === 'true') {
                foundApps.push({ id: '7', name: 'Ollama (Local LLM)', category: 'AI Service', checked: true });
                foundApps.push({ id: '8', name: 'VS Code', category: 'Development', checked: true });
                foundApps.push({ id: '9', name: 'Mod Organizer 2', category: 'Manager', checked: true });
            }

            setDetectedApps(foundApps);
            setOnboardingState('integrating');
            
            const msgText = (isBridgeActive || localStorage.getItem('mossy_bridge_active') === 'true')
              ? "**Deep Scan Complete.** The Desktop Bridge allowed me to find additional development tools including local AI services."
              : "**Scan Complete!** I found these tools on your system. Please confirm which ones you want me to link with.";
              
            setMessages(prev => [...prev, {
                id: 'scan-done',
                role: 'model',
                text: msgText
            }]);
        }
    }, speed);
  };

  const handleIntegrate = () => {
      setOnboardingState('ready');
      const activeApps = detectedApps.filter(a => a.checked).map(a => a.name).join(', ');
      
      setMessages(prev => [...prev, {
          id: 'integrated',
          role: 'model',
          text: `Linked successfully with: **${activeApps}**.\n\nNow, what would you like to do first?`
      }]);
  };

  const handleStartProject = () => {
      setOnboardingState('project_setup');
      setMessages(prev => [...prev, {
          id: 'proj-start',
          role: 'model',
          text: "Okay, let's start a **New Project**. I'll create a separate file for it.\n\n**What is this project about?**\n(e.g., 'A rusty sword mod', 'Fixing old family photos')"
      }]);
  };

  const createProjectFile = (description: string) => {
      const newProject: ProjectData = {
          name: description.length > 30 ? description.substring(0, 30) + "..." : description,
          status: 'Initializing',
          notes: description,
          timestamp: new Date().toLocaleDateString(),
          keyDecisions: []
      };
      setProjectData(newProject);
      setProjectContext(description);
      setShowProjectPanel(true);
      return newProject;
  };

  const executeTool = async (name: string, args: any) => {
      setActiveTool({ id: Date.now().toString(), toolName: name, args, status: 'running' });
      
      // Simulate execution time
      await new Promise(r => setTimeout(r, 1500));

      let result = "Success";
      if (name === 'list_files') {
          result = "Files in " + args.path + ":\n- MyMod.esp\n- Textures/\n- Scripts/";
      } else if (name === 'read_file') {
          result = `Content of ${args.path}:\n[FILE_CONTENT_STREAM_OPEN]\n...\n(Simulated content of tutorial/script)\n...`;
      } else if (name === 'browse_web') {
          result = `Content of ${args.url}:\n[WEB_SCRAPER_OUTPUT]\n...\n(Simulated parsed HTML/text content)\n...`;
      } else if (name === 'recommend_software') {
          // Intelligent recommendation logic simulation
          const ctx = args.context?.toLowerCase() || "";
          if (ctx.includes("fallout") || ctx.includes("skyrim")) {
              result = `Scanning installed software for ${args.category}...\n
              DETECTED:\n- Mod Organizer 2 (Recommended Manager)\n- NifSkope (Mesh Editor)\n- Blender 4.2 (3D Suite)\n
              MISSING / RECOMMENDED:\n- xEdit (Critical for data editing)\n- Outfit Studio (For body conversions)`;
          } else {
              result = `General recommendation for ${args.category}: VS Code (Detected), Git (Detected).`;
          }
      } else if (name === 'control_interface') {
          // Dispatch event to App.tsx
          window.dispatchEvent(new CustomEvent('mossy-control', { 
              detail: { action: args.action, payload: { path: args.target } } 
          }));
          result = `Executed UI Control: ${args.action} -> ${args.target || 'N/A'}`;
      } else if (name === 'run_blender_script') {
          result = "Script executed on active Blender Object. Vertex count updated.";
      } else if (name === 'system_diagnostic') {
          result = "CPU: 14% | RAM: 8.2GB Used | GPU: 32% (Idle)";
      }

      setActiveTool(prev => prev ? { ...prev, status: 'success', result } : null);
      
      // Clear visual tool after a delay, but keep history logic
      setTimeout(() => {
          setActiveTool(null);
      }, 3000);

      return result;
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if ((!textToSend.trim() && !selectedFile) || isLoading) return;

    // --- Onboarding Logic ---
    if (onboardingState === 'init') {
        const txt = textToSend.toLowerCase();
        if (txt.includes('yes') || txt.includes('ok') || txt.includes('start') || txt.includes('scan')) {
            setInputText('');
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: textToSend }]);
            performSystemScan();
            return;
        }
    }

    // --- Message Setup ---
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      images: selectedFile ? [URL.createObjectURL(selectedFile)] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    // Stop any existing audio when user sends new message
    stopAudio();

    // --- Project Creation ---
    if (onboardingState === 'project_setup') {
        createProjectFile(textToSend);
        setOnboardingState('ready');
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let contents: any = [{ role: 'user', parts: [] }];
      
      if (selectedFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
        const base64Data = base64.split(',')[1];
        contents[0].parts.push({
          inlineData: { mimeType: selectedFile.type, data: base64Data }
        });
      }
      
      contents[0].parts.push({ text: textToSend });

      // Build History
      const history = messages
        .filter(m => m.role !== 'system' && !m.text.includes("Scan Complete")) 
        .map(m => ({
            role: m.role,
            parts: m.images ? [{ text: m.text }] : [{ text: m.text }] 
        }));

      // REFRESH SYSTEM PROMPT WITH LATEST PROJECT STATE
      const dynamicInstruction = systemInstruction;

      const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: dynamicInstruction,
          tools: isBridgeActive ? [{functionDeclarations: toolDeclarations}] : [{ googleSearch: {} }],
        },
        history: history
      });

      const result = await chat.sendMessage({ message: contents[0].parts });
      
      // Handle Function Calls
      const calls = result.functionCalls;
      let responseText = result.text;

      if (calls && calls.length > 0) {
          for (const call of calls) {
              const toolResult = await executeTool(call.name, call.args);
              
              // Send result back to model
              const toolResponse = await chat.sendMessage({
                  message: [{
                      functionResponse: {
                          name: call.name,
                          response: { result: toolResult }
                      }
                  }]
              });
              responseText = toolResponse.text;
          }
      }

      const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'Source',
        uri: c.web?.uri
      })).filter((s: any) => s.uri);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I'm processing...",
        sources
      };

      setMessages(prev => [...prev, botMessage]);

      // --- Trigger Voice Output ---
      if (isVoiceEnabled && responseText) {
          speakText(responseText);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `**System Error:** ${error instanceof Error ? error.message : 'Unknown error.'}`
      }]);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-forge-dark text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-forge-panel">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Leaf className="text-emerald-400" />
            Mossy
            </h2>
            {/* Bridge Status Indicator */}
            {isBridgeActive ? (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-xs animate-fade-in">
                    <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span className="text-emerald-300">Connected</span>
                </div>
            ) : (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs opacity-50">
                    <Wifi className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-400">Localhost Disconnected</span>
                </div>
            )}
            
            {projectContext && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-600 text-xs">
                    <FolderOpen className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-100 max-w-[150px] truncate">{projectContext}</span>
                </div>
            )}
        </div>
        <div className="flex gap-2 items-center">
            
            {/* Game Context Selector */}
            <div className="hidden xl:flex items-center gap-2 mr-2 bg-slate-900 rounded-lg p-1 border border-slate-700">
                <Gamepad2 className="w-4 h-4 text-slate-400 ml-2" />
                <select 
                    value={gameContext}
                    onChange={(e) => setGameContext(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 font-bold outline-none cursor-pointer"
                >
                    <option value="General">General Modding</option>
                    <option value="Fallout 4">Fallout 4</option>
                    <option value="Skyrim SE">Skyrim SE</option>
                    <option value="Cyberpunk 2077">Cyberpunk 2077</option>
                    <option value="Starfield">Starfield</option>
                </select>
            </div>

            {/* Voice Toggle */}
            <button
                onClick={toggleVoiceMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    isVoiceEnabled 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
            >
                {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {isVoiceEnabled ? 'Voice Mode: ON' : 'Voice Mode: OFF'}
            </button>
            
            <button 
                onClick={resetMemory} 
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                title="Wipe Memory & Reset"
            >
                <Trash2 className="w-4 h-4" />
            </button>
            <button 
                onClick={() => setShowProjectPanel(!showProjectPanel)}
                className={`p-2 rounded transition-colors ${showProjectPanel ? 'text-emerald-400 bg-emerald-900/30' : 'text-slate-400 hover:text-white'}`}
                title="Toggle Project File"
            >
                <FileText className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] lg:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : msg.role === 'system'
                        ? 'bg-slate-800 border border-slate-700 text-slate-400 text-sm'
                        : 'bg-forge-panel border border-slate-700 rounded-tl-none'
                    }`}>
                    {msg.images && msg.images.map((img, i) => (
                        <img key={i} src={img} alt="Uploaded" className="max-w-full h-auto rounded mb-2 border border-black/20" />
                    ))}
                    <div className="markdown-body text-sm leading-relaxed">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>

                    {/* Scan UI Overlay */}
                    {onboardingState === 'scanning' && msg.role === 'model' && msg.text.includes("Scan") && (
                        <div className="mt-4 bg-slate-900 rounded-lg p-3 border border-slate-700 animate-slide-up">
                            <div className="flex justify-between text-xs mb-1 text-emerald-400 font-mono">
                                <span>SYSTEM SCAN</span>
                                <span>{scanProgress}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${scanProgress}%` }}></div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 font-mono truncate">
                                Scanning: C:/Program Files/ (Depth: 3)...
                            </div>
                        </div>
                    )}

                    {/* Integration UI */}
                    {onboardingState === 'integrating' && msg.role === 'model' && msg.text.includes("Scan Complete") && (
                        <div className="mt-4 bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-inner animate-slide-up">
                            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <Search className="w-3 h-3" /> Detected Tools
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                {detectedApps.map(app => (
                                    <label key={app.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${app.checked ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-transparent hover:border-slate-600'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={app.checked}
                                            onChange={() => {
                                                setDetectedApps(apps => apps.map(a => a.id === app.id ? {...a, checked: !a.checked} : a));
                                            }}
                                            className="w-3 h-3 rounded border-slate-600 text-emerald-500 focus:ring-0 bg-slate-700"
                                        />
                                        <span className="text-xs font-medium text-slate-200">{app.name}</span>
                                    </label>
                                ))}
                            </div>
                            <button 
                                onClick={handleIntegrate}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors"
                            >
                                Link & Integrate
                            </button>
                        </div>
                    )}

                    {/* Quick Start Buttons */}
                    {msg.id === 'integrated' && onboardingState === 'ready' && !projectContext && (
                        <div className="mt-4 flex flex-col gap-2">
                            <button onClick={handleStartProject} className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-500/50 rounded-xl text-left transition-all group">
                                <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30">
                                    <FolderOpen className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Start Mod Project</div>
                                    <div className="text-xs text-slate-500">Create a separate workspace file</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-emerald-400" />
                            </button>
                            <button onClick={() => handleSend("I want to edit an image.")} className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 rounded-xl text-left transition-all group">
                                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30">
                                    <CheckSquare className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Quick Task</div>
                                    <div className="text-xs text-slate-500">Edit an image or ask a question</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-blue-400" />
                            </button>
                        </div>
                    )}
                    
                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600/50 text-xs flex flex-wrap gap-2">
                            {msg.sources.map((s, idx) => (
                            <a key={idx} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-black/20 hover:bg-black/40 px-2 py-1 rounded text-emerald-300 truncate max-w-[150px]">
                                <Globe className="w-3 h-3" /> {s.title}
                            </a>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
                ))}
                
                {/* Visual Tool Execution */}
                {activeTool && (
                    <div className="flex justify-start animate-slide-up">
                        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl rounded-tl-none p-4 max-w-[85%] shadow-lg shadow-emerald-900/10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    {activeTool.toolName.includes('blender') ? <Box className="w-4 h-4 text-emerald-400" /> : 
                                     activeTool.toolName.includes('control') ? <Layout className="w-4 h-4 text-purple-400" /> :
                                     <Terminal className="w-4 h-4 text-emerald-400" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bridge Command Active</div>
                                    <div className="text-sm font-mono text-white">{activeTool.toolName}</div>
                                </div>
                                {activeTool.status === 'running' && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin ml-auto" />}
                                {activeTool.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
                            </div>
                            
                            <div className="bg-black/50 rounded border border-slate-700/50 p-2 font-mono text-xs text-slate-300 overflow-x-auto mb-2">
                                <span className="text-emerald-500">$</span> {JSON.stringify(activeTool.args)}
                            </div>

                            {activeTool.result && (
                                <div className="text-xs text-emerald-300/80 border-l-2 border-emerald-500/50 pl-2 mt-2 whitespace-pre-wrap">
                                    {'>'} {activeTool.result}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isLoading && !activeTool && (
                    <div className="flex justify-start">
                        <div className="bg-forge-panel border border-slate-700 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 shadow-sm">
                        <Loader2 className="animate-spin text-emerald-400 w-4 h-4" />
                        <span className="text-slate-400 text-sm font-medium animate-pulse">Mossy is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Smart Step Controls - Only show when a project is active */}
            {projectContext && !isLoading && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                     <button onClick={() => handleSend("Done with that step. What is next?")} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/50 rounded-full text-xs text-emerald-200 font-medium whitespace-nowrap transition-colors">
                        <CheckCircle2 className="w-3 h-3" /> Done, Next Step
                     </button>
                     <button onClick={() => handleSend("Wait, I need more time. Hold on.")} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-xs text-slate-300 font-medium whitespace-nowrap transition-colors">
                        <PauseCircle className="w-3 h-3" /> Wait
                     </button>
                     <button onClick={() => handleSend("I don't understand that step. Can you explain it in more detail?")} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-xs text-slate-300 font-medium whitespace-nowrap transition-colors">
                        <HelpCircle className="w-3 h-3" /> Explain Again
                     </button>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-forge-panel border-t border-slate-700 z-10">
                {selectedFile && (
                <div className="flex items-center gap-2 mb-2 bg-slate-800 p-2 rounded-lg w-fit text-sm border border-slate-600">
                    <div className="bg-slate-700 p-1 rounded">
                        <FileText className="w-4 h-4 text-slate-300" />
                    </div>
                    <span className="truncate max-w-[200px] text-slate-200">{selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="hover:text-red-400 p-1 rounded-full hover:bg-slate-700">
                        <X className="w-3 h-3" />
                    </button>
                </div>
                )}
                
                {/* Voice Status Indicator */}
                {(isListening || isPlayingAudio) && (
                    <div className="flex items-center gap-3 mb-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50 w-fit">
                        {isListening && (
                            <span className="flex items-center gap-2 text-xs text-red-400 animate-pulse font-medium">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                Listening...
                            </span>
                        )}
                        {isPlayingAudio && (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                                    <Volume2 className="w-3 h-3" />
                                    Speaking...
                                </span>
                                <button 
                                    onClick={stopAudio}
                                    className="p-1 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                    title="Stop Speaking"
                                >
                                    <StopCircle className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-2">
                <label className="p-3 hover:bg-slate-700 rounded-xl cursor-pointer text-slate-400 transition-colors border border-transparent hover:border-slate-600">
                    <input 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                    accept="image/*,application/pdf,text/*"
                    />
                    <Paperclip className="w-5 h-5" />
                </label>
                
                {/* Microphone Button */}
                <button
                    onClick={startListening}
                    disabled={isListening}
                    className={`p-3 rounded-xl transition-all border ${
                        isListening 
                        ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse' 
                        : 'bg-slate-800 text-slate-400 hover:text-white border-transparent hover:border-slate-600 hover:bg-slate-700'
                    }`}
                    title="Speak to Mossy"
                >
                    <Mic className="w-5 h-5" />
                </button>

                <input
                    type="text"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors text-slate-100 placeholder-slate-500"
                    placeholder={onboardingState === 'project_setup' ? "Name your project..." : isListening ? "Listening..." : isBridgeActive ? "Command System (e.g. 'Read tutorial.pdf')..." : "Message Mossy..."}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                    onClick={() => handleSend()}
                    disabled={isLoading || (!inputText && !selectedFile)}
                    className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-lg shadow-emerald-900/20"
                >
                    <Send className="w-5 h-5" />
                </button>
                </div>
            </div>
        </div>
    );
};