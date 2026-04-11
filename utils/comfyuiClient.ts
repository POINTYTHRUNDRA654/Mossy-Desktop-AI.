/**
 * ComfyUI Integration
 * Connect to local Stable Diffusion ComfyUI instance for image generation
 */

export interface ComfyUIConfig {
    endpoint: string;
    timeout: number;
}

export interface GenerateImageRequest {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    sampler?: string;
    cfgScale?: number;
    seed?: number;
}

export interface GenerateImageResponse {
    images: string[];
    seeds: number[];
    status: 'success' | 'error';
    message?: string;
}

/**
 * Check ComfyUI health
 */
export async function checkComfyUIHealth(config: ComfyUIConfig): Promise<boolean> {
    try {
        const res = await fetch(`${config.endpoint}/system_stats`, {
            signal: AbortSignal.timeout(config.timeout),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Get available samplers and models from ComfyUI
 */
export async function getComfyUIConfig(config: ComfyUIConfig): Promise<{
    samplers: string[];
    models: string[];
    loraModels: string[];
}> {
    try {
        const res = await fetch(`${config.endpoint}/api/config`, {
            signal: AbortSignal.timeout(config.timeout),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        return {
            samplers: data.schedules || [],
            models: data.models || [],
            loraModels: data.lora_models || [],
        };
    } catch (err) {
        console.error('Failed to get ComfyUI config:', err);
        return { samplers: [], models: [], loraModels: [] };
    }
}

/**
 * Generate image using ComfyUI
 * This is a simplified interface - real usage would construct the full ComfyUI workflow JSON
 */
export async function generateImage(
    config: ComfyUIConfig,
    request: GenerateImageRequest,
): Promise<GenerateImageResponse> {
    try {
        const res = await fetch(`${config.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: request.prompt,
                negative_prompt: request.negativePrompt || '',
                width: request.width || 512,
                height: request.height || 512,
                steps: request.steps || 20,
                sampler: request.sampler || 'euler',
                cfg_scale: request.cfgScale || 7.5,
                seed: request.seed || -1,
            }),
            signal: AbortSignal.timeout(config.timeout),
        });

        if (!res.ok) {
            return { images: [], seeds: [], status: 'error', message: `HTTP ${res.status}` };
        }

        const data = await res.json();
        return {
            images: data.images || [],
            seeds: data.seeds || [],
            status: 'success',
        };
    } catch (err) {
        return {
            images: [],
            seeds: [],
            status: 'error',
            message: String(err),
        };
    }
}

/**
 * Get list of available models in ComfyUI
 */
export async function listComfyUIModels(config: ComfyUIConfig): Promise<string[]> {
    try {
        const res = await fetch(`${config.endpoint}/api/models`, {
            signal: AbortSignal.timeout(config.timeout),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.models || [];
    } catch {
        return [];
    }
}
