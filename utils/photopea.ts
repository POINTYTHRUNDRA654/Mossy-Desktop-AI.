/**
 * Photopea API Utilities
 * Handles communication with Photopea editor and file management
 */

export interface PhotopeaConfig {
  files?: string[];
  resources?: string[];
  server?: {
    version: number;
    url: string;
    formats: string[];
  };
  environment?: Record<string, any>;
  apis?: Record<string, string>;
  script?: string;
}

export interface PhotopeaSaveData {
  source: string;
  versions: Array<{
    format: string;
    start: number;
    size: number;
  }>;
}

export interface SavedFile {
  filename: string;
  size: number;
  created: string;
  formats: string[];
}

/**
 * Create a Photopea configuration object
 */
export const createPhotopeaConfig = (options: Partial<PhotopeaConfig> = {}): PhotopeaConfig => {
  return {
    server: {
      version: 1,
      url: '/api/photopea/save',
      formats: ['psd', 'png', 'jpg:0.8', 'webp'],
    },
    ...options,
  };
};

/**
 * Encode Photopea configuration to URL hash
 */
export const encodePhotopeaConfig = (config: PhotopeaConfig): string => {
  return encodeURIComponent(JSON.stringify(config));
};

/**
 * Generate Photopea URL with embedded configuration
 */
export const generatePhotopeaUrl = (config: PhotopeaConfig): string => {
  const encoded = encodePhotopeaConfig(config);
  return `https://www.photopea.com#${encoded}`;
};

/**
 * Save file to server
 */
export const savePhotopeaFile = async (
  data: PhotopeaSaveData,
  binaryData: ArrayBuffer
): Promise<{ success: boolean; filename: string; message?: string }> => {
  try {
    // Create FormData with JSON and binary data
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(data));
    formData.append('file', new Blob([binaryData], { type: 'application/octet-stream' }));

    const response = await fetch('/api/photopea/save', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving Photopea file:', error);
    throw error;
  }
};

/**
 * Get list of saved files
 */
export const getSavedFiles = async (): Promise<SavedFile[]> => {
  try {
    const response = await fetch('/api/photopea/saved-files');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching saved files:', error);
    return [];
  }
};

/**
 * Download a saved file
 */
export const downloadSavedFile = async (filename: string): Promise<Blob> => {
  try {
    const response = await fetch(`/api/photopea/download/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

/**
 * Delete a saved file
 */
export const deleteSavedFile = async (filename: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/photopea/delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Send command to Photopea iframe
 */
export const sendPhotopeaCommand = (
  iframe: HTMLIFrameElement | null,
  command: any
): void => {
  if (!iframe?.contentWindow) {
    console.warn('Photopea iframe not available');
    return;
  }

  iframe.contentWindow.postMessage(command, 'https://www.photopea.com');
};

/**
 * Execute script in Photopea
 */
export const executePhotopeaScript = (
  iframe: HTMLIFrameElement | null,
  script: string
): void => {
  if (!iframe?.contentWindow) {
    console.warn('Photopea iframe not available');
    return;
  }

  iframe.contentWindow.postMessage(
    {
      type: 'script',
      code: script,
    },
    'https://www.photopea.com'
  );
};

/**
 * Open file in Photopea
 */
export const openFileInPhotopea = (
  iframe: HTMLIFrameElement | null,
  fileUrl: string,
  filename?: string
): void => {
  if (!iframe) {
    console.warn('Photopea iframe not available');
    return;
  }

  const config = createPhotopeaConfig({
    files: [fileUrl],
  });

  const url = generatePhotopeaUrl(config);
  iframe.src = url;
};

/**
 * Add text layer to current document in Photopea
 */
export const addTextLayerScript = (text: string, fontSize: number = 24): string => {
  return `
    var doc = app.activeDocument;
    if (doc) {
      var txtLayer = doc.layers.add();
      var txtItem = txtLayer.textItem;
      txtItem.contents = "${text}";
      txtItem.fontSize = ${fontSize};
    }
  `;
};

/**
 * Resize canvas in Photopea
 */
export const resizeCanvasScript = (width: number, height: number): string => {
  return `
    var doc = app.activeDocument;
    if (doc) {
      doc.resizeCanvas(${width}, ${height}, AnchorPosition.TOPLEFT);
    }
  `;
};

/**
 * Flatten image in Photopea
 */
export const flattenImageScript = (): string => {
  return `
    var doc = app.activeDocument;
    if (doc) {
      doc.flatten();
    }
  `;
};
