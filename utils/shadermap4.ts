/**
 * ShaderMap 4 API Utilities
 * Handles communication with ShaderMap4 shader authoring service
 */

export interface ShaderMapConfig {
  input_format?: string;
  output_formats?: string[];
  shader_type?: 'pbr' | 'standard' | 'custom' | 'substance';
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
}

export interface GeneratedShader {
  id: string;
  name: string;
  type: string;
  size: number;
  generated_at: string;
  quality: string;
  preview?: string;
}

export interface ShaderTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
}

/**
 * Generate shaders from input image
 */
export const generateShaders = async (
  file: File,
  type: 'pbr' | 'standard' | 'custom' | 'substance' = 'pbr',
  quality: 'draft' | 'standard' | 'high' | 'ultra' = 'high',
  template?: string
): Promise<{ shaders: GeneratedShader[]; id: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('quality', quality);
  if (template) {
    formData.append('template', template);
  }

  try {
    const response = await fetch('/api/shadermap4/generate', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to generate shaders');
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating shaders:', error);
    throw error;
  }
};

/**
 * Get available shader templates
 */
export const getTemplates = async (): Promise<ShaderTemplate[]> => {
  try {
    const response = await fetch('/api/shadermap4/templates');
    if (!response.ok) throw new Error('Failed to get templates');
    const data = await response.json();
    return data.templates || [];
  } catch (error) {
    console.error('Error getting templates:', error);
    return [];
  }
};

/**
 * Download a single shader
 */
export const downloadShader = async (shaderId: string, filename?: string): Promise<void> => {
  try {
    const response = await fetch(`/api/shadermap4/download/${shaderId}`);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `shader_${shaderId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading shader:', error);
    throw error;
  }
};

/**
 * Download all shaders as ZIP
 */
export const downloadAllShaders = async (): Promise<void> => {
  try {
    const response = await fetch('/api/shadermap4/download-all');
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaders_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading shaders:', error);
    throw error;
  }
};

/**
 * Check ShaderMap4 service health
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/shadermap4/health');
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get shader preview image
 */
export const getShaderPreview = async (previewFilename: string): Promise<string> => {
  return `/api/shadermap4/preview/${previewFilename}`;
};

/**
 * Supported shader types and their descriptions
 */
export const SHADER_TYPES = {
  pbr: 'Physically-based rendering for game engines',
  standard: 'Standard shader for basic materials',
  custom: 'Fully customizable node graph',
  substance: 'Substance Designer compatible format',
};

/**
 * Quality levels with processing time hints
 */
export const QUALITY_LEVELS = {
  draft: 'Fast processing (30s)',
  standard: 'Normal processing (1-2min)',
  high: 'High quality (2-5min)',
  ultra: 'Ultra quality (5-10min)',
};
