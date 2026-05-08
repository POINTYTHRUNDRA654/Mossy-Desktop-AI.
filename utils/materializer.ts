/**
 * Materializer API Utilities
 * Handles communication with NVIDIA Materializer texture generation service
 */

export interface MaterializerConfig {
  input_format?: string;
  output_formats?: string[];
  generation_mode?: 'pbr' | 'diffuse' | 'normal' | 'roughness' | 'metallic' | 'ao';
  ai_enhance?: boolean;
}

export interface GeneratedTexture {
  id: string;
  name: string;
  format: string;
  size: number;
  generated_at: string;
  mode: string;
}

export interface MaterialPreset {
  name: string;
  type: string;
  description: string;
}

/**
 * Generate textures from input image
 */
export const generateTextures = async (
  file: File,
  mode: 'pbr' | 'diffuse' | 'normal' | 'roughness' | 'metallic' | 'ao' = 'pbr',
  aiEnhance: boolean = true,
  preset?: string
): Promise<{ textures: GeneratedTexture[]; id: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  formData.append('ai_enhance', aiEnhance.toString());
  if (preset) {
    formData.append('preset', preset);
  }

  try {
    const response = await fetch('/api/materializer/generate', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to generate textures');
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating textures:', error);
    throw error;
  }
};

/**
 * Get available material presets
 */
export const getPresets = async (): Promise<MaterialPreset[]> => {
  try {
    const response = await fetch('/api/materializer/presets');
    if (!response.ok) throw new Error('Failed to get presets');
    const data = await response.json();
    return data.presets || [];
  } catch (error) {
    console.error('Error getting presets:', error);
    return [];
  }
};

/**
 * Download a single texture
 */
export const downloadTexture = async (textureId: string, filename?: string): Promise<void> => {
  try {
    const response = await fetch(`/api/materializer/download/${textureId}`);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `texture_${textureId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading texture:', error);
    throw error;
  }
};

/**
 * Download all textures as ZIP
 */
export const downloadAllTextures = async (): Promise<void> => {
  try {
    const response = await fetch('/api/materializer/download-all');
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textures_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading textures:', error);
    throw error;
  }
};

/**
 * Check Materializer service health
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/materializer/health');
    return response.ok;
  } catch {
    return false;
  }
};
