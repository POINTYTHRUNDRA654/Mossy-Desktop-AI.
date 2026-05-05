import React, { useState } from 'react';
import { Wind, RefreshCw, Copy, CheckCircle, Download, Zap, Info } from 'lucide-react';

const SCRIPT_TYPES = [
  'Node2D', 'Node3D', 'CharacterBody2D', 'CharacterBody3D',
  'Area2D', 'Area3D', 'RigidBody3D', 'Control', 'CanvasLayer',
  'Resource', 'Autoload/Singleton',
];

const GODOT_VERSIONS = ['4.0', '4.1', '4.2', '4.3'];

const QUICK_TEMPLATES = [
  { label: 'Player Controller', text: 'A CharacterBody3D player controller with WASD movement, sprint, jump, gravity, and mouse look camera' },
  { label: 'Enemy AI', text: 'An enemy AI Node3D that patrols between waypoints, detects the player within range, and chases them' },
  { label: 'Inventory System', text: 'An autoload inventory system that stores items with name, quantity, and icon, with add/remove/check functions' },
  { label: 'Save/Load Game', text: 'A save/load game system that serializes all player stats and game state to JSON using FileAccess' },
  { label: 'State Machine', text: 'A reusable state machine base class with enter, exit, and update methods, plus transition support' },
  { label: 'Dialogue System', text: 'A dialogue manager that reads dialogue from a JSON file and displays it in a Control UI with typing effect' },
];

const GODOT_TIPS = [
  'Use @export to expose variables in the Inspector',
  'Prefer signals over direct node references',
  'Use autoloads (singletons) for managers (Audio, Save, etc.)',
  'CharacterBody3D.move_and_slide() handles physics for you',
  'Use ResourceLoader.load_threaded_request() for async loading',
  'Groups are great for enemy/player detection without direct refs',
];

const GodotForge: React.FC = () => {
  const [scriptType, setScriptType] = useState('CharacterBody3D');
  const [godotVersion, setGodotVersion] = useState('4.3');
  const [description, setDescription] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [generatedScene, setGeneratedScene] = useState('');
  const [explanation, setExplanation] = useState('');
  const [genScene, setGenScene] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const SYSTEM_PROMPT = `You are an expert Godot ${godotVersion} GDScript developer.
Generate clean, well-commented GDScript 4.x code following Godot best practices.
Script extends: ${scriptType}
Always include @tool if needed, proper @export annotations, and signal declarations.
Use gdscript syntax, not C#.`;

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setGeneratedScript('');
    setGeneratedScene('');
    setExplanation('');

    const sceneNote = genScene ? '\nAlso provide a companion .tscn scene file in TSCN format after the GDScript.' : '';
    const r = await window.electronAPI?.ipcInvoke('ollama:code-gen', {
      model: 'deepseek-coder-v2',
      system_prompt: SYSTEM_PROMPT,
      prompt: `Create a Godot ${godotVersion} GDScript extending ${scriptType}.\n\nTask: ${description}${sceneNote}\n\nProvide the complete GDScript file.`,
    }).catch(() => null);

    let code = '';
    if (!r || r.status !== 'ok') {
      const r2 = await window.electronAPI?.ipcInvoke('gemma:run-inference', {
        prompt: `${SYSTEM_PROMPT}\n\nTask: ${description}\n\nGenerate the GDScript:`,
      });
      code = r2?.response || r2?.text || '# Error generating script';
    } else {
      code = r.code || '';
    }

    if (genScene && code.includes('[gd_scene')) {
      const parts = code.split('[gd_scene');
      setGeneratedScript(parts[0].trim());
      setGeneratedScene('[gd_scene' + parts[1]);
    } else {
      setGeneratedScript(code);
    }
    setLoading(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveFile = (content: string, ext: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scriptType.toLowerCase()}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Wind className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Godot Forge</h1>
          <p className="text-slate-400 text-xs">GDScript generator · Mossy AI</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Script Type (extends)</label>
          <select value={scriptType} onChange={e => setScriptType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
            {SCRIPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Godot Version</label>
          <select value={godotVersion} onChange={e => setGodotVersion(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
            {GODOT_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Quick templates */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">Quick Templates</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setDescription(t.text)} className="px-2.5 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] transition-colors">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400 mb-1.5 block">Describe the script</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. A player controller with WASD movement, jump, and camera mouse look..."
          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={genScene} onChange={e => setGenScene(e.target.checked)} className="rounded" />
          <span className="text-xs text-slate-400">Generate .tscn scene file</span>
        </label>
      </div>

      <button onClick={generate} disabled={loading || !description.trim()} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors mb-6">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Generating...' : 'Generate GDScript'}
      </button>

      {generatedScript && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">{scriptType}.gd · Godot {godotVersion}</span>
            <div className="flex gap-2">
              <button onClick={() => copy(generatedScript)} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
              </button>
              <button onClick={() => saveFile(generatedScript, 'gd')} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                <Download className="w-3 h-3" /> Save .gd
              </button>
            </div>
          </div>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto font-mono leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
            {generatedScript}
          </pre>
        </div>
      )}

      {generatedScene && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Scene File (.tscn)</span>
            <button onClick={() => saveFile(generatedScene, 'tscn')} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
              <Download className="w-3 h-3" /> Save .tscn
            </button>
          </div>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 overflow-x-auto font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
            {generatedScene}
          </pre>
        </div>
      )}

      {/* Tips */}
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-xs text-blue-400 font-medium">Godot Best Practices</p>
        </div>
        <ul className="space-y-1">
          {GODOT_TIPS.map((tip, i) => (
            <li key={i} className="text-[11px] text-slate-500">• {tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GodotForge;
