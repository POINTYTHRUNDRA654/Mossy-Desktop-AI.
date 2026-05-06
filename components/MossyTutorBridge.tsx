import React, { useState, useEffect, useRef } from 'react';
import {
    Link2, Link2Off, Cpu, Monitor, Send, RefreshCw,
    MessageSquare, Share2, Database, Zap, AlertCircle, CheckCircle2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface ServiceStatus {
    status: 'online' | 'offline' | 'checking';
    version?: string;
    service?: string;
    model?: string;
}

interface TutorStatus {
    bridge: ServiceStatus;
    chat: ServiceStatus;
}

interface HardwareInfo {
    os?: string;
    cpu?: string;
    ram?: number;
    gpu?: string;
    python?: string;
    status?: string;
}

interface ChatMessage {
    id: string;
    role: 'mossy' | 'tutor' | 'system';
    content: string;
    timestamp: string;
    model?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const electronAPI = (window as any).electronAPI;

function ipcInvoke(channel: string, ...args: any[]): Promise<any> {
    return electronAPI?.ipcInvoke?.(channel, ...args) ?? Promise.resolve({ error: 'Electron API unavailable' });
}

const SYSTEM_PROMPT_MOSSY = `You are Mossy AI, a desktop AI assistant specialising in Fallout 4 modding. \
You are communicating with Desktop Tutor (another Mossy instance) to exchange knowledge and help each other grow. \
Be concise, helpful, and share any relevant insights you have.`;

// ── Status Dot ─────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: ServiceStatus['status'] }> = ({ status }) => {
    const colours: Record<string, string> = {
        online: 'bg-emerald-400 shadow-emerald-400/50',
        offline: 'bg-red-500',
        checking: 'bg-yellow-400 animate-pulse',
    };
    return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colours[status] ?? colours.offline}`} />;
};

// ── Main Component ─────────────────────────────────────────────────────────

const MossyTutorBridge: React.FC = () => {
    const [tutorStatus, setTutorStatus] = useState<TutorStatus>({
        bridge: { status: 'checking' },
        chat:   { status: 'checking' },
    });
    const [hardware, setHardware] = useState<HardwareInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '0',
            role: 'system',
            content: 'Bridge initialised. Both Mossy instances can now communicate and share knowledge.',
            timestamp: new Date().toLocaleTimeString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [tab, setTab] = useState<'chat' | 'hardware' | 'knowledge'>('chat');
    const [knowledgeTopic, setKnowledgeTopic] = useState('');
    const [knowledgeContent, setKnowledgeContent] = useState('');
    const [knowledgeSent, setKnowledgeSent] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversationRef = useRef<ChatMessage[]>(messages);

    useEffect(() => {
        conversationRef.current = messages;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Poll connection status
    const checkStatus = async () => {
        setChecking(true);
        const result = await ipcInvoke('tutor:status');
        setTutorStatus({
            bridge: result?.bridge ?? { status: 'offline' },
            chat:   result?.chat   ?? { status: 'offline' },
        });
        setChecking(false);
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10_000);
        return () => clearInterval(interval);
    }, []);

    // Load hardware info when bridge is online
    useEffect(() => {
        if (tutorStatus.bridge.status === 'online') {
            ipcInvoke('tutor:get-hardware').then((hw: HardwareInfo) => setHardware(hw));
        }
    }, [tutorStatus.bridge.status]);

    // ── Send a message from Mossy AI → Desktop Tutor ──────────────────────

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending) return;
        if (tutorStatus.chat.status !== 'online') {
            addMessage('system', '⚠ Desktop Tutor chat backend is offline. Start the desktop-tutorial backend first.');
            return;
        }

        setInput('');
        setSending(true);
        addMessage('mossy', text);

        // Build conversation history for context
        const history = conversationRef.current
            .filter(m => m.role === 'mossy' || m.role === 'tutor')
            .slice(-8)
            .map(m => ({ role: m.role === 'mossy' ? 'user' : 'assistant', content: m.content }));

        const messages_payload = [
            { role: 'system', content: SYSTEM_PROMPT_MOSSY },
            ...history,
            { role: 'user', content: text },
        ];

        const result = await ipcInvoke('tutor:chat', { messages: messages_payload });

        if (result?.ok === false) {
            addMessage('system', `❌ Error from Desktop Tutor: ${result.error}`);
        } else {
            addMessage('tutor', result?.text ?? '(No response)', result?.model);
        }

        setSending(false);
    };

    const addMessage = (role: ChatMessage['role'], content: string, model?: string) => {
        const msg: ChatMessage = {
            id: String(Date.now()),
            role,
            content,
            timestamp: new Date().toLocaleTimeString(),
            model,
        };
        setMessages(prev => [...prev, msg]);
    };

    // ── Share knowledge with the collaboration service ────────────────────

    const shareKnowledge = async () => {
        if (!knowledgeTopic.trim() || !knowledgeContent.trim()) return;
        const result = await ipcInvoke('tutor:share-knowledge', {
            topic: knowledgeTopic.trim(),
            content: knowledgeContent.trim(),
        });
        if (result?.status !== 'error') {
            setKnowledgeSent(true);
            setKnowledgeTopic('');
            setKnowledgeContent('');
            setTimeout(() => setKnowledgeSent(false), 3000);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────

    const bridgeOnline = tutorStatus.bridge.status === 'online';
    const chatOnline   = tutorStatus.chat.status   === 'online';

    return (
        <div className="flex flex-col h-full bg-[#050910] text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Link2 className="w-7 h-7 text-purple-400" />
                        {bridgeOnline && chatOnline && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-none">Mossy Tutor Bridge</h1>
                        <p className="text-xs text-slate-500 mt-0.5">Two Mossies, one shared mind</p>
                    </div>
                </div>

                <button
                    onClick={checkStatus}
                    disabled={checking}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Connection status bar */}
            <div className="flex gap-4 px-6 py-3 bg-slate-900/50 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                    <StatusDot status={tutorStatus.bridge.status} />
                    <span className="text-slate-400">Bridge <span className="text-slate-300 font-mono">:21337</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <StatusDot status={tutorStatus.chat.status} />
                    <span className="text-slate-400">AI Chat <span className="text-slate-300 font-mono">:8787</span></span>
                </div>
                {bridgeOnline && (
                    <div className="flex items-center gap-1 text-emerald-400 ml-auto">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Desktop Tutor bridge online
                    </div>
                )}
                {!bridgeOnline && (
                    <div className="flex items-center gap-1 text-slate-500 ml-auto">
                        <Link2Off className="w-3.5 h-3.5" />
                        Run <code className="mx-1 bg-slate-800 px-1 rounded">python mossy_server.py</code> in desktop-tutorial
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800">
                {([
                    { key: 'chat',      icon: MessageSquare, label: 'Inter-Mossy Chat' },
                    { key: 'hardware',  icon: Cpu,           label: 'Tutor Hardware' },
                    { key: 'knowledge', icon: Database,       label: 'Share Knowledge' },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition
                            ${tab === t.key
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Chat Tab ──────────────────────────────────────────── */}
            {tab === 'chat' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'mossy' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'system' ? (
                                    <div className="w-full text-center text-xs text-slate-600 py-1">{msg.content}</div>
                                ) : (
                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
                                        ${msg.role === 'mossy'
                                            ? 'bg-purple-600/30 border border-purple-500/30 text-slate-200 rounded-br-sm'
                                            : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-semibold ${msg.role === 'mossy' ? 'text-purple-400' : 'text-emerald-400'}`}>
                                                {msg.role === 'mossy' ? '🤖 Mossy AI' : '🎓 Desktop Tutor'}
                                            </span>
                                            {msg.model && <span className="text-xs text-slate-600 font-mono">{msg.model}</span>}
                                            <span className="text-xs text-slate-600 ml-auto">{msg.timestamp}</span>
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <span key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="px-6 py-3 border-t border-slate-800">
                        {!chatOnline && (
                            <p className="text-xs text-yellow-500 mb-2 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Desktop Tutor AI backend is offline. Messages won't be answered until it's running.
                            </p>
                        )}
                        <div className="flex gap-3">
                            <input
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
                                placeholder={chatOnline ? 'Ask Desktop Tutor something…' : 'Start desktop-tutorial backend to chat…'}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={sending || !input.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-sm font-medium transition"
                            >
                                <Send className="w-4 h-4" />
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Hardware Tab ──────────────────────────────────────── */}
            {tab === 'hardware' && (
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {!bridgeOnline ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                            <Link2Off className="w-10 h-10" />
                            <p className="text-sm">Desktop Tutor bridge is offline</p>
                            <code className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg">python mossy_server.py</code>
                        </div>
                    ) : hardware ? (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Operating System', value: hardware.os, icon: Monitor },
                                { label: 'CPU',              value: hardware.cpu, icon: Cpu },
                                { label: 'RAM',              value: hardware.ram ? `${hardware.ram} GB` : undefined, icon: Zap },
                                { label: 'GPU',              value: hardware.gpu, icon: Zap },
                                { label: 'Python',           value: hardware.python, icon: Database },
                            ].map(row => (
                                <div key={row.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1 text-slate-500">
                                        <row.icon className="w-3.5 h-3.5" />
                                        <span className="text-xs uppercase tracking-wider">{row.label}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium truncate">{row.value ?? '—'}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-600 text-sm text-center mt-20">Loading hardware info…</p>
                    )}
                </div>
            )}

            {/* ── Knowledge Tab ─────────────────────────────────────── */}
            {tab === 'knowledge' && (
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <p className="text-xs text-slate-500 mb-4">
                        Contribute knowledge to the shared Chroma knowledge base so both Mossy instances can learn from it.
                    </p>
                    <div className="space-y-4 max-w-xl">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Topic</label>
                            <input
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
                                placeholder="e.g. Mod Load Order Basics"
                                value={knowledgeTopic}
                                onChange={e => setKnowledgeTopic(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Knowledge Content</label>
                            <textarea
                                rows={6}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition resize-none"
                                placeholder="Share what you know…"
                                value={knowledgeContent}
                                onChange={e => setKnowledgeContent(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={shareKnowledge}
                            disabled={!knowledgeTopic.trim() || !knowledgeContent.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl text-sm font-medium transition"
                        >
                            <Share2 className="w-4 h-4" />
                            Share with Both Mossies
                        </button>
                        {knowledgeSent && (
                            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Knowledge added to shared base — both Mossies can now learn from it.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MossyTutorBridge;
