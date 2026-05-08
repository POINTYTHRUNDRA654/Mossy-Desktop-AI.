/**
 * NVIDIA Texture Tools API Utilities
 * Handles communication with Texture Tools compression service
 */

export interface CompressionJob {
  job_id: string;
  operation: string;
  format: string;
  quality: string;
  status: string;
  size?: number;
  output_file?: string;
}

export interface CompressionFormat {
  name: string;
  type: string;
  description: string;
}

export interface QualityLevel {
  name: string;
  description: string;
}

/**
 * Compress texture using NVIDIA Texture Tools
 */
export const compressTexture = async (
  file: File,
  format: string = 'bc3',
  quality: string = 'normal'
): Promise<{ id: string; status: string; size: number }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);
  formData.append('quality', quality);

  try {
    const response = await fetch('/api/texture-tools/compress', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to compress texture');
    }

    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
      size: data.size,
    };
  } catch (error) {
    console.error('Error compressing texture:', error);
    throw error;
  }
};

/**
 * Get available compression formats
 */
export const getFormats = async (): Promise<CompressionFormat[]> => {
  try {
    const response = await fetch('/api/texture-tools/formats');
    if (!response.ok) throw new Error('Failed to get formats');
    const data = await response.json();
    return data.formats || [];
  } catch (error) {
    console.error('Error getting formats:', error);
    return [];
  }
};

/**
 * Get available quality levels
 */
export const getQualityLevels = async (): Promise<QualityLevel[]> => {
  try {
    const response = await fetch('/api/texture-tools/quality-levels');
    if (!response.ok) throw new Error('Failed to get quality levels');
    const data = await response.json();
    return data.levels || [];
  } catch (error) {
    console.error('Error getting quality levels:', error);
    return [];
  }
};

/**
 * Download compressed texture
 */
export const downloadTexture = async (jobId: string, filename?: string): Promise<void> => {
  try {
    const response = await fetch(`/api/texture-tools/download/${jobId}`);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `texture_${jobId}.dds`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading texture:', error);
    throw error;
  }
};

/**
 * Get job status
 */
export const getJobStatus = async (jobId: string): Promise<CompressionJob> => {
  try {
    const response = await fetch(`/api/texture-tools/status/${jobId}`);
    if (!response.ok) throw new Error('Failed to get job status');
    return await response.json();
  } catch (error) {
    console.error('Error getting job status:', error);
    throw error;
  }
};

/**
 * List all jobs
 */
export const listJobs = async (): Promise<CompressionJob[]> => {
  try {
    const response = await fetch('/api/texture-tools/jobs');
    if (!response.ok) throw new Error('Failed to list jobs');
    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    console.error('Error listing jobs:', error);
    return [];
  }
};

/**
 * Check Texture Tools service health
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/texture-tools/health');
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Compression formats reference
 */
export const FORMATS = {
  bc1: 'BC1/DXT1 - Fast, good for opaque textures',
  bc3: 'BC3/DXT5 - With alpha channel',
  bc4: 'BC4 - Single channel compression',
  bc5: 'BC5 - Two channel (normal maps)',
  bc6h: 'BC6H - HDR compression',
  bc7: 'BC7 - High quality RGBA',
  astc: 'ASTC - Adaptive scalable compression',
};

/**
 * Quality levels reference
 */
export const QUALITY_LEVELS = {
  fast: 'Fastest compression',
  normal: 'Normal quality/speed balance',
  production: 'Production quality',
  highest: 'Highest quality (slow)',
};
