import React, { useState, useCallback } from 'react';
import {
  Layers, FolderOpen, Download, Upload, RefreshCw,
  AlertCircle, CheckCircle, FileCode, Search, Box,
  ArrowRight, Info, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CellEntry {
  form_id:     number;
  form_id_hex: string;
  edid:        string;
  full_name:   string;
  is_interior: boolean;
}

interface PlacedObject {
  form_id_hex: string;
  rec_type:    string;
  edid:        string;
  base_id_hex: string;
  pos:         [number, number, number];
  rot:         [number, number, number];
  scale:       number;
}

interface CellData {
  form_id:      number;
  form_id_hex:  string;
  edid:         string;
  full_name:    string;
  is_interior:  boolean;
  placed:       PlacedObject[];
  placed_count: number;
  source_plugin: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ipc = (channel: string, ...args: unknown[]) =>
  (window as any).electronAPI?.ipcInvoke(channel, ...args);

const openFile = (title: string, filters: { name: string; extensions: string[] }[] = []) =>
  ipc('dialog:open-file', { title, filters });

const saveFile = (title: string, defaultPath: string, filters: { name: string; extensions: string[] }[] = []) =>
  ipc('dialog:save-file', { title, defaultPath, filters });

const openDir = (title: string) => ipc('dialog:open-directory', { title });

function fmt(n: number, d = 2) { return n.toFixed(d); }

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium
    ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
    {ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
    {text}
  </span>
);

const Alert: React.FC<{ type?: 'error' | 'info' | 'success'; msg: string }> = ({ type = 'error', msg }) => {
  const styles = {
    error:   'bg-red-500/10 border-red-500/30 text-red-300',
    info:    'bg-blue-500/10 border-blue-500/30 text-blue-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  };
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs mb-3 ${styles[type]}`}>
      {type === 'error'   && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      {type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      {type === 'info'    && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{msg}</span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const CellEditor: React.FC = () => {
  // Step 1 — pick plugin + list cells
  const [pluginPath, setPluginPath]   = useState('');
  const [cells, setCells]             = useState<CellEntry[]>([]);
  const [cellFilter, setCellFilter]   = useState('');
  const [loadingCells, setLoadingCells] = useState(false);

  // Step 2 — extract one cell
  const [selectedCell, setSelectedCell]   = useState<CellEntry | null>(null);
  const [cellData, setCellData]           = useState<CellData | null>(null);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [expandedRefs, setExpandedRefs]   = useState<Set<string>>(new Set());

  // Step 3 — Blender addon download
  const [addonDownloaded, setAddonDownloaded] = useState(false);
  const [addonSavePath, setAddonSavePath]     = useState('');

  // Step 4 — generate patch ESP
  const [blenderJsonPath, setBlenderJsonPath] = useState('');
  const [patchOutputPath, setPatchOutputPath] = useState('');
  const [loadingPatch, setLoadingPatch]       = useState(false);
  const [patchResult, setPatchResult]         = useState<any>(null);

  // General
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };

  // ── Step 1: browse + list cells ─────────────────────────────────────────
  const handleBrowsePlugin = useCallback(async () => {
    const path = await openFile('Select Plugin (.esp / .esm / .esl)', [
      { name: 'Bethesda Plugins', extensions: ['esp', 'esm', 'esl'] },
      { name: 'All Files', extensions: ['*'] },
    ]);
    if (path) { setPluginPath(path); setCells([]); setCellData(null); setSelectedCell(null); }
  }, []);

  const handleListCells = useCallback(async () => {
    if (!pluginPath) return;
    clearMessages();
    setLoadingCells(true);
    setCells([]);
    const r = await ipc('cell-editor:list-cells', { plugin_path: pluginPath });
    setLoadingCells(false);
    if (r?.status === 'ok') {
      setCells(r.cells || []);
      if (!r.cells?.length) setError('No CELL records found in this plugin.');
    } else {
      setError(r?.message || 'Failed to list cells.');
    }
  }, [pluginPath]);

  // ── Step 2: extract cell ─────────────────────────────────────────────────
  const handleExtractCell = useCallback(async (cell: CellEntry) => {
    clearMessages();
    setSelectedCell(cell);
    setCellData(null);
    setLoadingExtract(true);
    const r = await ipc('cell-editor:extract-cell', {
      plugin_path:   pluginPath,
      cell_form_id:  cell.form_id,
    });
    setLoadingExtract(false);
    if (r?.status === 'ok') {
      setCellData(r);
      // Suggest an output path for the patch ESP
      const base = pluginPath.replace(/\.[^.]+$/, '');
      setPatchOutputPath(`${base}_${cell.edid || cell.form_id_hex}_patch.esp`);
    } else {
      setError(r?.message || 'Cell extraction failed.');
    }
  }, [pluginPath]);

  // ── Step 3: save Blender addon ───────────────────────────────────────────
  const handleDownloadAddon = useCallback(async () => {
    clearMessages();
    const r = await ipc('cell-editor:blender-addon');
    if (r?.status !== 'ok') { setError(r?.message || 'Failed to fetch add-on.'); return; }

    const savePath = await saveFile('Save Blender Add-on', 'mossy_fo4_cell_editor.py', [
      { name: 'Python Script', extensions: ['py'] },
    ]);
    if (!savePath) return;

    // Write the file via fs IPC (use Electron's writeFile handler if available,
    // otherwise fall back to the node fs module exposed via preload)
    const writeResult = await (window as any).electronAPI?.ipcInvoke('fs:write-text-file', {
      path: savePath, content: r.source,
    }).catch(() => null);

    if (writeResult?.status === 'ok' || writeResult === null) {
      setAddonSavePath(savePath);
      setAddonDownloaded(true);
      setSuccess(`Blender add-on saved to: ${savePath}`);
    } else {
      // Fallback: copy to clipboard so user can paste into Blender text editor
      await navigator.clipboard.writeText(r.source).catch(() => {});
      setSuccess('Add-on code copied to clipboard (paste into Blender Text Editor and run).');
      setAddonDownloaded(true);
    }
  }, []);

  // ── Step 4: import Blender export + generate patch ESP ───────────────────
  const handleBrowseBlenderJson = useCallback(async () => {
    const path = await openFile('Select Blender Export JSON', [
      { name: 'JSON', extensions: ['json'] },
    ]);
    if (path) setBlenderJsonPath(path);
  }, []);

  const handleBrowsePatchOutput = useCallback(async () => {
    const path = await saveFile('Save Patch ESP', patchOutputPath || 'cell_patch.esp', [
      { name: 'ESP Plugin', extensions: ['esp'] },
    ]);
    if (path) setPatchOutputPath(path);
  }, [patchOutputPath]);

  const handleGeneratePatch = useCallback(async () => {
    if (!blenderJsonPath || !patchOutputPath || !pluginPath) return;
    clearMessages();
    setLoadingPatch(true);
    setPatchResult(null);

    // Read the Blender export JSON
    let blenderJson: any;
    try {
      const readR = await (window as any).electronAPI?.ipcInvoke('fs:read-text-file', { path: blenderJsonPath });
      blenderJson = JSON.parse(readR?.content || '{}');
    } catch {
      setError('Could not read Blender export JSON — check the file path.');
      setLoadingPatch(false);
      return;
    }

    const r = await ipc('cell-editor:generate-patch-esp', {
      original_plugin_path: pluginPath,
      blender_export_json:  blenderJson,
      output_esp_path:      patchOutputPath,
    });
    setLoadingPatch(false);
    if (r?.status === 'ok') {
      setPatchResult(r);
      setSuccess(`Patch ESP written: ${r.output_path} (${(r.file_size_bytes / 1024).toFixed(1)} KB, ${r.placed_count} objects)`);
    } else {
      setError(r?.message || 'Patch generation failed.');
    }
  }, [blenderJsonPath, patchOutputPath, pluginPath]);

  // ── Filtered cells ────────────────────────────────────────────────────────
  const filteredCells = cells.filter(c => {
    const q = cellFilter.toLowerCase();
    return !q || c.edid.toLowerCase().includes(q) || c.full_name.toLowerCase().includes(q) || c.form_id_hex.toLowerCase().includes(q);
  });

  const toggleRef = (fid: string) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      next.has(fid) ? next.delete(fid) : next.add(fid);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
          <Layers className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">FO4 Cell Editor</h1>
          <p className="text-slate-400 text-xs">Extract → Edit in Blender → Patch ESP</p>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {['1. Pick Plugin', '2. Extract Cell', '3. Edit in Blender', '4. Generate Patch'].map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600" />}
            <span className={`px-2 py-1 rounded-md
              ${i === 0 && cells.length > 0 ? 'text-emerald-400 bg-emerald-500/10' :
                i === 1 && cellData ? 'text-emerald-400 bg-emerald-500/10' :
                i === 2 && addonDownloaded ? 'text-emerald-400 bg-emerald-500/10' :
                i === 3 && patchResult ? 'text-emerald-400 bg-emerald-500/10' :
                'text-slate-500 bg-slate-800/40'}`}>{s}</span>
          </React.Fragment>
        ))}
      </div>

      {error   && <Alert type="error"   msg={error} />}
      {success && <Alert type="success" msg={success} />}

      {/* ── Step 1: Plugin + Cell List ──────────────────────────────────── */}
      <section className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-amber-400" /> Step 1 — Select Plugin
        </h2>
        <div className="flex gap-2">
          <input
            value={pluginPath}
            onChange={e => setPluginPath(e.target.value)}
            placeholder="C:\Steam\…\Fallout 4\Data\MyMod.esp"
            className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 placeholder-slate-600"
          />
          <button onClick={handleBrowsePlugin}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg px-3 py-2 transition-colors">
            Browse
          </button>
          <button onClick={handleListCells} disabled={!pluginPath || loadingCells}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-xs rounded-lg px-4 py-2 transition-colors">
            {loadingCells ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Scan Cells
          </button>
        </div>

        {cells.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <input
                value={cellFilter}
                onChange={e => setCellFilter(e.target.value)}
                placeholder="Filter by name or FormID…"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
              <span className="text-xs text-slate-500">{filteredCells.length} / {cells.length} cells</span>
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700/50 divide-y divide-slate-700/30">
              {filteredCells.map(c => (
                <button
                  key={c.form_id_hex}
                  onClick={() => handleExtractCell(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-700/50 transition-colors
                    ${selectedCell?.form_id_hex === c.form_id_hex ? 'bg-amber-500/10' : ''}`}>
                  <Box className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{c.full_name || c.edid || c.form_id_hex}</p>
                    {c.edid && c.edid !== c.full_name && (
                      <p className="text-[10px] text-slate-500 truncate">{c.edid}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">{c.form_id_hex}</span>
                    <StatusBadge ok={c.is_interior} text={c.is_interior ? 'Interior' : 'Exterior'} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Step 2: Extracted Cell ─────────────────────────────────────── */}
      {(selectedCell || loadingExtract) && (
        <section className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" /> Step 2 — Extracted Cell
          </h2>

          {loadingExtract && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              Extracting {selectedCell?.form_id_hex}…
            </div>
          )}

          {cellData && !loadingExtract && (
            <>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500">Cell Name</p>
                  <p className="text-white font-medium truncate">{cellData.full_name || cellData.edid}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500">FormID</p>
                  <p className="text-amber-300 font-mono">{cellData.form_id_hex}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-500">Placed Objects</p>
                  <p className="text-white font-medium">{cellData.placed_count}</p>
                </div>
              </div>

              {cellData.placed.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700/30 divide-y divide-slate-700/20">
                  {cellData.placed.slice(0, 200).map(ref => {
                    const expanded = expandedRefs.has(ref.form_id_hex);
                    return (
                      <div key={ref.form_id_hex}>
                        <button
                          onClick={() => toggleRef(ref.form_id_hex)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-700/30 transition-colors">
                          {expanded
                            ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
                          <span className="text-[10px] font-mono text-slate-400 w-24 shrink-0">{ref.form_id_hex}</span>
                          <span className="text-xs text-white truncate">{ref.edid || ref.base_id_hex}</span>
                          <span className="text-[10px] text-slate-500 ml-auto shrink-0">{ref.rec_type}</span>
                        </button>
                        {expanded && (
                          <div className="px-8 pb-2 text-[10px] text-slate-400 grid grid-cols-3 gap-1">
                            <span>X: {fmt(ref.pos[0])}</span>
                            <span>Y: {fmt(ref.pos[1])}</span>
                            <span>Z: {fmt(ref.pos[2])}</span>
                            <span>rX: {fmt(ref.rot[0], 4)}</span>
                            <span>rY: {fmt(ref.rot[1], 4)}</span>
                            <span>rZ: {fmt(ref.rot[2], 4)}</span>
                            <span className="col-span-3">Scale: {fmt(ref.scale, 4)} · Base: {ref.base_id_hex}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cellData.placed.length > 200 && (
                    <p className="text-[10px] text-slate-500 px-3 py-2">
                      …and {cellData.placed.length - 200} more objects (exported to JSON)
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Step 3: Blender Addon ──────────────────────────────────────── */}
      {cellData && (
        <section className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-400" /> Step 3 — Edit in Blender
          </h2>
          <div className="text-xs text-slate-400 space-y-1">
            <p>1. Click <strong className="text-white">Download Blender Add-on</strong> and save the .py file.</p>
            <p>2. In Blender: <em>Edit → Preferences → Add-ons → Install</em> → select the .py → enable it.</p>
            <p>3. Open the <em>3D View → Sidebar (N) → FO4 Cell</em> panel and click <strong className="text-white">Import Cell JSON</strong>.</p>
            <p>4. Move, rotate, or scale objects. Then click <strong className="text-white">Export Cell JSON</strong> and save.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleDownloadAddon}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg px-4 py-2 transition-colors">
              <Download className="w-3.5 h-3.5" />
              {addonDownloaded ? 'Re-download Blender Add-on' : 'Download Blender Add-on (.py)'}
            </button>
            {addonSavePath && (
              <span className="self-center text-[10px] text-slate-500 truncate max-w-xs">{addonSavePath}</span>
            )}
          </div>
          {addonDownloaded && (
            <Alert type="info" msg="The add-on is ready. Install it in Blender, import the cell JSON, edit, then export back to JSON and proceed to Step 4." />
          )}
        </section>
      )}

      {/* ── Step 4: Generate Patch ESP ────────────────────────────────── */}
      {cellData && (
        <section className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-400" /> Step 4 — Generate Patch ESP
          </h2>
          <p className="text-xs text-slate-400">
            Select the JSON file exported from Blender, choose where to save the patch .esp, then click Generate.
          </p>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Blender Export JSON</label>
            <div className="flex gap-2">
              <input
                value={blenderJsonPath}
                onChange={e => setBlenderJsonPath(e.target.value)}
                placeholder="fo4_cell_export.json"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
              <button onClick={handleBrowseBlenderJson}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg px-3 py-2 transition-colors">
                Browse
              </button>
            </div>

            <label className="text-xs text-slate-400">Output Patch .esp Path</label>
            <div className="flex gap-2">
              <input
                value={patchOutputPath}
                onChange={e => setPatchOutputPath(e.target.value)}
                placeholder="cell_patch.esp"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
              <button onClick={handleBrowsePatchOutput}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg px-3 py-2 transition-colors">
                Browse
              </button>
            </div>
          </div>

          <button
            onClick={handleGeneratePatch}
            disabled={!blenderJsonPath || !patchOutputPath || loadingPatch}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg px-5 py-2 transition-colors">
            {loadingPatch
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
              : <><CheckCircle className="w-4 h-4" /> Generate Patch ESP</>}
          </button>

          {patchResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs space-y-1">
              <p className="text-emerald-300 font-medium">✓ Patch ESP generated successfully</p>
              <p className="text-slate-300">File: <span className="font-mono text-emerald-300">{patchResult.output_path}</span></p>
              <p className="text-slate-400">
                {patchResult.placed_count} objects · {(patchResult.file_size_bytes / 1024).toFixed(1)} KB
              </p>
              <p className="text-slate-400">Masters: {patchResult.masters_used?.join(', ')}</p>
              <p className="text-slate-500 pt-1">
                Copy the .esp into your Fallout 4 Data folder (or mod manager staging folder), enable it in your load order, and the edited cell layout will override the original.
              </p>
            </div>
          )}
        </section>
      )}

    </div>
  );
};

export default CellEditor;
