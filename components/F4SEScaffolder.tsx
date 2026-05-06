import React, { useState, useEffect } from 'react';
import {
  Terminal, Code2, Plus, Minus, Copy, Download, FolderOpen,
  CheckCircle, AlertCircle, RefreshCw, Loader2, Info, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HookEntry { name: string; description: string; }
interface Template { id: string; name: string; description: string; defaults: { hooks: string[]; has_papyrus: boolean; use_address_library: boolean; }; }
interface ScaffoldFiles { [filename: string]: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const ipc = (ch: string, ...args: unknown[]) =>
  (window as any).electronAPI?.ipcInvoke(ch, ...args);

const openDir = () => ipc('dialog:open-directory', { title: 'Choose output folder' });
const writeFile = (path: string, content: string) =>
  ipc('fs:write-text-file', { path, content });

// ── Sub-components ────────────────────────────────────────────────────────────

const Alert: React.FC<{ type?: 'error' | 'info' | 'success'; msg: string }> = ({ type = 'error', msg }) => {
  const cls = {
    error:   'bg-red-500/10 border-red-500/30 text-red-300',
    info:    'bg-blue-500/10 border-blue-500/30 text-blue-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  }[type];
  const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle : Info;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs mb-3 ${cls}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
};

interface FilePreviewProps { filename: string; content: string; }
const FilePreview: React.FC<FilePreviewProps> = ({ filename, content }) => {
  const [open, setOpen] = useState(filename.endsWith('main.cpp'));
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-xs text-white/80 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-mono">{filename}</span>
        <span className="ml-auto text-white/30">{content.length.toLocaleString()} chars</span>
        <button
          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(content); }}
          className="p-1 rounded hover:bg-white/20 transition-colors ml-1"
          title="Copy to clipboard"
        >
          <Copy className="w-3 h-3" />
        </button>
      </button>
      {open && (
        <pre className="text-xs font-mono bg-black/40 text-emerald-300/80 p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
          {content}
        </pre>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const F4SEScaffolder: React.FC = () => {
  // service state
  const [serviceOk, setServiceOk] = useState<boolean | null>(null);
  const [hooks, setHooks]           = useState<HookEntry[]>([]);
  const [templates, setTemplates]   = useState<Template[]>([]);

  // form state
  const [pluginName,     setPluginName]     = useState('MyPlugin');
  const [author,         setAuthor]         = useState('');
  const [versionMajor,   setVersionMajor]   = useState(1);
  const [versionMinor,   setVersionMinor]   = useState(0);
  const [versionPatch,   setVersionPatch]   = useState(0);
  const [selectedHooks,  setSelectedHooks]  = useState<string[]>([]);
  const [hasPapyrus,     setHasPapyrus]     = useState(false);
  const [useAddrLib,     setUseAddrLib]     = useState(true);
  const [trampolineSize, setTrampolineSize] = useState(64);
  const [outputDir,      setOutputDir]      = useState('');

  // result state
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState('');
  const [success,    setSuccess]   = useState('');
  const [files,      setFiles]     = useState<ScaffoldFiles | null>(null);
  const [written,    setWritten]   = useState<string[]>([]);
  const [activeTab,  setActiveTab] = useState<'form' | 'preview'>('form');

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      const h = await ipc('f4se:health-check');
      setServiceOk(h?.status === 'ok');
      const [cat, tmpl] = await Promise.all([
        ipc('f4se:hook-catalog'),
        ipc('f4se:templates'),
      ]);
      if (cat?.hooks)      setHooks(cat.hooks);
      if (tmpl?.templates) setTemplates(tmpl.templates);
    } catch {
      setServiceOk(false);
    }
  }

  function applyTemplate(tmpl: Template) {
    setSelectedHooks(tmpl.defaults.hooks);
    setHasPapyrus(tmpl.defaults.has_papyrus);
    setUseAddrLib(tmpl.defaults.use_address_library);
  }

  function toggleHook(name: string) {
    setSelectedHooks(prev =>
      prev.includes(name) ? prev.filter(h => h !== name) : [...prev, name]
    );
  }

  async function pickOutputDir() {
    const result = await openDir();
    if (result?.filePath) setOutputDir(result.filePath);
  }

  async function handleScaffold() {
    if (!pluginName.trim()) { setError('Plugin name is required.'); return; }
    setLoading(true); setError(''); setSuccess(''); setFiles(null); setWritten([]);
    try {
      const result = await ipc('f4se:scaffold', {
        plugin_name:       pluginName.trim(),
        author:            author.trim() || 'Unknown',
        version_major:     versionMajor,
        version_minor:     versionMinor,
        version_patch:     versionPatch,
        hooks:             selectedHooks,
        has_papyrus:       hasPapyrus,
        use_address_library: useAddrLib,
        trampoline_size:   trampolineSize,
        output_dir:        outputDir || undefined,
      });

      if (result?.status === 'ok') {
        setFiles(result.files);
        setWritten(result.written ?? []);
        const wrote = result.written?.length ?? 0;
        setSuccess(
          wrote > 0
            ? `✓ Generated ${Object.keys(result.files).length} files — wrote ${wrote} to disk.`
            : `✓ Generated ${Object.keys(result.files).length} files. Set an output folder to write them.`
        );
        setActiveTab('preview');
      } else {
        setError(result?.message ?? 'Unknown error from scaffolder service.');
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0d0d14] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
        <Terminal className="w-5 h-5 text-emerald-400" />
        <div>
          <h1 className="text-sm font-semibold">F4SE Plugin Scaffolder</h1>
          <p className="text-[10px] text-white/40">
            Generate ready-to-compile F4SE C++ plugin stubs (CMakeLists, vcpkg.json, main.cpp + hooks)
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {serviceOk === null && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          {serviceOk === true  && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Service ready</span>}
          {serviceOk === false && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Service offline</span>}
          <button onClick={init} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 shrink-0">
        {(['form', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize
              ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {tab === 'form' ? 'Configure' : `Preview${files ? ` (${Object.keys(files).length})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error   && <Alert type="error"   msg={error} />}
        {success && <Alert type="success" msg={success} />}

        {/* ── Configure tab ─────────────────────────────────────────────── */}
        {activeTab === 'form' && (
          <div className="space-y-4 max-w-2xl">

            {/* Quick templates */}
            {templates.length > 0 && (
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Quick Templates</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="text-left p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
                    >
                      <div className="text-xs font-medium text-white/90">{t.name}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Plugin identity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-white/50 block mb-1">Plugin Name *</label>
                <input
                  value={pluginName}
                  onChange={e => setPluginName(e.target.value)}
                  placeholder="MyPlugin"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/50 block mb-1">Author</label>
                <input
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              {/* Version */}
              {([
                ['Major', versionMajor, setVersionMajor],
                ['Minor', versionMinor, setVersionMinor],
                ['Patch', versionPatch, setVersionPatch],
              ] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="text-[10px] text-white/50 block mb-1">Version {label}</label>
                  <input
                    type="number" min={0}
                    value={val}
                    onChange={e => setter(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/50 uppercase tracking-wider block">Options</label>
              {[
                { label: 'Register Papyrus Native Functions', val: hasPapyrus, set: setHasPapyrus },
                { label: 'Use Address Library (recommended)', val: useAddrLib, set: setUseAddrLib },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="accent-emerald-500 w-3.5 h-3.5" />
                  <span className="text-xs text-white/70">{label}</span>
                </label>
              ))}
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Trampoline Size (bytes)</label>
                <input
                  type="number" min={16} max={4096} step={16}
                  value={trampolineSize}
                  onChange={e => setTrampolineSize(Number(e.target.value))}
                  className="w-32 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Hook selector */}
            {hooks.length > 0 && (
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-2">
                  Event Hooks ({selectedHooks.length} selected)
                </label>
                <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-1">
                  {hooks.map(h => (
                    <label
                      key={h.name}
                      className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors
                        ${selectedHooks.includes(h.name)
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-white/5 border border-white/10 hover:border-white/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedHooks.includes(h.name)}
                        onChange={() => toggleHook(h.name)}
                        className="accent-emerald-500 w-3.5 h-3.5 mt-0.5 shrink-0"
                      />
                      <div>
                        <div className="text-xs font-medium text-white/90">{h.name}</div>
                        <div className="text-[10px] text-white/40">{h.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Output folder */}
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Output Folder (optional)</label>
              <div className="flex gap-2">
                <input
                  value={outputDir}
                  onChange={e => setOutputDir(e.target.value)}
                  placeholder="Leave empty to preview only"
                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={pickOutputDir}
                  className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              </div>
              {outputDir && <p className="text-[10px] text-white/30 mt-1">Files will be written to: {outputDir}</p>}
            </div>

            {/* Generate button */}
            <button
              onClick={handleScaffold}
              disabled={loading || !pluginName.trim()}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              {loading ? 'Generating…' : 'Generate Plugin Scaffold'}
            </button>

            {/* Info box */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[10px] text-blue-300/70 space-y-1">
              <p className="font-medium text-blue-300">Build Requirements</p>
              <p>• Visual Studio 2022 (MSVC v143, C++23)</p>
              <p>• CMake 3.21+ and vcpkg with CommonLibF4</p>
              <p>• Set VCPKG_ROOT and SKYRIM_MODS_DIR env vars before configuring</p>
            </div>
          </div>
        )}

        {/* ── Preview tab ────────────────────────────────────────────────── */}
        {activeTab === 'preview' && files && (
          <div className="space-y-2 max-w-3xl">
            {written.length > 0 && (
              <Alert type="success" msg={`Wrote ${written.length} files to disk.`} />
            )}
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/60">{Object.keys(files).length} files generated</span>
            </div>
            {Object.entries(files).map(([name, content]) => (
              <FilePreview key={name} filename={name} content={content} />
            ))}
          </div>
        )}

        {activeTab === 'preview' && !files && (
          <div className="flex flex-col items-center justify-center py-16 text-white/30">
            <Terminal className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No files generated yet.</p>
            <p className="text-xs mt-1">Configure your plugin and click Generate.</p>
            <button onClick={() => setActiveTab('form')} className="mt-4 text-xs text-emerald-400 hover:underline">
              Go to Configure
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default F4SEScaffolder;
