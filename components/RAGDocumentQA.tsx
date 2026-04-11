import React, { useState, useRef } from 'react';
import { BookOpen, Send, RotateCcw, HelpCircle } from 'lucide-react';

interface RAGResponse {
    query: string;
    response: string;
    source_nodes: Array<{ text: string; score: number }>;
    success: boolean;
}

export const RAGDocumentQA: React.FC = () => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [sourceNodes, setSourceNodes] = useState<Array<{ text: string; score: number }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [conversationHistory, setConversationHistory] = useState<
        Array<{ query: string; response: string }>
    >([]);
    const [serviceHealth, setServiceHealth] = useState(false);
    const [documentsCount, setDocumentsCount] = useState(0);
    const responseEndRef = useRef<HTMLDivElement>(null);

    // Check service health on mount
    React.useEffect(() => {
        checkHealth();
    }, []);

    React.useEffect(() => {
        responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [response, conversationHistory]);

    const checkHealth = async () => {
        try {
            const result = await window.electronAPI?.ipcInvoke('gemma:health-check');
            setServiceHealth(result?.status === 'healthy');
        } catch (err) {
            console.error('Health check failed:', err);
            setServiceHealth(false);
        }
    };

    const addDocument = async (text: string) => {
        try {
            const doc = {
                text: text,
                metadata: { type: 'rag_input', timestamp: new Date().toISOString() },
            };
            const result = await window.electronAPI?.ipcInvoke('gemma:add-documents', [doc]);
            if (result?.success) {
                setDocumentsCount((prev) => prev + 1);
                return true;
            }
        } catch (err) {
            console.error('Failed to add document:', err);
        }
        return false;
    };

    const queryRAG = async () => {
        if (!query.trim()) {
            setError('Query cannot be empty');
            return;
        }

        setIsProcessing(true);
        setError('');
        setResponse('');
        setSourceNodes([]);

        try {
            const result = (await window.electronAPI?.ipcInvoke('gemma:rag-query', {
                query: query,
            })) as RAGResponse;

            if (result?.success) {
                setResponse(result.response);
                setSourceNodes(result.source_nodes || []);
                setConversationHistory([
                    ...conversationHistory,
                    { query: query, response: result.response },
                ]);
                setQuery('');
            } else {
                setError('RAG query failed');
            }
        } catch (err) {
            setError(`Error: ${String(err)}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const clearHistory = () => {
        setConversationHistory([]);
        setResponse('');
        setSourceNodes([]);
    };

    return (
        <div className="w-full max-w-4xl rounded-lg border border-green-700/30 bg-gradient-to-br from-green-950 to-teal-950 p-6 shadow-lg">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-green-400" />
                    <h3 className="text-lg font-semibold text-green-50">
                        Document Q&A (RAG + LLamaIndex)
                    </h3>
                    <div className={`h-2 w-2 rounded-full ${serviceHealth ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <button
                    onClick={checkHealth}
                    className="text-green-400 hover:text-green-200 transition"
                    title="Check service health">
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}

            {/* Status Info */}
            <div className="mb-6 flex gap-4 text-sm text-green-300">
                <div className="flex items-center gap-2">
                    <span className="text-xs">📄 Documents:</span>
                    <strong>{documentsCount}</strong>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs">💬 Questions:</span>
                    <strong>{conversationHistory.length}</strong>
                </div>
            </div>

            {/* Query Input */}
            <div className="mb-6 space-y-2">
                <label className="block text-sm font-medium text-green-200">Ask about your documents:</label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isProcessing && queryRAG()}
                        placeholder="What would you like to know from your documents?"
                        disabled={isProcessing}
                        className="flex-1 px-3 py-2 rounded bg-green-900/50 border border-green-700/50 text-green-50 placeholder-green-400 focus:outline-none focus:border-green-500 disabled:opacity-50 text-sm"
                    />
                    <button
                        onClick={queryRAG}
                        disabled={isProcessing || !query.trim()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50 transition flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        {isProcessing ? 'Searching...' : 'Ask'}
                    </button>
                </div>
            </div>

            {/* Response */}
            {response && (
                <div className="mb-6 rounded-lg bg-green-900/30 p-4 border border-green-700/30">
                    <h4 className="text-sm font-semibold text-green-200 mb-3">Answer</h4>
                    <div className="bg-green-900/50 rounded p-4 min-h-20 max-h-56 overflow-y-auto">
                        <p className="text-green-50 text-sm whitespace-pre-wrap leading-relaxed">{response}</p>
                    </div>
                </div>
            )}

            {/* Source Documents */}
            {sourceNodes.length > 0 && (
                <div className="mb-6 rounded-lg bg-green-900/30 p-4 border border-green-700/30">
                    <h4 className="text-sm font-semibold text-green-200 mb-3">
                        📚 Retrieved Sources ({sourceNodes.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {sourceNodes.map((node, idx) => (
                            <div key={idx} className="p-3 rounded bg-green-900/20 border border-green-700/30">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <span className="text-xs font-medium text-green-400">Source {idx + 1}</span>
                                    <span className="text-xs text-green-400">
                                        Relevance: {(node.score * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <p className="text-xs text-green-100 line-clamp-3">{node.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
                <div className="mb-6 rounded-lg bg-green-900/20 p-4 border border-green-700/30">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-green-200">
                            Conversation ({conversationHistory.length})
                        </h4>
                        <button
                            onClick={clearHistory}
                            className="text-xs text-green-400 hover:text-green-300 transition">
                            Clear
                        </button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {conversationHistory.map((item, idx) => (
                            <div key={idx} className="border-l-2 border-green-700/50 pl-3 py-1">
                                <p className="text-xs text-green-400 font-medium mb-1">Q: {item.query}</p>
                                <p className="text-sm text-green-100 line-clamp-2">A: {item.response}</p>
                            </div>
                        ))}
                        <div ref={responseEndRef} />
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!response && conversationHistory.length === 0 && (
                <div className="mb-6 rounded-lg bg-green-900/20 p-6 border border-green-700/30 text-center">
                    <HelpCircle className="h-12 w-12 text-green-600/50 mx-auto mb-3" />
                    <p className="text-green-200 text-sm mb-3">No questions asked yet.</p>
                    <div className="text-xs text-green-400 space-y-1">
                        <p>1️⃣ First, add documents to your knowledge base using the Knowledge Base component</p>
                        <p>2️⃣ Then ask questions about them here</p>
                        <p>3️⃣ RAG retrieves relevant sections and Gemma generates answers using the context</p>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="mt-4 text-xs text-green-400 bg-green-900/20 rounded p-3 space-y-1">
                <p>
                    <strong>Retrieval-Augmented Generation (RAG):</strong> LLamaIndex retrieves relevant document
                    sections, Chroma finds semantically similar content, and Gemma generates answers grounded in your
                    documents.
                </p>
                <p className="mt-2">
                    Perfect for: FAQs, documentation lookup, research paper analysis, knowledge base search.
                </p>
            </div>
        </div>
    );
};
