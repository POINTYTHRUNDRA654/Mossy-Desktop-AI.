import React, { useState } from 'react';
import { AlertCircle, Play, RefreshCw, Loader } from 'lucide-react';

interface FineTuneConfig {
    model_name: string;
    dataset_text?: Array<{ text: string }>;
    output_dir: string;
    num_epochs: number;
    batch_size: number;
    learning_rate: number;
    max_seq_length: number;
    lora_rank: number;
    lora_alpha: number;
    lora_dropout: number;
}

interface FineTuneJob {
    job_id: string;
    status: string;
    progress: number;
    message: string;
}

/**
 * Fine-tune Gemma 4 component
 */
export const Gemma4FineTuner: React.FC = () => {
    const [config, setConfig] = useState<FineTuneConfig>({
        model_name: 'google/gemma-4-9b',
        output_dir: './gemma4_finetuned',
        num_epochs: 3,
        batch_size: 4,
        learning_rate: 2e-4,
        max_seq_length: 2048,
        lora_rank: 16,
        lora_alpha: 32,
        lora_dropout: 0.05,
    });

    const [trainingData, setTrainingData] = useState<string>('');
    const [jobs, setJobs] = useState<Map<string, FineTuneJob>>(new Map());
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStartFineTune = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build dataset from textarea input
            const dataset_text = trainingData
                .split('\n\n')
                .filter(text => text.trim().length > 0)
                .map(text => ({ text: text.trim() }));

            if (dataset_text.length === 0) {
                setError('Please enter some training data');
                setLoading(false);
                return;
            }

            const fineTuneConfig: FineTuneConfig = {
                ...config,
                dataset_text,
            };

            // Use IPC to start fine-tuning job
            const result = await (window as any).electronAPI?.gemmaStartFineTune?.(fineTuneConfig);
            if (!result) {
                throw new Error('Failed to start fine-tuning job');
            }

            const jobId = result.job_id;
            setActiveJobId(jobId);
            jobs.set(jobId, {
                job_id: jobId,
                status: 'pending',
                progress: 0,
                message: result.message,
            });
            setJobs(new Map(jobs));

            // Poll for status
            pollJobStatus(jobId);
        } catch (err) {
            setError(String(err));
            setLoading(false);
        }
    };

    const pollJobStatus = async (jobId: string) => {
        try {
            const interval = setInterval(async () => {
                try {
                    const status = await (window as any).electronAPI?.gemmaFineTuneStatus?.(jobId);
                    if (!status) return;

                    const job: FineTuneJob = {
                        job_id: jobId,
                        status: status.status,
                        progress: status.progress || 0,
                        message: status.message,
                    };
                    jobs.set(jobId, job);
                    setJobs(new Map(jobs));

                    if (status.status === 'completed' || status.status === 'failed') {
                        clearInterval(interval);
                        setLoading(false);
                    }
                } catch (err) {
                    console.error('Error polling job status:', err);
                }
            }, 2000); // Poll every 2 seconds
        } catch (err) {
            setError(String(err));
            setLoading(false);
        }
    };

    const currentJob = activeJobId ? jobs.get(activeJobId) : null;
    const progressPercent = currentJob ? (currentJob.progress * 100) : 0;

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6">Gemma 4 Fine-Tuner</h2>

            {/* Configuration Section */}
            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Model Name
                        </label>
                        <input
                            type="text"
                            value={config.model_name}
                            onChange={(e) => setConfig({ ...config, model_name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Output Directory
                        </label>
                        <input
                            type="text"
                            value={config.output_dir}
                            onChange={(e) => setConfig({ ...config, output_dir: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Epochs
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.num_epochs}
                            onChange={(e) => setConfig({ ...config, num_epochs: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Batch Size
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="32"
                            value={config.batch_size}
                            onChange={(e) => setConfig({ ...config, batch_size: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            LoRA Rank
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="64"
                            value={config.lora_rank}
                            onChange={(e) => setConfig({ ...config, lora_rank: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Learning Rate
                        </label>
                        <input
                            type="number"
                            step="0.00001"
                            value={config.learning_rate}
                            onChange={(e) => setConfig({ ...config, learning_rate: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Training Data Section */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Training Data (separate by blank lines)
                    </label>
                    <textarea
                        value={trainingData}
                        onChange={(e) => setTrainingData(e.target.value)}
                        placeholder="Enter training examples here. Separate multiple examples with a blank line."
                        rows={6}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm resize-none"
                        disabled={loading}
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-300">{error}</span>
                </div>
            )}

            {/* Start Button */}
            <button
                onClick={handleStartFineTune}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded flex items-center justify-center gap-2 transition"
            >
                {loading ? (
                    <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Training in progress...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4" />
                        Start Fine-Tuning
                    </>
                )}
            </button>

            {/* Job Status Section */}
            {currentJob && (
                <div className="mt-6 p-4 bg-slate-800 border border-slate-700 rounded">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">Job Status</h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${currentJob.status === 'completed' ? 'bg-green-900 text-green-200' :
                                currentJob.status === 'failed' ? 'bg-red-900 text-red-200' :
                                    'bg-blue-900 text-blue-200'
                            }`}>
                            {currentJob.status.toUpperCase()}
                        </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{currentJob.message}</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 text-right mt-1">{Math.round(progressPercent)}%</p>
                </div>
            )}
        </div>
    );
};

export default Gemma4FineTuner;
