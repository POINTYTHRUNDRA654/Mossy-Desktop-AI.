import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Lightbulb, Search, MessageSquare } from 'lucide-react';

interface TutorResponse {
    answer: string;
    sources: any[];
    agentReasons?: string;
    agentsConsulted?: string[];
}

export default function FalloutTutor() {
    const [topic, setTopic] = useState('');
    const [response, setResponse] = useState<TutorResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAgentReasoning, setShowAgentReasoning] = useState(false);
    const [agentsOnline, setAgentsOnline] = useState<string[]>([]);

    // Cold start: Discover available agents
    useEffect(() => {
        const discoverAgents = async () => {
            try {
                const result = await window.electronAPI?.ipcInvoke('agent:discover');
                const online = Object.keys(result || {})
                    .filter((agent) => result[agent]?.status === 'online')
                    .map((a) => a.replace('-', ' ').toUpperCase());
                setAgentsOnline(online);
            } catch (err) {
                console.error('Discovery failed:', err);
            }
        };

        discoverAgents();
        const interval = setInterval(discoverAgents, 10000);
        return () => clearInterval(interval);
    }, []);

    const askTutor = async () => {
        if (!topic.trim()) return;

        setLoading(true);
        setResponse(null);

        try {
            // First, ask Desktop AI (main tutor)
            const tutorResponse = await window.electronAPI?.ipcInvoke('gemma:rag-query', {
                question: topic,
            });

            // Then, ask AI-Helper for system-level knowledge
            const helperResponse = await window.electronAPI?.ipcInvoke('agent:query', {
                fromAgent: 'desktop-ai',
                toAgent: 'ai-helper',
                question: topic,
                context: tutorResponse?.text,
            });

            // Validate the answer with other agents
            const validation = await window.electronAPI?.ipcInvoke('agent:validate-answer', {
                question: topic,
                answer: tutorResponse?.text || '',
                answeringAgent: 'desktop-ai',
            });

            // Combine responses
            const combinedAnswer = `
${tutorResponse?.text || 'No response from tutor'}

${helperResponse?.answer ? `\n**Additional System Context:**\n${helperResponse.answer}` : ''}
      `.trim();

            setResponse({
                answer: combinedAnswer,
                sources: [...(tutorResponse?.sources || []), ...(helperResponse?.sources || [])],
                agentReasons: validation?.consensus_score ? `Agents agreed on answer quality: ${(validation.consensus_score * 100).toFixed(0)}%` : undefined,
                agentsConsulted: ['Desktop AI', 'AI Helper', 'Mossy Manager'],
            });

            // If confidence is low, propose an improvement
            if (validation?.improvement_proposed) {
                await window.electronAPI?.ipcInvoke('agent:trigger-improvement');
            }
        } catch (err) {
            setResponse({
                answer: `Error: ${String(err)}`,
                sources: [],
            });
        } finally {
            setLoading(false);
        }
    };

    const falloutTopics = [
        'Load order management and conflicts',
        'Mod compatibility patches',
        'Texture and performance optimization',
        'Script lag causes and solutions',
        'ENB and shader modding',
        'Merging and consolidating plugins',
        'Navmesh and cell editing',
        'Custom faction and quest modding',
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-white">Fallout 4 Modding Tutor</h1>
                            <p className="text-amber-200">Powered by Multi-Agent AI Expertise</p>
                        </div>
                    </div>

                    {/* Agent Status */}
                    <div className="flex gap-2 flex-wrap">
                        {agentsOnline.length > 0 ? (
                            agentsOnline.map((agent) => (
                                <span key={agent} className="px-3 py-1 bg-green-900 text-green-200 rounded-full text-xs font-semibold flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                                    {agent}
                                </span>
                            ))
                        ) : (
                            <span className="px-3 py-1 bg-red-900 text-red-200 rounded-full text-xs font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                                Starting agents...
                            </span>
                        )}
                    </div>
                </div>

                {/* Search Box */}
                <div className="mb-8 space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && askTutor()}
                            placeholder="Ask about Fallout 4 modding (load order, conflicts, optimization...)..."
                            className="w-full px-6 py-4 bg-slate-800 border-2 border-amber-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                        />
                        <button
                            onClick={askTutor}
                            disabled={loading}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-semibold rounded transition flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⟳</span> Thinking
                                </>
                            ) : (
                                <>
                                    <Lightbulb className="w-5 h-5" /> Ask
                                </>
                            )}
                        </button>
                    </div>

                    {/* Suggested Topics */}
                    <div className="flex gap-2 flex-wrap">
                        {falloutTopics.map((t) => (
                            <button
                                key={t}
                                onClick={() => {
                                    setTopic(t);
                                }}
                                className="px-3 py-1 bg-amber-800 hover:bg-amber-700 text-amber-100 text-sm rounded-full transition"
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Response */}
                {response && (
                    <div className="space-y-4 mb-8">
                        {/* Main Answer */}
                        <div className="bg-slate-800 rounded-lg p-6 border-2 border-amber-700 shadow-lg">
                            <h3 className="text-lg font-semibold text-amber-200 mb-4 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5" />
                                Expert Answer
                            </h3>
                            <div className="text-white whitespace-pre-wrap leading-relaxed text-base">
                                {response.answer}
                            </div>
                        </div>

                        {/* Agent Reasoning */}
                        {response.agentReasons && (
                            <div
                                onClick={() => setShowAgentReasoning(!showAgentReasoning)}
                                className="bg-slate-700 rounded-lg p-4 border border-slate-600 cursor-pointer hover:border-amber-600 transition"
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Agent Consensus
                                    </h4>
                                    <span className="text-amber-400">{response.agentReasons}</span>
                                </div>

                                {showAgentReasoning && (
                                    <div className="mt-3 pt-3 border-t border-slate-600 text-sm text-slate-300 space-y-2">
                                        <p>
                                            <strong>Desktop AI:</strong> Fallout 4 modding specialist - provided primary answer
                                        </p>
                                        <p>
                                            <strong>AI Helper:</strong> System expert - verified system-level aspects
                                        </p>
                                        <p>
                                            <strong>Mossy Manager:</strong> Mod expert - validated against known conflicts/solutions
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sources */}
                        {response.sources && response.sources.length > 0 && (
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    Knowledge Sources
                                </h4>
                                <div className="space-y-2">
                                    {response.sources.slice(0, 5).map((source, idx) => (
                                        <div key={idx} className="text-sm text-slate-300 p-2 bg-slate-700 rounded">
                                            <p className="font-medium text-amber-200">{source.metadata?.topic || 'Unknown'}</p>
                                            <p className="text-xs text-slate-400 mt-1">{source.content?.substring(0, 100)}...</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Source: {source.metadata?.agent || 'Unknown'} • Confidence: {((source.metadata?.confidence || 0.8) * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Continuous Improvement Notice */}
                <div className="bg-blue-900 border border-blue-600 rounded-lg p-4 flex gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                        <strong>Continuous Learning:</strong> Each time you ask a question, the agents learn from each other's answers
                        and improve their knowledge base. Over time, they become better tutors!
                    </div>
                </div>
            </div>
        </div>
    );
}
