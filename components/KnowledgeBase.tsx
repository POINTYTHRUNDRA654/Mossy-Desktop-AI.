import React, { useState, useRef } from 'react';
import { Plus, Search, Trash2, Upload, RotateCcw } from 'lucide-react';

interface Document {
    id: string;
    text: string;
    metadata?: Record<string, any>;
    source?: string;
}

interface SearchResult {
    id: string;
    text: string;
    distance: number;
    metadata: Record<string, any>;
}

export const KnowledgeBase: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [documentText, setDocumentText] = useState('');
    const [documentSource, setDocumentSource] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [serviceHealth, setServiceHealth] = useState(false);
    const [collectionStats, setCollectionStats] = useState<{ name: string; count: number }>({
        name: 'mossy_knowledge_base',
        count: 0,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check service health on mount
    React.useEffect(() => {
        checkHealth();
    }, []);

    const checkHealth = async () => {
        try {
            const result = await window.electronAPI?.ipcInvoke('chroma:health-check');
            setServiceHealth(result?.status === 'healthy');
            if (result?.collections_count !== undefined) {
                setCollectionStats({
                    name: collectionStats.name,
                    count: result.collections_count,
                });
            }
        } catch (err) {
            console.error('Health check failed:', err);
            setServiceHealth(false);
        }
    };

    const addDocument = async () => {
        if (!documentText.trim()) {
            setError('Document text cannot be empty');
            return;
        }

        setIsAdding(true);
        setError('');
        setSuccess('');

        try {
            const doc: Document = {
                id: `doc_${Date.now()}`,
                text: documentText,
                source: documentSource || 'manual',
            };

            const result = await window.electronAPI?.ipcInvoke('chroma:add-document', doc);
            if (result?.success) {
                setDocuments([...documents, doc]);
                setDocumentText('');
                setDocumentSource('');
                setSuccess('Document added successfully!');
            } else {
                setError('Failed to add document');
            }
        } catch (err) {
            setError(`Error: ${String(err)}`);
        } finally {
            setIsAdding(false);
        }
    };

    const searchKnowledge = async () => {
        if (!searchQuery.trim()) {
            setError('Search query cannot be empty');
            return;
        }

        setIsSearching(true);
        setError('');

        try {
            const result = await window.electronAPI?.ipcInvoke('chroma:search', {
                query: searchQuery,
                n_results: 5,
            });

            if (Array.isArray(result)) {
                setSearchResults(result);
            } else if (result?.success === false) {
                setError('Search failed');
            }
        } catch (err) {
            setError(`Search error: ${String(err)}`);
        } finally {
            setIsSearching(false);
        }
    };

    const deleteDocument = async (docId: string) => {
        try {
            const result = await window.electronAPI?.ipcInvoke('chroma:delete-document', docId);
            if (result?.success) {
                setDocuments(documents.filter((d) => d.id !== docId));
                setSuccess('Document deleted');
            }
        } catch (err) {
            setError(`Delete failed: ${String(err)}`);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            setDocumentText(text);
            setDocumentSource(file.name);
        } catch (err) {
            setError(`Failed to read file: ${String(err)}`);
        }
    };

    return (
        <div className="w-full max-w-4xl rounded-lg border border-blue-700/30 bg-gradient-to-br from-blue-950 to-indigo-950 p-6 shadow-lg">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Search className="h-6 w-6 text-blue-400" />
                    <h3 className="text-lg font-semibold text-blue-50">Knowledge Base (Semantic Search)</h3>
                    <div className={`h-2 w-2 rounded-full ${serviceHealth ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <button
                    onClick={checkHealth}
                    className="text-blue-400 hover:text-blue-200 transition"
                    title="Check service health">
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 rounded-lg bg-green-900/50 px-4 py-2 text-sm text-green-200">
                    {success}
                </div>
            )}

            {/* Stats */}
            <div className="mb-6 text-sm text-blue-300">
                📚 Documents in knowledge base: <strong>{collectionStats.count}</strong>
            </div>

            {/* Add Document Section */}
            <div className="mb-8 rounded-lg bg-blue-900/30 p-4 border border-blue-700/30">
                <h4 className="text-sm font-semibold text-blue-200 mb-3">Add to Knowledge Base</h4>

                {/* File Upload */}
                <div className="mb-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.pdf,.md"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-700/50 hover:bg-blue-700 text-blue-200 rounded transition">
                        <Upload className="h-3 w-3" />
                        Upload Text File
                    </button>
                </div>

                {/* Manual Text Input */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-blue-300 mb-2">Document Text:</label>
                    <textarea
                        value={documentText}
                        onChange={(e) => setDocumentText(e.target.value)}
                        placeholder="Paste or type document content here..."
                        className="w-full h-24 px-3 py-2 rounded bg-blue-900/50 border border-blue-700/50 text-blue-50 placeholder-blue-400 focus:outline-none focus:border-blue-500 text-sm"
                    />
                </div>

                {/* Source */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-blue-300 mb-2">Source (optional):</label>
                    <input
                        type="text"
                        value={documentSource}
                        onChange={(e) => setDocumentSource(e.target.value)}
                        placeholder="e.g., 'user_manual.txt'"
                        className="w-full px-3 py-2 rounded bg-blue-900/50 border border-blue-700/50 text-blue-50 placeholder-blue-400 focus:outline-none focus:border-blue-500 text-sm"
                    />
                </div>

                <button
                    onClick={addDocument}
                    disabled={isAdding}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 transition">
                    <Plus className="h-4 w-4" />
                    {isAdding ? 'Adding...' : 'Add Document'}
                </button>
            </div>

            {/* Search Section */}
            <div className="mb-8 rounded-lg bg-blue-900/30 p-4 border border-blue-700/30">
                <h4 className="text-sm font-semibold text-blue-200 mb-3">Semantic Search</h4>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchKnowledge()}
                        placeholder="Search knowledge base..."
                        className="flex-1 px-3 py-2 rounded bg-blue-900/50 border border-blue-700/50 text-blue-50 placeholder-blue-400 focus:outline-none focus:border-blue-500 text-sm"
                    />
                    <button
                        onClick={searchKnowledge}
                        disabled={isSearching}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 transition">
                        {isSearching ? '🔍 Searching...' : '🔍 Search'}
                    </button>
                </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="rounded-lg bg-blue-900/20 p-4 border border-blue-700/30">
                    <h4 className="text-sm font-semibold text-blue-200 mb-3">
                        Search Results ({searchResults.length})
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {searchResults.map((result, idx) => (
                            <div
                                key={result.id}
                                className="p-3 rounded bg-blue-900/30 border border-blue-700/30">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div className="text-xs text-blue-400">
                                        Result {idx + 1} • Relevance: {(1 - result.distance).toFixed(2)}
                                    </div>
                                    {result.metadata?.source && (
                                        <span className="text-xs bg-blue-800/50 px-2 py-1 rounded text-blue-300">
                                            {result.metadata.source}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-blue-100 line-clamp-3">{result.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Documents List */}
            {documents.length > 0 && (
                <div className="mt-8 rounded-lg bg-blue-900/20 p-4 border border-blue-700/30">
                    <h4 className="text-sm font-semibold text-blue-200 mb-3">Added Documents ({documents.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {documents.map((doc) => (
                            <div key={doc.id} className="flex justify-between items-start gap-2 p-2 bg-blue-900/20 rounded">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-blue-400">{doc.source}</p>
                                    <p className="text-sm text-blue-100 line-clamp-1">{doc.text}</p>
                                </div>
                                <button
                                    onClick={() => deleteDocument(doc.id)}
                                    className="p-1 hover:bg-red-900/50 rounded text-red-400 transition">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="mt-4 text-xs text-blue-400 bg-blue-900/20 rounded p-3">
                <p>💡 Chroma stores documents with semantic embeddings for intelligent similarity-based search.</p>
                <p className="mt-1">Great for building knowledge bases, FAQs, and document Q&A systems.</p>
            </div>
        </div>
    );
};
