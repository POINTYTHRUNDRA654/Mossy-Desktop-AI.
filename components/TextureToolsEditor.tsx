import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Zap, FileJson, Loader } from 'lucide-react';

interface CompressionJob {
  id: string;
  format: string;
  quality: string;
  status: string;
  size?: number;
}

interface FormatOption {
  name: string;
  description: string;
  type: string;
}

interface QualityOption {
  name: string;
  description: string;
}

export default function TextureToolsEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState('bc3');
  const [quality, setQuality] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<CompressionJob[]>([]);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [qualityLevels, setQualityLevels] = useState<QualityOption[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Load formats and quality levels
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [formatsRes, qualityRes] = await Promise.all([
          fetch('/api/texture-tools/formats'),
          fetch('/api/texture-tools/quality-levels'),
        ]);

        if (formatsRes.ok) {
          const data = await formatsRes.json();
          setFormats(data.formats || []);
        }
        if (qualityRes.ok) {
          const data = await qualityRes.json();
          setQualityLevels(data.levels || []);
        }
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };

    loadOptions();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleCompress = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('format', format);
      formData.append('quality', quality);

      const response = await fetch('/api/texture-tools/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Compression failed');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess(`Texture compressed successfully (${formatFileSize(data.size)})`);
        setJobs([data, ...jobs]);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  };

  const downloadJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/texture-tools/download/${jobId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `texture_${jobId}.dds`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white">NVIDIA Texture Tools</h1>
          </div>
          <p className="text-gray-400">Professional GPU-accelerated texture compression</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload & Settings Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Upload Texture
              </h2>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="text-gray-400">
                  {selectedFile ? (
                    <>
                      <div className="text-lg font-medium text-white mb-1">✓ {selectedFile.name}</div>
                      <div className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg mb-2">Drag & drop or click to select</div>
                      <div className="text-sm text-gray-500">Supports PNG, JPG, BMP, TGA, HDR, PSD</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Compression Settings */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileJson className="w-5 h-5 text-purple-400" />
                Compression Settings
              </h2>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {formats.map((fmt) => (
                    <button
                      key={fmt.name}
                      onClick={() => setFormat(fmt.name)}
                      className={`p-2 rounded text-sm transition-colors ${
                        format === fmt.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                      title={fmt.description}
                    >
                      {fmt.name.toUpperCase()}
                    </button>
                  ))}
                </div>
                {formats.find((f) => f.name === format) && (
                  <p className="text-xs text-gray-400 mt-2">
                    {formats.find((f) => f.name === format)?.description}
                  </p>
                )}
              </div>

              {/* Quality Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  {qualityLevels.map((q) => (
                    <button
                      key={q.name}
                      onClick={() => setQuality(q.name)}
                      className={`p-2 rounded text-sm transition-colors ${
                        quality === q.name
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                      title={q.description}
                    >
                      {q.name.charAt(0).toUpperCase() + q.name.slice(1)}
                    </button>
                  ))}
                </div>
                {qualityLevels.find((q) => q.name === quality) && (
                  <p className="text-xs text-gray-400 mt-2">
                    {qualityLevels.find((q) => q.name === quality)?.description}
                  </p>
                )}
              </div>

              {/* Messages */}
              {error && <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>}
              {success && <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">{success}</div>}

              {/* Compress Button */}
              <button
                onClick={handleCompress}
                disabled={!selectedFile || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Compressing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Compress Texture
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              Recent Jobs ({jobs.length})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {jobs.length === 0 ? (
                <p className="text-gray-400 text-sm">No jobs yet. Compress a texture to get started.</p>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="p-3 bg-slate-700/50 rounded border border-slate-600 hover:border-blue-500 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {job.format.toUpperCase()} @ {job.quality}
                        </div>
                        <div className="text-xs text-gray-400">
                          {job.size ? formatFileSize(job.size) : 'Processing...'}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            job.status === 'completed'
                              ? 'text-green-400'
                              : job.status === 'error'
                                ? 'text-red-400'
                                : 'text-yellow-400'
                          }`}
                        >
                          {job.status}
                        </div>
                      </div>
                      {job.status === 'completed' && (
                        <button
                          onClick={() => downloadJob(job.id)}
                          className="flex-shrink-0 p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-slate-800/30 border border-slate-700 rounded-lg p-4 text-sm text-gray-400">
          <p>
            <strong>NVIDIA Texture Tools</strong> provides GPU-accelerated compression using technologies like BC1-7, ASTC, and
            more. Ideal for game engines and real-time applications.
          </p>
        </div>
      </div>
    </div>
  );
}
