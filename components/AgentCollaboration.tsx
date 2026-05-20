import React, { useState, useEffect } from 'react';
import { MessageCircle, Brain, Share2, TrendingUp, AlertCircle } from 'lucide-react';

interface AgentStatus {
    name: string;
    endpoint: string;
    status: 'online' | 'offline';
    color: string;
}

interface InterAgentMessage {
    id: string;
    from: string;
    to: string;
    question: string;
    answer: string;
    confidence: number;
    timestamp: string;
}

interface KnowledgeEntry {
    id: string;
    topic: string;
    content: string;
    agent: string;
    confidence: number;
    verified_by?: string;
}

export default function AgentCollaboration() {
    const [agents, setAgents] = useState<AgentStatus[]>([
        { name: 'Mossy AI (Tutor)', endpoint: 'localhost:8000', status: 'offline', color: 'bg-purple-500' },
        { name: 'Desktop Tutor',    endpoint: 'localhost:21337 / :8787', status: 'offline', color: 'bg-emerald-500' },
        { name: 'AI Helper',        endpoint: 'localhost:21337', status: 'offline', color: 'bg-blue-500' },
        { name: 'Mossy Manager',    endpoint: 'localhost:8011', status: 'offline', color: 'bg-green-500' },
        { name: 'Hermes Agent',     endpoint: 'local-cli', status: 'offline', color: 'bg-yellow-500' },
    ]);

    // Map display names to discovery keys returned by the collaboration service
    const AGENT_KEY_MAP: Record<string, string> = {
        'mossy ai (tutor)': 'desktop-ai',
        'desktop tutor':    'desktop-tutor',
        'ai helper':        'ai-helper',
        'mossy manager':    'mossy-manager',
        'hermes agent':     'hermes-agent',
    };

    const [messages, setMessages] = useState<InterAgentMessage[]>([]);
    const [stats, setStats] = useState({
        total_knowledge: 0,
        inter_agent_queries: 0,
        improvements_made: 0,
        thumbs_up: 0,
        thumbs_down: 0,
        training_samples_ready: 0,
    });

    const [activeTab, setActiveTab] = useState('collaboration');
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [lastFeedbackMsg, setLastFeedbackMsg] = useState('');

    // Discover agents
    useEffect(() => {
        const discoverAgents = async () => {
            try {
                const resp = await fetch('http://localhost:8004/agents/discover');
                const data = await resp.json();

                const updatedAgents = agents.map((agent) => {
                    const key = AGENT_KEY_MAP[agent.name.toLowerCase()] ?? agent.name.toLowerCase().replace(/\s+/g, '-');
                    const discovered = data[key];
                    return {
                        ...agent,
                        status: discovered?.status === 'online' ? 'online' : 'offline',
                    };
                });

                setAgents(updatedAgents);
            } catch (err) {
                console.error('Discovery failed:', err);
            }
        };

        discoverAgents();
        const interval = setInterval(discoverAgents, 5000);
        return () => clearInterval(interval);
    }, []);

    // Load stats
    useEffect(() => {
        const loadStats = async () => {
            try {
                const resp = await fetch('http://localhost:8004/stats');
                const data = await resp.json();
                setStats(data);
            } catch (err) {
                console.error('Stats loading failed:', err);
            }
        };

        loadStats();
        const interval = setInterval(loadStats, 10000);
        return () => clearInterval(interval);
    }, []);

    const triggerImprovement = async () => {
        try {
            await fetch('http://localhost:8004/improve/all', { method: 'POST' });
            alert('✓ Continuous improvement triggered! Agents are reflecting on learning...');
        } catch (err) {
            alert('Failed to trigger improvement');
        }
    };

    const submitFeedback = async (question: string, answer: string, rating: 1 | -1) => {
        setFeedbackLoading(true);
        try {
            const resp = await fetch('http://localhost:8004/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, answer, rating }),
            });
            const data = await resp.json();
            setLastFeedbackMsg(
                rating === 1
                    ? '✓ Thumbs up recorded — training sample saved!'
                    : '✓ Thumbs down recorded — improvement cycle triggered!'
            );
            // Refresh stats
            const statsResp = await fetch('http://localhost:8004/stats');
            setStats(await statsResp.json());
        } catch (err) {
            setLastFeedbackMsg('Failed to submit feedback');
        } finally {
            setFeedbackLoading(false);
            setTimeout(() => setLastFeedbackMsg(''), 4000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                        <Brain className="w-10 h-10 text-purple-400" />
                        Multi-Agent Tutoring System
                    </h1>
                    <p className="text-slate-400">Fallout 4 Modding Experts Collaborating & Learning</p>
                    {lastFeedbackMsg && (
                        <div className="mt-2 px-4 py-2 bg-green-800 border border-green-600 rounded text-green-200 text-sm">
                            {lastFeedbackMsg}
                        </div>
                    )}
                </div>

                {/* Agent Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {agents.map((agent) => (
                        <div
                            key={agent.name}
                            onClick={() => setSelectedAgent(selectedAgent === agent.name ? null : agent.name)}
                            className={`p-6 rounded-lg border-2 cursor-pointer transition ${agent.status === 'online'
                                ? 'border-green-500 bg-slate-800 hover:bg-slate-700'
                                : 'border-red-500 bg-slate-900 opacity-50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                                <div className={`w-3 h-3 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                            </div>
                            <p className="text-sm text-slate-400">{agent.endpoint}</p>
                            <p className="text-xs text-slate-500 mt-2">
                                {agent.status === 'online' ? '● Online' : '● Offline'}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('collaboration')}
                        className={`px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === 'collaboration'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                            }`}
                    >
                        <MessageCircle className="w-5 h-5" />
                        Inter-Agent Chat
                    </button>
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === 'knowledge'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                            }`}
                    >
                        <Share2 className="w-5 h-5" />
                        Shared Knowledge
                    </button>
                    <button
                        onClick={() => setActiveTab('improvement')}
                        className={`px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === 'improvement'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                            }`}
                    >
                        <TrendingUp className="w-5 h-5" />
                        Improvements
                    </button>
                </div>

                {/* Content */}
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    {activeTab === 'collaboration' && <CollaborationTab agents={agents} onFeedback={submitFeedback} />}
                    {activeTab === 'knowledge' && <KnowledgeTab />}
                    {activeTab === 'improvement' && (
                        <ImprovementTab stats={stats} onTrigger={triggerImprovement} />
                    )}
                </div>

                {/* Stats Footer */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-8">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Shared Knowledge</p>
                        <p className="text-3xl font-bold text-purple-400">{stats.total_knowledge}</p>
                        <p className="text-xs text-slate-500 mt-1">entries</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Inter-Agent Queries</p>
                        <p className="text-3xl font-bold text-blue-400">{stats.inter_agent_queries}</p>
                        <p className="text-xs text-slate-500 mt-1">communications</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Improvements</p>
                        <p className="text-3xl font-bold text-green-400">{stats.improvements_made}</p>
                        <p className="text-xs text-slate-500 mt-1">optimizations</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">👍 Thumbs Up</p>
                        <p className="text-3xl font-bold text-emerald-400">{stats.thumbs_up}</p>
                        <p className="text-xs text-slate-500 mt-1">good answers</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">👎 Thumbs Down</p>
                        <p className="text-3xl font-bold text-red-400">{stats.thumbs_down}</p>
                        <p className="text-xs text-slate-500 mt-1">improved</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-400 text-sm">Training Samples</p>
                        <p className="text-3xl font-bold text-yellow-400">{stats.training_samples_ready}</p>
                        <p className="text-xs text-slate-500 mt-1">ready to tune</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// TABS
// ============================================================================

function CollaborationTab({ agents, onFeedback }: { agents: AgentStatus[]; onFeedback: (q: string, a: string, r: 1 | -1) => void }) {
    const [fromAgent, setFromAgent] = useState('desktop-ai');
    const [toAgent, setToAgent] = useState('ai-helper');
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const onlineAgents = agents.filter((a) => a.status === 'online');

    const handleQuery = async () => {
        if (!question.trim()) return;

        setLoading(true);
        try {
            const result = await fetch('http://localhost:8004/agents/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_agent: fromAgent,
                    to_agent: toAgent,
                    question: question,
                }),
            });

            const data = await result.json();
            setResponse(data);
        } catch (err) {
            alert('Query failed: ' + String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Agent-to-Agent Query</h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="from-agent" className="block text-sm font-medium text-slate-300 mb-2">From Agent</label>
                        <select
                            id="from-agent"
                            title="Select the agent sending the query"
                            value={fromAgent}
                            onChange={(e) => setFromAgent(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                        >
                            <option value="desktop-ai">Mossy AI (Tutor)</option>
                            <option value="ai-helper">AI Helper</option>
                            <option value="mossy-manager">Mossy Manager</option>
                            <option value="hermes-agent">Hermes Agent</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="to-agent" className="block text-sm font-medium text-slate-300 mb-2">To Agent</label>
                        <select
                            id="to-agent"
                            title="Select the agent receiving the query"
                            value={toAgent}
                            onChange={(e) => setToAgent(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                        >
                            <option value="ai-helper">AI Helper</option>
                            <option value="desktop-ai">Mossy AI (Tutor)</option>
                            <option value="mossy-manager">Mossy Manager</option>
                            <option value="hermes-agent">Hermes Agent</option>
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Question</label>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What should Fallout 4 modders know about load order conflicts?"
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 h-24 resize-none"
                    />
                </div>

                <button
                    onClick={handleQuery}
                    disabled={loading || !onlineAgents.length}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white font-semibold py-2 rounded transition"
                >
                    {loading ? '⟳ Querying...' : 'Send Query'}
                </button>
            </div>

            {response && (
                <div className="p-4 bg-slate-900 rounded-lg border border-purple-600">
                    <h4 className="text-lg font-semibold text-purple-400 mb-3">Response from {response.agent}</h4>
                    <div className="bg-slate-800 rounded p-3 mb-3 text-white whitespace-pre-wrap">
                        {response.answer}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">
                            Confidence: <span className="text-green-400 font-semibold">{(response.confidence * 100).toFixed(0)}%</span>
                        </span>
                        {response.sources && response.sources.length > 0 && (
                            <span className="text-slate-400">{response.sources.length} sources</span>
                        )}
                    </div>
                    {/* Feedback buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                        <span className="text-xs text-slate-400 self-center mr-1">Was this helpful?</span>
                        <button
                            onClick={() => onFeedback(question, response.answer, 1)}
                            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded transition"
                            title="Thumbs up — save as training sample"
                        >
                            👍 Yes
                        </button>
                        <button
                            onClick={() => onFeedback(question, response.answer, -1)}
                            className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-sm rounded transition"
                            title="Thumbs down — trigger improvement"
                        >
                            👎 No
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function KnowledgeTab() {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!search.trim()) return;

        setLoading(true);
        try {
            const result = await fetch('http://localhost:8004/knowledge/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: search, n_results: 10 }),
            });

            const data = await result.json();
            setResults(data.results || []);
        } catch (err) {
            alert('Search failed: ' + String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search Fallout 4 knowledge (e.g., 'load order', 'mod conflicts')..."
                    className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-semibold px-6 py-2 rounded transition"
                >
                    {loading ? '⟳' : '🔍'}
                </button>
            </div>

            <div className="space-y-3">
                {results.length === 0 && search && (
                    <p className="text-slate-400 text-center py-8">No results found</p>
                )}
                {results.map((result, idx) => (
                    <div key={idx} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-semibold">{result.metadata?.topic || 'Unknown Topic'}</h4>
                            <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">
                                {result.metadata?.agent || 'Unknown Agent'}
                            </span>
                        </div>
                        <p className="text-slate-300 text-sm mb-2">{result.content?.substring(0, 200)}...</p>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Confidence: {((result.metadata?.confidence || 0.8) * 100).toFixed(0)}%</span>
                            {result.metadata?.verified_by && (
                                <span className="text-green-400">✓ Verified by {result.metadata.verified_by}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ImprovementTab({ stats, onTrigger }: { stats: any; onTrigger: () => void }) {
    return (
        <div className="space-y-6">
            <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                    Continuous Improvement System
                </h3>

                <div className="space-y-4 text-slate-300 mb-6">
                    <p>
                        Each agent maintains its own learning memory and continuously improves through:
                    </p>
                    <ul className="space-y-2 ml-4">
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Inter-agent validation</strong> - Agents verify each other's answers</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Consensus scoring</strong> - Quality measured by agreement</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Knowledge sharing</strong> - Discoveries added to shared base</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>User feedback loop</strong> - 👍/👎 adjusts confidence &amp; triggers improvement</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Auto fine-tuning dataset</strong> - Good answers collected for LoRA training</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Self-critique</strong> - Every answer auto-reviewed before delivery</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Episodic memory</strong> - Mossy remembers past conversations</span>
                        </li>
                    </ul>
                </div>

                <button
                    onClick={onTrigger}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded transition flex items-center justify-center gap-2"
                >
                    <TrendingUp className="w-5 h-5" />
                    Trigger Continuous Improvement Cycle
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm mb-2">Total Improvements Made</p>
                    <p className="text-3xl font-bold text-green-400">{stats.improvements_made || 0}</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm mb-2">Knowledge Entries</p>
                    <p className="text-3xl font-bold text-purple-400">{stats.total_knowledge || 0}</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-sm mb-2">Training Samples Ready</p>
                    <p className="text-3xl font-bold text-yellow-400">{stats.training_samples_ready || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">👍 {stats.thumbs_up || 0} up  👎 {stats.thumbs_down || 0} down</p>
                </div>
            </div>

            <div className="p-4 bg-blue-900 border border-blue-600 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-200">
                    <strong>How it works:</strong> When agents answer questions, other agents validate the answer.
                    If consensus is low (&lt; 70%), a better answer is synthesized.  User thumbs-up saves the answer
                    as a training sample for future LoRA fine-tuning.  Thumbs-down immediately triggers re-synthesis.
                </div>
            </div>
        </div>
    );
}
