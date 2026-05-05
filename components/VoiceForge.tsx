import React, { useState, useEffect, useRef } from 'react';
import { Mic, RefreshCw, Upload, Download, AlertCircle, Trash2 } from 'lucide-react';

type Tab = 'convert' | 'train' | 'models';

interface RvcModel {
  name: string;
  path: string;
  type: 'pretrained' | 'custom';
}

interface TrainingJob {
  status: string;
  progress: number;
  message?: string;
  model_name?: string;
}

const VoiceForge: React.FC = () => {
  const [tab, setTab] = useState<Tab>('convert');
  const [models, setModels] = useState<RvcModel[]>([]);
  const [serviceStatus, setServiceStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [serviceInfo, setServiceInfo] = useState<any>(null);

  // Convert tab
  const [convertAudio, setConvertAudio] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [pitchShift, setPitchShift] = useState(0);
  const [indexRate, setIndexRate] = useState(0.75);
  const [convertResult, setConvertResult] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  // Train tab
  const [trainFiles, setTrainFiles] = useState<{ name: string; data: string }[]>([]);
  const [modelName, setModelName] = useState('');
  const [epochs, setEpochs] = useState(100);
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null);
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null);
  const [training, setTraining] = useState(false);

  const convertFileRef = useRef<HTMLInputElement>(null);
  const trainFilesRef = useRef<HTMLInputElement>(null);

  useEffect(() => { checkService(); }, []);

  const checkService = async () => {
    const r = await window.electronAPI?.ipcInvoke('rvc:health-check');
    if (r?.status === 'healthy') {
      setServiceStatus('healthy');
      setServiceInfo(r);
    } else {
      setServiceStatus('error');
    }
    const m = await window.electronAPI?.ipcInvoke('rvc:models');
    if (m?.status === 'ok') setModels(m.models || []);
  };

  const loadAudioFile = (file: File, cb: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      cb(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const convertVoice = async () => {
    if (!convertAudio || !selectedModel) return;
    setConverting(true);
    setConvertResult(null);
    const r = await window.electronAPI?.ipcInvoke('rvc:convert', {
      audio_base64: convertAudio,
      model_name: selectedModel,
      pitch_shift: pitchShift,
      index_rate: indexRate,
    });
    setConverting(false);
    if (r?.audio_base64) setConvertResult(r.audio_base64);
  };

  const downloadConverted = () => {
    if (!convertResult) return;
    const binary = atob(convertResult);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startTraining = async () => {
    if (!modelName || trainFiles.length === 0) return;
    setTraining(true);
    const r = await window.electronAPI?.ipcInvoke('rvc:train-model', {
      audio_files_base64: trainFiles,
      model_name: modelName,
      epochs,
    });
    setTraining(false);
    if (r?.job_id) {
      setTrainingJobId(r.job_id);
      setTrainingJob({ status: 'started', progress: 0 });
    }
  };

  const checkTrainingStatus = async () => {
    if (!trainingJobId) return;
    const r = await window.electronAPI?.ipcInvoke('rvc:training-status', trainingJobId);
    if (r?.job) setTrainingJob(r.job);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'convert', label: 'Convert Voice' },
    { id: 'train', label: 'Train Voice' },
    { id: 'models', label: 'Voice Models' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#050910] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Mic className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Voice Forge</h1>
          <p className="text-slate-400 text-xs">RVC voice conversion · Port 8008</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${serviceStatus === 'healthy' ? 'bg-emerald-500' : serviceStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {serviceStatus === 'healthy' ? `RVC Online · ${serviceInfo?.models_found || 0} models` : 'Service Offline'}
          </span>
          <button onClick={checkService} className="p-1 hover:bg-slate-700 rounded">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {serviceStatus === 'error' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300">
            <p className="font-medium mb-1">RVC not installed or service offline</p>
            <p>Install: <code className="bg-amber-900/30 px-1 rounded">pip install git+https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git</code></p>
            <p className="mt-1">Place .pth model files in <code className="bg-amber-900/30 px-1 rounded">~/RVC_models/</code> or <code className="bg-amber-900/30 px-1 rounded">D:/RVC_models/</code></p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Convert Tab */}
      {tab === 'convert' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Audio File</label>
            <div
              className="border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
              onClick={() => convertFileRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              <p className="text-xs text-slate-400">{convertAudio ? '✓ Audio loaded' : 'Click to upload WAV/MP3'}</p>
              <input ref={convertFileRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && loadAudioFile(e.target.files[0], setConvertAudio)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Voice Model</label>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              <option value="">Select a model...</option>
              {models.map(m => <option key={m.name} value={m.name}>{m.name} ({m.type})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Pitch Shift: {pitchShift > 0 ? '+' : ''}{pitchShift}</label>
              <input type="range" min={-12} max={12} value={pitchShift} onChange={e => setPitchShift(parseInt(e.target.value))} className="w-full accent-emerald-500" />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5"><span>-12</span><span>0</span><span>+12</span></div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Index Rate: {indexRate.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.05} value={indexRate} onChange={e => setIndexRate(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5"><span>0</span><span>0.5</span><span>1</span></div>
            </div>
          </div>

          <button onClick={convertVoice} disabled={!convertAudio || !selectedModel || converting} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            {converting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {converting ? 'Converting...' : 'Convert Voice'}
          </button>

          {convertResult && (
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-sm text-emerald-400">✓ Conversion complete</span>
              <button onClick={downloadConverted} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
                <Download className="w-3.5 h-3.5" /> Download WAV
              </button>
            </div>
          )}
        </div>
      )}

      {/* Train Tab */}
      {tab === 'train' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Training Audio Files</label>
            <div
              className="border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
              onClick={() => trainFilesRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              <p className="text-xs text-slate-400">{trainFiles.length > 0 ? `✓ ${trainFiles.length} file(s) loaded` : 'Click to upload audio files (WAV/MP3)'}</p>
              <input
                ref={trainFilesRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  const loaded: typeof trainFiles = [];
                  files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      loaded.push({ name: file.name, data: (ev.target?.result as string).split(',')[1] });
                      if (loaded.length === files.length) setTrainFiles(loaded);
                    };
                    reader.readAsDataURL(file);
                  });
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Model Name</label>
            <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="my_voice_model" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Epochs: {epochs}</label>
            <input type="range" min={50} max={500} step={50} value={epochs} onChange={e => setEpochs(parseInt(e.target.value))} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5"><span>50</span><span>250</span><span>500</span></div>
          </div>

          <button onClick={startTraining} disabled={trainFiles.length === 0 || !modelName || training} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            {training ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {training ? 'Starting...' : 'Start Training'}
          </button>

          {trainingJob && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">Training Status</span>
                <button onClick={checkTrainingStatus} className="p-1 hover:bg-slate-700 rounded">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${trainingJob.progress}%` }} />
              </div>
              <p className="text-xs text-slate-400">{trainingJob.status} · {trainingJob.progress}%</p>
              {trainingJob.message && <p className="text-xs text-amber-300 mt-1">{trainingJob.message}</p>}
            </div>
          )}
        </div>
      )}

      {/* Models Tab */}
      {tab === 'models' && (
        <div>
          {models.length === 0 ? (
            <div className="text-center py-12">
              <Mic className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No RVC models found</p>
              <p className="text-slate-600 text-xs mt-1">Place .pth files in ~/RVC_models/ or D:/RVC_models/</p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700">
                  <Mic className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{m.name}</p>
                    <p className="text-slate-500 text-xs truncate">{m.path}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${m.type === 'custom' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {m.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceForge;
