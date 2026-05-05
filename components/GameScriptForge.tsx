import React, { useState, useEffect } from 'react';
import { Code2, Copy, Zap, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const LANGUAGES = [
  { value: 'papyrus',    label: 'Papyrus (Skyrim/FO4)' },
  { value: 'lua',        label: 'Lua (SAMP / Game Engines)' },
  { value: 'gdscript',   label: 'GDScript (Godot)' },
  { value: 'python',     label: 'Python (Blender / Mods)' },
  { value: 'autohotkey', label: 'AutoHotkey' },
  { value: 'csharp',     label: 'C# (Unity)' },
];

const GAME_CONTEXTS = [
  'Skyrim', 'Fallout 4', 'Fallout: New Vegas', 'Godot', 'Unity', 'Blender', 'Generic',
];

const SYSTEM_PROMPTS: Record<string, string> = {
  papyrus:    'You are an expert Skyrim/Fallout 4 modder. Generate clean, well-commented Papyrus script code.',
  lua:        'You are an expert Lua game scripting developer. Generate clean, well-commented Lua code.',
  gdscript:   'You are an expert Godot GDScript developer. Generate GDScript 4.x code following best practices.',
  python:     'You are an expert Blender Python (bpy) and game modding developer. Generate clean Python scripts.',
  autohotkey: 'You are an AutoHotkey expert. Generate clean AHK v2 scripts for gaming automation.',
  csharp:     'You are an expert Unity C# developer. Generate clean, well-commented Unity scripts.',
};

const GameScriptForge: React.FC = () => {
  const [language, setLanguage] = useState('papyrus');
  const [gameContext, setGameContext] = useState('Skyrim');
  const [description, setDescription] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [modelUsed, setModelUsed] = useState('deepseek-coder-v2');

  useEffect(() => {
    checkOllama();
  }, []);

  const checkOllama = async () => {
    const result = await window.electronAPI?.ipcInvoke('ollama:health-check');
    if (result?.status === 'healthy') {
      setOllamaStatus('healthy');
      const coder = result.models?.find((m: string) => m.includes('deepseek-coder'));
      if (coder) setModelUsed(coder);
    } else {
      setOllamaStatus('error');
    }
  };

  const generateScript = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setGeneratedCode('');
    setExplanation('');
    const langLabel = LANGUAGES.find(l => l.value === language)?.label || language;
    const prompt = `Generate a ${langLabel} script for ${gameContext}.\n\nTask: ${description}\n\nProvide only the code, no explanations outside the code.`;
    const result = await window.electronAPI?.ipcInvoke('ollama:code-gen', {
      model: modelUsed,
      system_prompt: SYSTEM_PROMPTS[language],
      prompt,
    });
    setLoading(false);
    if (result?.status === 'ok') {
      setGeneratedCode(result.code || '');
      if (result.model_used) setModelUsed(result.model_used);
    } else {
      setGeneratedCode(`// Error: ${result?.message || 'Failed to generate script'}`);
    }
  };

  const explainScript = async () => {
    if (!generatedCode) return;
    setExplaining(true);
    const result = await window.electronAPI?.ipcInvoke('ollama:code-gen', {
      model: modelUsed,
      system_prompt: 'You are a helpful coding tutor. Explain the following code clearly and concisely.',
      prompt: `Explain this ${language} script in plain English:\n\n${generatedCode}`,
    });
    setExplaining(false);
    if (result?.status === 'ok') setExplanation(result.code || '');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Code2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Script Forge</h1>
          <p className="text-slate-400 text-xs">AI game script generator · DeepSeek Coder V2</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'healthy' ? 'bg-emerald-500' : ollamaStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {ollamaStatus === 'healthy' ? `Ollama · ${modelUsed}` : ollamaStatus === 'error' ? 'Ollama offline' : 'Checking...'}
          </span>
          <button onClick={checkOllama} className="p-1 hover:bg-slate-700 rounded">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {ollamaStatus === 'error' && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">
            Ollama is not running at localhost:11434. Start Ollama and pull deepseek-coder-v2:
            <code className="ml-1 bg-red-900/30 px-1 rounded">ollama pull deepseek-coder-v2</code>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Language */}
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">Language</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        {/* Game context */}
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">Game Context</label>
          <select
            value={gameContext}
            onChange={e => setGameContext(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {GAME_CONTEXTS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block font-medium">Describe what the script should do</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={`e.g. "A Skyrim Papyrus script that gives the player 100 gold when they enter a new area"`}
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
      </div>

      <button
        onClick={generateScript}
        disabled={loading || !description.trim()}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors mb-6"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Generating...' : 'Generate Script'}
      </button>

      {/* Output */}
      {generatedCode && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400 font-medium">Generated Script</label>
            <div className="flex gap-2">
              <button
                onClick={explainScript}
                disabled={explaining}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
              >
                {explaining ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                Explain
              </button>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
              >
                {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
            {generatedCode}
          </pre>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 mb-2 font-medium">AI Explanation</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default GameScriptForge;
