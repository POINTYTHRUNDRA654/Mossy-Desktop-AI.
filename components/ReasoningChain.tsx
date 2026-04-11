import React, { useState, useRef } from 'react';
import { Brain, Send, RotateCcw, Lightbulb } from 'lucide-react';

interface ChainResponse {
    query: string;
    chain_type: string;
    response: string;
    success: boolean;
}

export const ReasoningChain: React.FC = () => {
    const [query, setQuery] = useState('');
    const [chainType, setChainType] = useState<'simple' | 'conversational' | 'summary'>('simple');
    const [contextText, setContextText] = useState('');
    const [response, setResponse] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<Array<{ query: string; response: string }>>([]);
    const [serviceHealth, setServiceHealth] = useState(false);
    const responseEndRef = useRef<HTMLDivElement>(null);

    // Check service health on mount
    React.useEffect(() => {
        checkHealth();
    }, []);

    React.useEffect(() => {
        // Auto-scroll to bottom when new response arrives
        responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [response, history]);

    const checkHealth = async () => {
        try {
            const result = await window.electronAPI?.ipcInvoke('gemma:health-check');
            setServiceHealth(result?.status === 'healthy');
        } catch (err) {
            console.error('Health check failed:', err);
            setServiceHealth(false);
        }
    };

    const sendQuery = async () => {
        if (!query.trim()) {
            setError('Query cannot be empty');
            return;
        }

        setIsProcessing(true);
        setError('');
        setResponse('');

        try {
            const request = {
                query: query,
                chain_type: chainType,
                context: contextText ? { context: contextText } : undefined,
            };

            const result = (await window.electronAPI?.ipcInvoke('gemma:chain', request)) as ChainResponse;

            if (result?.success) {
                setResponse(result.response);
                setHistory([...history, { query: query, response: result.response }]);
                setQuery('');
            } else {
                setError('Chain execution failed');
            }
        } catch (err) {
            setError(`Error: ${String(err)}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        setResponse('');
        setContextText('');
    };

    const reuseResponse = (previousResponse: string) => {
        setContextText(previousResponse);
    };

    return (
        <div className="w-full max-w-4xl rounded-lg border border-purple-700/30 bg-gradient-to-br from-purple-950 to-violet-950 p-6 shadow-lg">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Brain className="h-6 w-6 text-purple-400" />
                    <h3 className="text-lg font-semibold text-purple-50">Reasoning Chains (LangChain)</h3>
                    <div className={`h-2 w-2 rounded-full ${serviceHealth ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <button
                    onClick={checkHealth}
                    className="text-purple-400 hover:text-purple-200 transition"
                    title="Check service health">
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}

            {/* Chain Type Selection */}
            <div className="mb-6 rounded-lg bg-purple-900/30 p-4 border border-purple-700/30">
                <h4 className="text-sm font-semibold text-purple-200 mb-3">Reasoning Type</h4>
                <div className="grid grid-cols-3 gap-3">
                    {(['simple', 'conversational', 'summary'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setChainType(type)}
                            className={`px-4 py-2 rounded text-sm font-medium transition ${chainType === type
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-purple-900/50 text-purple-200 hover:bg-purple-900/70'
                                }`}>
                            {type === 'simple' && '🤔 Simple'}
                            {type === 'conversational' && '💬 Conversational'}
                            {type === 'summary' && '📋 Summary'}
                        </button>
                    ))}
                </div>

                {/* Chain Type Descriptions */}
                <div className="mt-3 text-xs text-purple-300 space-y-1">
                    {chainType === 'simple' && (
                        <p>Simple chain: Direct question answering with single-step reasoning.</p>
                    )}
                    {chainType === 'conversational' && (
                        <p>Conversational chain: Multi-turn dialogue with memory of previous exchanges.</p>
                    )}
                    {chainType === 'summary' && (
                        <p>Summary chain: Synthesize context with query to produce structured summaries.</p>
                    )}
                </div>
            </div>

            {/* Input Section */}
            <div className="mb-6 space-y-3">
                {chainType === 'summary' && (
                    <>
                        <label className="block text-sm font-medium text-purple-200">Context (for summary)</label>
                        <textarea
                            value={contextText}
                            onChange={(e) => setContextText(e.target.value)}
                            placeholder={
                                chainType === 'summary'
                                    ? 'Paste text or context to summarize...'
                                    : 'Optional: Add conversation context...'
                            }
                            className="w-full h-20 px-3 py-2 rounded bg-purple-900/50 border border-purple-700/50 text-purple-50 placeholder-purple-400 focus:outline-none focus:border-purple-500 text-sm"
                        />
                    </>
                )}

                <label className="block text-sm font-medium text-purple-200">Your Query</label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isProcessing && sendQuery()}
                        placeholder="Ask a question or request reasoning..."
                        disabled={isProcessing}
                        className="flex-1 px-3 py-2 rounded bg-purple-900/50 border border-purple-700/50 text-purple-50 placeholder-purple-400 focus:outline-none focus:border-purple-500 disabled:opacity-50 text-sm"
                    />
                    <button
                        onClick={sendQuery}
                        disabled={isProcessing || !query.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50 transition flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        {isProcessing ? 'Thinking...' : 'Send'}
                    </button>
                </div>
            </div>

            {/* Response Display */}
            {response && (
                <div className="mb-6 rounded-lg bg-purple-900/30 p-4 border border-purple-700/30">
                    <h4 className="text-sm font-semibold text-purple-200 mb-3">Response</h4>
                    <div className="bg-purple-900/50 rounded p-3 min-h-16 max-h-48 overflow-y-auto">
                        <p className="text-purple-50 text-sm whitespace-pre-wrap leading-relaxed">{response}</p>
                    </div>
                    <button
                        onClick={() => reuseResponse(response)}
                        className="mt-3 px-3 py-1 text-xs bg-purple-700/50 hover:bg-purple-700 text-purple-200 rounded transition">
                        Use as Context
                    </button>
                </div>
            )}

            {/* Conversation History */}
            {history.length > 0 && (
                <div className="mb-6 rounded-lg bg-purple-900/20 p-4 border border-purple-700/30">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-purple-200">Conversation History</h4>
                        <button
                            onClick={clearHistory}
                            className="text-xs text-purple-400 hover:text-purple-300 transition">
                            Clear
                        </button>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {history.map((item, idx) => (
                            <div key={idx} className="border-l-2 border-purple-700/50 pl-3">
                                <p className="text-xs text-purple-400 mb-1">Q: {item.query}</p>
                                <p className="text-sm text-purple-100 line-clamp-2">A: {item.response}</p>
                            </div>
                        ))}
                        <div ref={responseEndRef} />
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-4 text-xs text-purple-400 bg-purple-900/20 rounded p-3 space-y-1">
                <div className="flex gap-2">
                    <Lightbulb className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Multi-step Reasoning:</p>
                        <p className="text-purple-300">
                            LangChain enables complex reasoning chains with memory, context chaining, and structured problem-solving.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
