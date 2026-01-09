import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, ArrowRight, X, Monitor, Command, Layout, ChevronRight, Package, Terminal, Pause, Play, Mic2, BrainCircuit, Layers } from 'lucide-react';

interface TutorialStep {
    id: string;
    title: string;
    content: React.ReactNode;
    targetId?: string; // ID of element to highlight
    position?: 'center' | 'left' | 'right' | 'top' | 'bottom';
}

const TutorialOverlay: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Initialize step from storage to enable "Resume" capability
    const [currentStep, setCurrentStep] = useState(() => {
        const saved = localStorage.getItem('mossy_tutorial_step');
        return saved ? parseInt(saved, 10) : 0;
    });
    
    const [installProgress, setInstallProgress] = useState(0);

    // Persist step whenever it changes
    useEffect(() => {
        localStorage.setItem('mossy_tutorial_step', currentStep.toString());
    }, [currentStep]);

    useEffect(() => {
        // Check if first time visit
        const hasSeenTutorial = localStorage.getItem('mossy_tutorial_completed') === 'true';
        if (!hasSeenTutorial) {
            setTimeout(() => setIsOpen(true), 1000);
        }

        // Listen for manual trigger
        const handleTrigger = () => {
            const isCompleted = localStorage.getItem('mossy_tutorial_completed') === 'true';
            
            if (isCompleted) {
                // If previously completed, restart from beginning
                setCurrentStep(0);
                setInstallProgress(0);
                localStorage.removeItem('mossy_tutorial_completed');
                localStorage.setItem('mossy_tutorial_step', '0');
            }
            
            setIsOpen(true);
        };
        window.addEventListener('start-tutorial', handleTrigger);
        return () => window.removeEventListener('start-tutorial', handleTrigger);
    }, []);

    // Installation Simulation & Bridge Connection Logic
    useEffect(() => {
        if (currentStep === 1 && isOpen) {
            // Reset progress if we are entering this step (e.g. resuming)
            setInstallProgress(0);
            
            const interval = setInterval(() => {
                setInstallProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        
                        // --- CRITICAL FIX: Actually activate the bridge ---
                        localStorage.setItem('mossy_bridge_active', 'true');
                        // Dispatch event so Sidebar/Chat update immediately without refresh
                        window.dispatchEvent(new Event('storage'));
                        window.dispatchEvent(new CustomEvent('mossy-bridge-connected'));
                        
                        return 100;
                    }
                    return prev + 1; // Slower, more realistic install
                });
            }, 40);
            return () => clearInterval(interval);
        }
    }, [currentStep, isOpen]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleFinish();
        }
    };

    const handleFinish = () => {
        setIsOpen(false);
        localStorage.setItem('mossy_tutorial_completed', 'true');
        setCurrentStep(0); 
    };

    const handlePause = () => {
        setIsOpen(false);
    };

    const steps: TutorialStep[] = [
        {
            id: 'welcome',
            title: 'Welcome to Mossy',
            position: 'center',
            content: (
                <div className="text-center">
                    <p className="text-slate-300 mb-6">
                        You have activated the <span className="text-emerald-400 font-bold">OmniForge Neural Interface</span>.
                        Mossy is an AI companion designed to integrate deeply with your OS, analyze files, and assist with complex creative workflows.
                    </p>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-left mb-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <span className="font-bold text-white">Updated System Requirements</span>
                        </div>
                        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                            <li>Windows 10/11 or Linux Kernel 5.15+</li>
                            <li>16GB RAM (32GB Recommended for Local LLM)</li>
                            <li>NVIDIA GPU (RTX 20-series or newer supported)</li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 'install',
            title: 'Installing Desktop Bridge',
            position: 'center',
            content: (
                <div className="w-full">
                    <p className="text-slate-300 text-sm mb-4">
                        Mossy needs the <strong>Desktop Bridge</strong> to see outside the browser. This allows her to read game files, execute scripts, and manage your local assets.
                    </p>
                    
                    <div className="bg-black p-6 rounded-xl border border-slate-800 mb-4 relative overflow-hidden">
                        {installProgress < 100 ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <Download className="w-8 h-8 text-emerald-500 animate-bounce mb-4" />
                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${installProgress}%` }}></div>
                                </div>
                                <div className="font-mono text-xs text-emerald-400">
                                    Downloading Drivers... {installProgress}%
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4 animate-fade-in">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                                <h4 className="text-white font-bold">Bridge Active</h4>
                                <p className="text-xs text-slate-500 font-mono">Localhost:21337 Connected</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">
                        * In a real deployment, you would run the <code>Mossy_Launcher.bat</code> to achieve this state.
                    </p>
                </div>
            )
        },
        {
            id: 'nav-tour',
            title: 'Neural Navigation',
            targetId: 'sidebar-nav',
            position: 'right',
            content: (
                <div>
                    <p className="text-slate-300 text-sm mb-4">
                        The sidebar is your command center. It changes color based on the active module's "mood" and function.
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-2 bg-slate-800 rounded border border-slate-700">
                            <div className="p-1.5 bg-blue-900/30 rounded text-blue-400"><Terminal className="w-4 h-4"/></div>
                            <div>
                                <div className="text-xs font-bold text-slate-200">The Workshop</div>
                                <div className="text-[10px] text-slate-500">Scripting & Coding IDE</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-slate-800 rounded border border-slate-700">
                            <div className="p-1.5 bg-purple-900/30 rounded text-purple-400"><BrainCircuit className="w-4 h-4"/></div>
                            <div>
                                <div className="text-xs font-bold text-slate-200">The Cortex</div>
                                <div className="text-[10px] text-slate-500">RAG Knowledge Base Manager</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-slate-800 rounded border border-slate-700">
                            <div className="p-1.5 bg-orange-900/30 rounded text-orange-400"><Layers className="w-4 h-4"/></div>
                            <div>
                                <div className="text-xs font-bold text-slate-200">The Organizer</div>
                                <div className="text-[10px] text-slate-500">Mod Load Order Management</div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'workshop-tour',
            title: 'The Workshop',
            position: 'center',
            content: (
                <div>
                    <p className="text-slate-300 text-sm mb-4">
                        <strong>The Workshop</strong> is where you build. It features:
                    </p>
                    <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 mb-4">
                        <li><strong>Code Editor:</strong> A syntax-highlighted editor for Papyrus, Python, and Lua.</li>
                        <li><strong>Visual Graph (The Loom):</strong> A node-based logic editor for quests and dialogue.</li>
                        <li><strong>3D Preview:</strong> Real-time rendering of NIF/OBJ mesh files.</li>
                        <li><strong>Compiler:</strong> One-click compilation and deployment to your game's Data folder.</li>
                    </ul>
                    <div className="p-3 bg-slate-800 rounded border border-slate-700 text-xs text-slate-300 italic">
                        "Mossy can write scripts for you here. Just ask her in the Chat to 'Create a mod that does X', and she will generate the project file."
                    </div>
                </div>
            )
        },
        {
            id: 'live-tour',
            title: 'Live Voice & Hologram',
            position: 'center',
            content: (
                <div>
                    <p className="text-slate-300 text-sm mb-4">
                        Mossy isn't just text. Toggle <strong>Live Mode</strong> (mic icon) to speak with her directly.
                    </p>
                    <div className="flex items-center justify-center py-6">
                        <div className="relative w-20 h-20 rounded-full bg-black border-2 border-emerald-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                            <Mic2 className="w-8 h-8 text-emerald-400 animate-pulse" />
                            <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping-slow"></div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 text-center">
                        The <strong>Live Interface</strong> provides a low-latency voice connection with a reactive holographic visualizer. Perfect for hands-free modding help while you work in Blender or CK.
                    </p>
                </div>
            )
        },
        {
            id: 'cmd-tour',
            title: 'Command Palette',
            targetId: 'root', 
            position: 'center',
            content: (
                <div className="text-center">
                    <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
                        <span className="text-2xl font-bold text-white">⌘K</span>
                    </div>
                    <p className="text-slate-300 text-sm">
                        Power users don't click. Press <strong>Cmd+K</strong> (or Ctrl+K) at any time to open the Command Palette.
                    </p>
                    <p className="text-slate-500 text-xs mt-2">
                        Navigate modules, run system commands, or ask Mossy a question instantly without leaving your current view.
                    </p>
                </div>
            )
        },
        {
            id: 'deploy-tour',
            title: 'Deploy & Test',
            position: 'center',
            content: (
                <div>
                    <p className="text-slate-300 text-sm mb-4">
                        Ready to share your work? Use the <strong>System Monitor</strong> to access the Deployment Center.
                    </p>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-start gap-3">
                        <Package className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                        <div>
                            <h4 className="text-white font-bold text-sm">Build Pipeline</h4>
                            <p className="text-xs text-slate-400 mt-1">Compile your projects and generate installable artifacts.</p>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-start gap-3 mt-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                        <div>
                            <h4 className="text-white font-bold text-sm">Beta Invites</h4>
                            <p className="text-xs text-slate-400 mt-1">Generate access keys for your testers to collaborate.</p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    if (!isOpen) return null;

    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" />

            {/* Spotlight Hole (Visual Trick) */}
            {step.position !== 'center' && (
                <div className={`absolute pointer-events-none transition-all duration-500 border-2 border-emerald-500/50 shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-xl
                    ${step.id === 'nav-tour' ? 'left-0 top-0 bottom-0 w-64 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]' : ''}
                `}></div>
            )}

            {/* Modal Content */}
            <div className={`relative w-full max-w-lg bg-[#0f172a] border border-emerald-500/30 rounded-2xl shadow-2xl p-8 animate-scale-in flex flex-col items-start
                ${step.position === 'right' ? 'ml-72' : ''}
            `}>
                {/* Pause / Close Button */}
                <button 
                    onClick={handlePause}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors flex items-center gap-1 group"
                    title="Pause Tutorial (Progress Saved)"
                >
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Pause & Save</span>
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        {currentStep + 1}
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{step.title}</h2>
                </div>

                <div className="w-full mb-8">
                    {step.content}
                </div>

                <div className="w-full flex justify-between items-center pt-6 border-t border-slate-800">
                    <div className="flex gap-1">
                        {steps.map((s, i) => (
                            <div key={s.id} className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                        ))}
                    </div>
                    <button 
                        onClick={handleNext}
                        disabled={step.id === 'install' && installProgress < 100}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
                    >
                        {currentStep === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;