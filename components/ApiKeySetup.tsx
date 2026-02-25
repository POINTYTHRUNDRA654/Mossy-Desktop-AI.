/**
 * First-run provider setup screen.
 *
 * Two paths:
 *  1. Ollama (local, free, private)   — runs models on this PC, no API key
 *  2. Gemini API (cloud, free tier)   — best AI quality, needs a free API key
 */
import React, { useState, useEffect } from 'react';
import {
  HardDrive, Cloud, KeyRound, ExternalLink, Eye, EyeOff,
  CheckCircle2, AlertTriangle, RefreshCw, ChevronRight, Zap,
} from 'lucide-react';
import {
  setProvider, setApiKey, setOllamaConfig, getOllamaConfig,
  AIProviderType,
} from '../utils/apiKey';
import {
  listOllamaModels, checkOllamaHealth, OllamaModelInfo,
} from '../utils/aiClient';

interface Props { onConfigured: () => void }

// Recommended Ollama models — ordered by quality / resource usage
const RECOMMENDED = [
  { name: 'gemma3:9b',   label: 'Gemma 3 · 9B',    note: '~6 GB RAM  — best quality' },
  { name: 'gemma3:4b',   label: 'Gemma 3 · 4B',    note: '~4 GB RAM  — great balance' },
  { name: 'gemma3:1b',   label: 'Gemma 3 · 1B',    note: '~2 GB RAM  — fastest / lightweight' },
  { name: 'llama3.2',    label: 'Llama 3.2 · 3B',  note: '~3 GB RAM  — very capable' },
  { name: 'mistral',     label: 'Mistral · 7B',    note: '~5 GB RAM  — well-rounded' },
  { name: 'phi4-mini',   label: 'Phi-4 Mini',      note: '~4 GB RAM  — Microsoft, fast' },
];

const ApiKeySetup: React.FC<Props> = ({ onConfigured }) => {
  const [screen, setScreen]   = useState<'choose' | 'ollama' | 'gemini'>('choose');

  // ── Ollama state ──────────────────────────────────────────────────────
  const [ollamaEndpoint, setOllamaEndpoint] = useState(getOllamaConfig().endpoint);
  const [ollamaModel,    setOllamaModel]    = useState(getOllamaConfig().model);
  const [ollamaStatus,   setOllamaStatus]   = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [availableModels, setAvailableModels] = useState<OllamaModelInfo[]>([]);

  // ── Gemini state ──────────────────────────────────────────────────────
  const [geminiKey,       setGeminiKey]       = useState('');
  const [showKey,         setShowKey]         = useState(false);
  const [geminiStatus,    setGeminiStatus]    = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [geminiError,     setGeminiError]     = useState('');

  // Auto-probe Ollama when the user opens the Ollama screen
  useEffect(() => {
    if (screen === 'ollama') checkOllama();
  }, [screen]);

  async function checkOllama() {
    setOllamaStatus('checking');
    const ep = ollamaEndpoint.trim() || 'http://localhost:11434';
    const ok = await checkOllamaHealth(ep);
    if (ok) {
      const models = await listOllamaModels(ep);
      setAvailableModels(models);
      // If saved model isn't in list, keep value but don't auto-change
      setOllamaStatus('ok');
    } else {
      setOllamaStatus('fail');
    }
  }

  async function saveOllama() {
    const ep = ollamaEndpoint.trim() || 'http://localhost:11434';
    const model = ollamaModel.trim() || 'gemma3';
    setProvider('ollama');
    setOllamaConfig({ endpoint: ep, model });
    onConfigured();
  }

  async function saveGemini() {
    const trimmed = geminiKey.trim();
    if (!trimmed) { setGeminiError('Please enter your API key.'); return; }
    if (!trimmed.startsWith('AIza') || trimmed.length < 30) {
      setGeminiError('Keys start with "AIza" and are at least 30 characters.');
      return;
    }
    setGeminiStatus('checking');
    setGeminiError('');
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`
      );
      if (!res.ok) throw new Error(`${res.status}`);
      setApiKey(trimmed);
      setProvider('gemini');
      setGeminiStatus('ok');
      onConfigured();
    } catch {
      setGeminiStatus('fail');
      setGeminiError('Could not validate — check the key and your internet connection.');
    }
  }

  // ── Shared chrome ─────────────────────────────────────────────────────
  const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 shadow-2xl shadow-black/50 w-full max-w-lg mx-4">
      {children}
    </div>
  );

  // ── Choose screen ─────────────────────────────────────────────────────
  if (screen === 'choose') return (
    <Bg>
      <Card>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Mossy</h1>
          <p className="text-slate-400 text-sm mt-2">Choose your AI engine. You can change this anytime.</p>
        </div>

        {/* Ollama option */}
        <button
          onClick={() => setScreen('ollama')}
          className="w-full mb-4 text-left p-5 rounded-xl border border-slate-700 hover:border-emerald-500/60 bg-slate-800/50 hover:bg-slate-800 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <HardDrive className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Ollama  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full ml-1">LOCAL · FREE</span></span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                AI runs entirely on this PC. No internet, no API key, no usage fees.
                Needs <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline" onClick={e => e.stopPropagation()}>Ollama</a> installed.
              </p>
              <p className="text-[10px] text-slate-500 mt-2">Recommended: Gemma 3, Llama 3.2, Mistral</p>
            </div>
          </div>
        </button>

        {/* Gemini option */}
        <button
          onClick={() => setScreen('gemini')}
          className="w-full text-left p-5 rounded-xl border border-slate-700 hover:border-blue-500/60 bg-slate-800/50 hover:bg-slate-800 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Gemini API  <span className="text-[10px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full ml-1">CLOUD · FREE TIER</span></span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Google's Gemini 2.0 Flash — state-of-the-art quality. Free tier gives
                1,500 requests/day. Needs internet + a free API key.
              </p>
              <p className="text-[10px] text-slate-500 mt-2">Also unlocks: Live Voice, Image Generation, Gemini TTS</p>
            </div>
          </div>
        </button>
      </Card>
    </Bg>
  );

  // ── Ollama screen ─────────────────────────────────────────────────────
  if (screen === 'ollama') return (
    <Bg>
      <Card>
        <BackButton onClick={() => setScreen('choose')} />
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <HardDrive className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Ollama — Local AI</h2>
            <p className="text-xs text-slate-400">Free, private, runs on this PC</p>
          </div>
        </div>

        {/* Endpoint */}
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          Ollama Endpoint
        </label>
        <div className="flex gap-2 mb-5">
          <input
            value={ollamaEndpoint}
            onChange={e => setOllamaEndpoint(e.target.value)}
            className="flex-1 bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none font-mono"
            placeholder="http://localhost:11434"
          />
          <button
            onClick={checkOllama}
            disabled={ollamaStatus === 'checking'}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ollamaStatus === 'checking' ? 'animate-spin' : ''}`} />
            Test
          </button>
        </div>

        {/* Status */}
        {ollamaStatus === 'ok' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Ollama is running
            {availableModels.length > 0 && ` — ${availableModels.length} model${availableModels.length !== 1 ? 's' : ''} installed`}
          </div>
        )}
        {ollamaStatus === 'fail' && (
          <div className="text-sm text-red-400 mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Ollama not found</p>
            <p className="mt-1 text-xs">
              Install Ollama from{' '}
              <a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline text-red-300">ollama.com</a>,
              then run: <code className="bg-black/40 px-1 rounded">ollama pull gemma3</code>
            </p>
          </div>
        )}

        {/* Model selector */}
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          Model
        </label>

        {/* Installed models (if detected) */}
        {availableModels.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Installed on this PC</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
              {availableModels.map(m => (
                <button
                  key={m.name}
                  onClick={() => setOllamaModel(m.name)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    ollamaModel === m.name
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-mono truncate">{m.name}</div>
                  <div className="text-slate-500 text-[10px]">{(m.size / 1e9).toFixed(1)} GB</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommended models */}
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
            {availableModels.length > 0 ? 'Or type a model name' : 'Recommended models'}
          </p>
          {availableModels.length === 0 && (
            <div className="grid grid-cols-1 gap-1 mb-3 max-h-40 overflow-y-auto">
              {RECOMMENDED.map(r => (
                <button
                  key={r.name}
                  onClick={() => setOllamaModel(r.name)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    ollamaModel === r.name
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-mono font-bold">{r.label}</span>
                  <span className="text-slate-500 ml-2">{r.note}</span>
                </button>
              ))}
            </div>
          )}
          <input
            value={ollamaModel}
            onChange={e => setOllamaModel(e.target.value)}
            className="w-full bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none font-mono"
            placeholder="gemma3"
          />
        </div>

        <button
          onClick={saveOllama}
          disabled={!ollamaModel.trim()}
          className="mt-5 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Use Ollama &amp; Launch Mossy
        </button>

        {ollamaStatus === 'fail' && (
          <p className="text-center text-xs text-slate-600 mt-3">
            You can still save this config — Mossy will connect once Ollama starts.
          </p>
        )}
      </Card>
    </Bg>
  );

  // ── Gemini screen ─────────────────────────────────────────────────────
  return (
    <Bg>
      <Card>
        <BackButton onClick={() => setScreen('choose')} />
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Cloud className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Gemini API — Cloud AI</h2>
            <p className="text-xs text-slate-400">Free tier · 1,500 requests/day</p>
          </div>
        </div>

        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          Gemini API Key
        </label>
        <div className="relative mb-4">
          <input
            type={showKey ? 'text' : 'password'}
            value={geminiKey}
            onChange={e => { setGeminiKey(e.target.value); setGeminiError(''); setGeminiStatus('idle'); }}
            onKeyDown={e => e.key === 'Enter' && saveGemini()}
            placeholder="AIza..."
            autoFocus
            className="w-full bg-black/50 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {geminiError && (
          <div className="flex items-start gap-2 text-red-400 text-xs mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {geminiError}
          </div>
        )}

        <button
          onClick={saveGemini}
          disabled={geminiStatus === 'checking' || !geminiKey.trim()}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {geminiStatus === 'checking' ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Validating…</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Save &amp; Launch Mossy</>
          )}
        </button>

        <p className="text-center text-xs text-slate-600 mt-4">
          No key yet?{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
          >
            Get one free at Google AI Studio <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <p className="text-center text-[10px] text-slate-700 mt-3">
          Key stored on this device only — never sent anywhere except Google's API.
        </p>
      </Card>
    </Bg>
  );
};

// ─── Shared sub-components ─────────────────────────────────────────────────

const Bg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050910]">
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(rgba(16,185,129,1) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,1) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />
    {children}
  </div>
);

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 flex items-center gap-1"
  >
    ← Back
  </button>
);

export default ApiKeySetup;
