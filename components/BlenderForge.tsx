import React, { useState, useEffect } from 'react';
import { Box, RefreshCw, Copy, CheckCircle, Download, Zap, Sparkles, Settings, FileText } from 'lucide-react';

const TASK_CATEGORIES = [
  // Standard Blender
  'UV Unwrapping', 'LOD Generation', 'Batch Export', 'Texture Baking',
  'Armature Rigging', 'Particle Systems', 'Geometry Nodes',
  'Animation', 'Material Setup', 'Custom Tool',
  // NVIDIA Omniverse
  'Omniverse Scene Optimization', 'Material Conversion (Omniverse)',
  'Particle Baking', 'Audio2Face Setup', 'Omniverse Material Baking',
];

const BLENDER_VERSIONS = ['3.6 LTS', '4.0', '4.1', '4.2 LTS'];

const QUICK_TEMPLATES = [
  { label: 'UV Smart Project', text: 'UV unwrap all selected objects using Smart UV Project with angle limit 66° and island margin 0.02' },
  { label: 'Export FBX Batch', text: 'Export all selected objects as individual FBX files to a user-specified output directory' },
  { label: 'Auto LOD', text: 'Generate 3 levels of LOD for selected mesh using decimate modifier at 50%, 25%, and 10%' },
  { label: 'Bake Diffuse', text: 'Bake diffuse texture for selected object to a 2K PNG image file' },
  { label: 'Rename Bones', text: 'Batch rename all bones in the active armature by adding a prefix and converting to lowercase' },
  { label: 'Origin to Bottom', text: 'Set origin of all selected objects to the bottom center of their bounding box' },
];

const OMNIVERSE_TEMPLATES = [
  { label: 'Optimize Scene', text: 'Run Omniverse Scene Optimizer on all meshes: fix normals, remove doubles, decimate by 50%, and generate auto UVs' },
  { label: 'Convert Material', text: 'Convert Blender material to Omniverse standard with PBR texture baking and USD export' },
  { label: 'Particle Bake', text: 'Bake particle simulation to mesh sequence and export to Omniverse format with shape keys' },
  { label: 'Audio2Face Export', text: 'Prepare rigged character for Audio2Face by exporting mesh, skeleton, and blend shapes to USD' },
  { label: 'Material Bake', text: 'Bake all selected materials to individual texture maps optimized for Omniverse' },
  { label: 'Proxy Geometry', text: 'Generate simplified proxy geometry for Omniverse LOD system with collision shapes' },
];

interface TabType {
  id: 'standard' | 'omniverse';
  label: string;
  icon: React.ReactNode;
}

const TABS: TabType[] = [
  { id: 'standard', label: 'Standard Blender', icon: <Box className="w-4 h-4" /> },
  { id: 'omniverse', label: 'NVIDIA Omniverse', icon: <Sparkles className="w-4 h-4" /> },
];

const BlenderForge: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standard' | 'omniverse'>('standard');
  const [category, setCategory] = useState('UV Unwrapping');
  const [blenderVersion, setBlenderVersion] = useState('4.2 LTS');
  const [description, setDescription] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOmniverseMode = activeTab === 'omniverse';
  const templates = isOmniverseMode ? OMNIVERSE_TEMPLATES : QUICK_TEMPLATES;
  const categories = isOmniverseMode 
    ? TASK_CATEGORIES.filter(c => c.includes('Omniverse') || c === 'Material Conversion (Omniverse)' || c === 'Particle Baking' || c === 'Audio2Face Setup' || c === 'Omniverse Material Baking')
    : TASK_CATEGORIES.filter(c => !c.includes('Omniverse') && c !== 'Material Conversion (Omniverse)' && c !== 'Particle Baking' && c !== 'Audio2Face Setup' && c !== 'Omniverse Material Baking');

  // Reset category when switching tabs
  useEffect(() => {
    if (isOmniverseMode && !category.includes('Omniverse') && category !== 'Particle Baking' && category !== 'Audio2Face Setup' && category !== 'Material Conversion (Omniverse)') {
      setCategory('Omniverse Scene Optimization');
    } else if (!isOmniverseMode && (category.includes('Omniverse') || category === 'Particle Baking' || category === 'Audio2Face Setup' || category === 'Material Conversion (Omniverse)' || category === 'Omniverse Material Baking')) {
      setCategory('UV Unwrapping');
    }
  }, [isOmniverseMode, category]);

  const SYSTEM_PROMPT = isOmniverseMode
    ? `You are an expert Blender Python (bpy) developer AND NVIDIA Omniverse addon developer targeting Blender ${blenderVersion}.
You have deep knowledge of the NVIDIA Omniverse Blender addons:
- omni_panel: Material conversion, particle baking, compositing, material baking
- omni_audio2face: Character prep, mesh export, skeleton setup, shape keys/blend shapes
- omni_optimization_panel: Scene optimization, mesh fixing, decimation, auto UV generation, proxy geometry

Generate production-grade bpy scripts that integrate with these addons. Always include:
- import bpy at the top
- Conditional imports for Omniverse addon modules where applicable
- A main() function with proper error handling
- if __name__ == "__main__": main()
- Full docstrings and inline comments
- Try/except blocks with informative error messages
- Validation of Omniverse addon availability

Category: ${category}
Blender Version: ${blenderVersion}`
    : `You are an expert Blender Python (bpy) developer targeting Blender ${blenderVersion}.
Generate clean, well-commented bpy scripts. Always include:
- import bpy at the top
- A main() function
- if __name__ == "__main__": main()
- Error handling with try/except
- Docstrings and inline comments
Category: ${category}
Blender Version: ${blenderVersion}`;

  const generateScript = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setGeneratedScript('');
    setExplanation('');

    const r = await window.electronAPI?.ipcInvoke('ollama:code-gen', {
      model: 'deepseek-coder-v2',
      system_prompt: SYSTEM_PROMPT,
      prompt: `Task: ${description}\n\nGenerate a complete Blender ${blenderVersion} Python script for this task.`,
    }).catch(() => null);

    if (!r || r.status !== 'ok') {
      const r2 = await window.electronAPI?.ipcInvoke('gemma:run-inference', {
        prompt: `${SYSTEM_PROMPT}\n\nTask: ${description}\n\nGenerate a complete Blender ${blenderVersion} Python script:`,
      });
      setGeneratedScript(r2?.response || r2?.text || `# Error generating script`);
    } else {
      setGeneratedScript(r.code || '');
    }
    setLoading(false);
  };

  const explainScript = async () => {
    if (!generatedScript) return;
    setExplaining(true);
    const r = await window.electronAPI?.ipcInvoke('gemma:run-inference', {
      prompt: `Explain this Blender ${isOmniverseMode ? 'Omniverse' : ''} Python script in plain English, step by step:\n\n${generatedScript}`,
    });
    setExplaining(false);
    setExplanation(r?.response || r?.text || '');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveScript = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blender_${isOmniverseMode ? 'omni_' : ''}${category.toLowerCase().replace(/\s+/g, '_')}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl ${isOmniverseMode ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-emerald-600/20 border border-emerald-500/30'} flex items-center justify-center transition-all`}>
          {isOmniverseMode ? (
            <Sparkles className="w-5 h-5 text-purple-400" />
          ) : (
            <Box className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Blender Forge</h1>
          <p className="text-slate-400 text-xs">{isOmniverseMode ? 'Omniverse addons' : 'bpy script generator'} · Mossy AI</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Task Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Blender Version</label>
          <select
            value={blenderVersion}
            onChange={e => setBlenderVersion(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {BLENDER_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Quick templates */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">{isOmniverseMode ? 'Omniverse' : 'Quick'} Templates</p>
        <div className="flex flex-wrap gap-1.5">
          {templates.map(t => (
            <button
              key={t.label}
              onClick={() => setDescription(t.text)}
              className={`px-2.5 py-1 rounded-full text-slate-300 text-[11px] transition-colors ${
                isOmniverseMode
                  ? 'bg-purple-700/30 hover:bg-purple-600/40 border border-purple-600/50'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block">Describe what the script should do</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder={isOmniverseMode ? "Describe your Omniverse workflow in plain English..." : "Describe your Blender task in plain English..."}
          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder-slate-600"
        />
      </div>

      <button
        onClick={generateScript}
        disabled={loading || !description.trim()}
        className={`flex items-center gap-2 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors mb-6 disabled:bg-slate-700 disabled:text-slate-500 ${
          isOmniverseMode
            ? 'bg-purple-600 hover:bg-purple-500 disabled:hover:bg-slate-700'
            : 'bg-emerald-600 hover:bg-emerald-500 disabled:hover:bg-slate-700'
        }`}
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Generating...' : `Generate ${isOmniverseMode ? 'Omniverse' : 'bpy'} Script`}
      </button>

      {generatedScript && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">Generated Script</span>
              <span className="ml-2 text-[10px] text-slate-600">Blender {blenderVersion} · {category}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={explainScript} disabled={explaining} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                {explaining ? <RefreshCw className="w-3 h-3 animate-spin" /> : null} Explain
              </button>
              <button onClick={copyScript} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={saveScript} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
                <Download className="w-3 h-3" /> Save .py
              </button>
            </div>
          </div>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-200 overflow-x-auto font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
            {generatedScript}
          </pre>
        </div>
      )}

      {explanation && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 mb-2 font-medium">AI Explanation</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{explanation}</p>
        </div>
      )}

      {/* Omniverse Info Panel */}
      {isOmniverseMode && (
        <div className="mt-6 p-4 rounded-xl bg-purple-900/20 border border-purple-700/30">
          <p className="text-xs text-purple-300 mb-2 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            NVIDIA Omniverse Integration
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            This script integrates with NVIDIA Omniverse Blender addons. Ensure addons are installed:
            <br/>• <code className="text-purple-400">omni_panel</code> - Material & particle workflows
            <br/>• <code className="text-purple-400">omni_audio2face</code> - Character animation prep
            <br/>• <code className="text-purple-400">omni_optimization_panel</code> - Scene optimization
          </p>
        </div>
      )}
    </div>
  );
};

export default BlenderForge;
