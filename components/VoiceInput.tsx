import React, { useState, useRef, useEffect } from 'react';
import { Mic, RotateCcw, Download, Settings2 } from 'lucide-react';

interface TranscriptionResult {
    text: string;
    language: string;
    segments: any[];
    success: boolean;
}

export const VoiceInput: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribedText, setTranscribedText] = useState('');
    const [audioPath, setAudioPath] = useState('');
    const [model, setModel] = useState('base');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [serviceHealth, setServiceHealth] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Check service health on mount
    useEffect(() => {
        checkHealth();
        loadAvailableModels();
    }, []);

    const checkHealth = async () => {
        try {
            const result = await window.electronAPI?.ipcInvoke('whisper:health-check');
            setServiceHealth(result?.status === 'healthy');
        } catch (err) {
            console.error('Health check failed:', err);
            setServiceHealth(false);
        }
    };

    const loadAvailableModels = async () => {
        try {
            const result = await window.electronAPI?.ipcInvoke('whisper:list-models');
            if (result?.available_models) {
                setAvailableModels(result.available_models);
            }
        } catch (err) {
            console.error('Failed to load models:', err);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            });

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
            setError('');
        } catch (err) {
            setError('Failed to access microphone');
            console.error(err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            // Save audio to temp file and transcribe
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.wav');

            const response = await fetch('http://127.0.0.1:8002/transcribe-bytes', {
                method: 'POST',
                body: formData,
            });

            const result = (await response.json()) as TranscriptionResult;
            if (result.success) {
                setTranscribedText(result.text);
                setError('');
            } else {
                setError('Transcription failed');
            }
        } catch (err) {
            setError(`Transcription error: ${String(err)}`);
            console.error(err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const changeModel = async (newModel: string) => {
        try {
            const result = await window.electronAPI?.ipcInvoke('whisper:set-model', newModel);
            if (result?.status === 'success') {
                setModel(newModel);
                setError('');
            } else {
                setError('Failed to change model');
            }
        } catch (err) {
            setError(`Model change error: ${String(err)}`);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(transcribedText);
    };

    return (
        <div className="w-full max-w-2xl rounded-lg border border-amber-700/30 bg-gradient-to-br from-amber-950 to-orange-950 p-6 shadow-lg">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Mic className="h-6 w-6 text-amber-500" />
                    <h3 className="text-lg font-semibold text-amber-50">Voice Input (Whisper)</h3>
                    <div className={`h-2 w-2 rounded-full ${serviceHealth ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <button
                    onClick={checkHealth}
                    className="text-amber-400 hover:text-amber-200 transition"
                    title="Check service health">
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}

            {/* Model Selection */}
            <div className="mb-6 flex items-center gap-3">
                <Settings2 className="h-4 w-4 text-amber-400" />
                <label className="text-sm text-amber-200">Model:</label>
                <select
                    value={model}
                    onChange={(e) => changeModel(e.target.value)}
                    className="rounded bg-amber-900/50 px-3 py-1 text-sm text-amber-50 border border-amber-700">
                    {availableModels.map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
                <span className="text-xs text-amber-400">
                    (tiny=fast, large=accurate)
                </span>
            </div>

            {/* Recording Controls */}
            <div className="mb-6 flex gap-3">
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing}
                    className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition ${isRecording
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50'
                        }`}>
                    <Mic className="h-4 w-4" />
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>

                {isTranscribing && (
                    <div className="flex items-center gap-2 text-amber-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                        <span className="text-sm">Transcribing...</span>
                    </div>
                )}
            </div>

            {/* Transcribed Text Display */}
            {transcribedText && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-amber-200 mb-2">
                        Transcribed Text:
                    </label>
                    <div className="bg-amber-900/30 border border-amber-700/50 rounded p-4 min-h-24 max-h-40 overflow-y-auto">
                        <p className="text-amber-50 text-sm whitespace-pre-wrap">{transcribedText}</p>
                    </div>
                    <button
                        onClick={copyToClipboard}
                        className="mt-2 flex items-center gap-2 px-3 py-1 text-sm bg-amber-700/50 hover:bg-amber-700 text-amber-200 rounded transition">
                        <Download className="h-3 w-3" />
                        Copy Text
                    </button>
                </div>
            )}

            {/* Info */}
            <div className="mt-4 text-xs text-amber-400 bg-amber-900/20 rounded p-3">
                <p>💡 Whisper is powered by OpenAI's speech recognition model with 99-language support.</p>
                <p className="mt-1">Smaller models (tiny, base) are faster but less accurate. Larger models are slower but more precise.</p>
            </div>
        </div>
    );
};
