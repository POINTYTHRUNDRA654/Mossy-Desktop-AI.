import React, { useState, useEffect } from 'react';
import { Monitor, Camera, Eye, Type, Cpu, RefreshCw, AlertCircle } from 'lucide-react';

interface HudElement {
  type: string;
  bounds: { x: number; y: number; w: number; h: number };
  color: string;
  value: number;
}

const GameVision: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotDims, setScreenshotDims] = useState({ width: 0, height: 0 });
  const [hudElements, setHudElements] = useState<HudElement[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [region, setRegion] = useState({ x: 0, y: 0, w: 1920, h: 1080 });
  const [useRegion, setUseRegion] = useState(false);

  useEffect(() => { checkService(); }, []);

  const checkService = async () => {
    const r = await window.electronAPI?.ipcInvoke('vision:health-check');
    setServiceStatus(r?.status === 'healthy' ? 'healthy' : 'error');
  };

  const captureScreen = async () => {
    setLoading('capture');
    const payload = useRegion ? { region } : {};
    const r = await window.electronAPI?.ipcInvoke('vision:screenshot', payload);
    setLoading(null);
    if (r?.status === 'ok') {
      setScreenshot(r.image_base64);
      setScreenshotDims({ width: r.width, height: r.height });
      setHudElements([]);
      setOcrText('');
      setGameState(null);
    }
  };

  const analyzeHud = async () => {
    if (!screenshot) return;
    setLoading('hud');
    const r = await window.electronAPI?.ipcInvoke('vision:analyze-hud', { image_base64: screenshot });
    setLoading(null);
    if (r?.status === 'ok') setHudElements(r.elements || []);
  };

  const extractText = async () => {
    if (!screenshot) return;
    setLoading('ocr');
    const r = await window.electronAPI?.ipcInvoke('vision:ocr-text', { image_base64: screenshot });
    setLoading(null);
    if (r?.text !== undefined) setOcrText(r.text);
  };

  const detectState = async () => {
    if (!screenshot) return;
    setLoading('state');
    const r = await window.electronAPI?.ipcInvoke('vision:detect-game-state', { image_base64: screenshot });
    setLoading(null);
    if (r?.status === 'ok') setGameState(r);
  };

  const HUD_COLORS: Record<string, string> = {
    health: 'border-red-500 text-red-400',
    mana: 'border-blue-500 text-blue-400',
    stamina: 'border-green-500 text-green-400',
    xp: 'border-yellow-500 text-yellow-400',
  };

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Monitor className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Game Vision</h1>
          <p className="text-slate-400 text-xs">OpenCV screen analysis · Port 8005</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${serviceStatus === 'healthy' ? 'bg-emerald-500' : serviceStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {serviceStatus === 'healthy' ? 'OpenCV Online' : serviceStatus === 'error' ? 'Service Offline' : 'Checking...'}
          </span>
          <button onClick={checkService} className="p-1 hover:bg-slate-700 rounded">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {serviceStatus === 'error' && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">
            OpenCV service offline. Install: <code className="bg-red-900/30 px-1 rounded">pip install opencv-python mss pytesseract</code>
          </p>
        </div>
      )}

      {/* Region Selector */}
      <div className="mb-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox" id="use-region" checked={useRegion} onChange={e => setUseRegion(e.target.checked)} className="rounded" />
          <label htmlFor="use-region" className="text-xs text-slate-300 font-medium cursor-pointer">Use custom region</label>
        </div>
        {useRegion && (
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'w', 'h'] as const).map(key => (
              <div key={key}>
                <label className="text-[10px] text-slate-500 block mb-1 uppercase">{key}</label>
                <input
                  type="number"
                  value={region[key]}
                  onChange={e => setRegion(r => ({ ...r, [key]: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={captureScreen}
          disabled={loading === 'capture'}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading === 'capture' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          Capture Screen
        </button>
        <button
          onClick={analyzeHud}
          disabled={!screenshot || loading === 'hud'}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading === 'hud' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Analyze HUD
        </button>
        <button
          onClick={extractText}
          disabled={!screenshot || loading === 'ocr'}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading === 'ocr' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
          Extract Text
        </button>
        <button
          onClick={detectState}
          disabled={!screenshot || loading === 'state'}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading === 'state' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
          Detect State
        </button>
      </div>

      {/* Screenshot preview */}
      {screenshot && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 font-medium">Captured Screenshot</p>
            <span className="text-xs text-slate-500">{screenshotDims.width}×{screenshotDims.height}</span>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="Screenshot"
              className="w-full h-auto max-h-80 object-contain"
            />
            {/* HUD overlay */}
            {hudElements.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {hudElements.map((el, i) => {
                  const wPct = (el.bounds.w / screenshotDims.width) * 100;
                  const hPct = (el.bounds.h / screenshotDims.height) * 100;
                  const xPct = (el.bounds.x / screenshotDims.width) * 100;
                  const yPct = (el.bounds.y / screenshotDims.height) * 100;
                  return (
                    <div
                      key={i}
                      style={{ left: `${xPct}%`, top: `${yPct}%`, width: `${wPct}%`, height: `${Math.max(hPct, 0.5)}%` }}
                      className={`absolute border-2 ${HUD_COLORS[el.type] || 'border-white text-white'} rounded`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HUD Elements */}
        {hudElements.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
            <p className="text-xs text-slate-400 font-medium mb-3">Detected HUD Elements ({hudElements.length})</p>
            <div className="space-y-2">
              {hudElements.map((el, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${HUD_COLORS[el.type] || 'border-slate-600 text-slate-400'} bg-slate-900/50`}>
                  <span className="text-xs font-medium capitalize">{el.type}</span>
                  <span className="text-xs">{el.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OCR Text */}
        {ocrText && (
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
            <p className="text-xs text-slate-400 font-medium mb-3">Extracted Text</p>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
              {ocrText || '(no text detected)'}
            </pre>
          </div>
        )}

        {/* Game State */}
        {gameState && (
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 col-span-full">
            <p className="text-xs text-slate-400 font-medium mb-3">Game State Analysis</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-400 capitalize">{gameState.estimated_state}</div>
                <div className="text-[10px] text-slate-500">State</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-400">{gameState.brightness?.toFixed(0)}</div>
                <div className="text-[10px] text-slate-500">Brightness</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-400">{gameState.saturation?.toFixed(0)}</div>
                <div className="text-[10px] text-slate-500">Saturation</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-400">{(gameState.edge_density * 100)?.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">Edge Density</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameVision;
