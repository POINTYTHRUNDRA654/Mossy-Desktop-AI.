/**
 * Unified AI client factory.
 *
 * Returns a client object whose interface exactly matches the subset of the
 * @google/genai SDK that every component in this app uses:
 *
 *   const ai = getAiClient();
 *   const response = await ai.models.generateContent({ model, contents, config });
 *   console.log(response.text);   // string property
 *
 *   const stream = await ai.models.generateContentStream({ ... });
 *   for await (const chunk of stream) {
 *     process(chunk.text);         // string property on each chunk
 *   }
 *
 * When the provider is 'ollama', calls are routed to the local Ollama REST API
 * (http://localhost:11434) — completely free, no API key, runs on the desktop.
 *
 * When the provider is 'gemini', the real @google/genai SDK is used (free tier
 * is available with a key from https://aistudio.google.com/app/apikey).
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKey, getProvider, getOllamaConfig } from './apiKey';

// ─── Shared result types ───────────────────────────────────────────────────

export interface AIGenerateResult {
  /** Plain text of the response. */
  text: string;
  /** Raw candidates array — present for Gemini, empty for Ollama. */
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
  }>;
}

export interface AIStreamChunk {
  /** Plain text delta for this chunk. */
  text: string;
  /** Tool/function calls if the model emitted any (Gemini only). */
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface AIClient {
  models: {
    generateContent(params: AIGenerateParams): Promise<AIGenerateResult>;
    generateContentStream(params: AIGenerateParams): Promise<AsyncIterable<AIStreamChunk>>;
  };
}

export interface AIGenerateParams {
  model?: string;
  contents: unknown;
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    tools?: unknown[];
    responseModalities?: string[];
    speechConfig?: unknown;
    [key: string]: unknown;
  };
}

// ─── Ollama helpers ────────────────────────────────────────────────────────

interface OllamaMessage { role: string; content: string }

function toOllamaMessages(
  contents: unknown,
  systemInstruction?: string,
): OllamaMessage[] {
  const msgs: OllamaMessage[] = [];

  if (systemInstruction) {
    msgs.push({ role: 'system', content: systemInstruction });
  }

  const items = Array.isArray(contents) ? contents : [contents];
  for (const item of items as Array<{ role?: string; parts?: unknown[]; text?: string }>) {
    const role = item.role === 'model' ? 'assistant' : (item.role || 'user');
    let content = '';

    if (Array.isArray(item.parts)) {
      content = item.parts
        .filter((p): p is { text: string } => typeof (p as { text?: string }).text === 'string')
        .map(p => p.text)
        .join('');
    } else if (typeof item.text === 'string') {
      content = item.text;
    } else if (typeof item === 'string') {
      content = item;
    }

    if (content) msgs.push({ role, content });
  }

  return msgs;
}

// ─── Ollama client ─────────────────────────────────────────────────────────

class OllamaClient implements AIClient {
  private readonly base: string;
  private readonly model: string;

  constructor(endpoint: string, model: string) {
    this.base = endpoint.replace(/\/$/, '');
    this.model = model;
  }

  models = {
    generateContent: async (params: AIGenerateParams): Promise<AIGenerateResult> => {
      const messages = toOllamaMessages(params.contents, params.config?.systemInstruction);

      const res = await fetch(`${this.base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: params.config?.temperature !== undefined
            ? { temperature: params.config.temperature }
            : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      return { text: data.message?.content ?? '', candidates: [] };
    },

    generateContentStream: async (
      params: AIGenerateParams,
    ): Promise<AsyncIterable<AIStreamChunk>> => {
      const messages = toOllamaMessages(params.contents, params.config?.systemInstruction);
      const base = this.base;
      const model = this.model;

      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: params.config?.temperature !== undefined
            ? { temperature: params.config.temperature }
            : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama stream error ${res.status}: ${await res.text()}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      async function* streamChunks(): AsyncIterable<AIStreamChunk> {
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              const chunkText: string = obj.message?.content ?? '';
              if (chunkText) yield { text: chunkText };
              if (obj.done) return;
            } catch {
              // malformed NDJSON line — skip
            }
          }
        }
      }

      return streamChunks();
    },
  };
}

// ─── Gemini wrapper ────────────────────────────────────────────────────────

class GeminiClient implements AIClient {
  private readonly inner: GoogleGenAI;

  constructor(apiKey: string) {
    this.inner = new GoogleGenAI({ apiKey });
  }

  models = {
    generateContent: async (params: AIGenerateParams): Promise<AIGenerateResult> => {
      // Cast through unknown: the Gemini SDK accepts a superset of AIGenerateParams
      // and returns a superset of AIGenerateResult; we only use the common subset.
      return this.inner.models.generateContent(
        params as unknown as Parameters<typeof this.inner.models.generateContent>[0]
      ) as unknown as Promise<AIGenerateResult>;
    },

    generateContentStream: async (
      params: AIGenerateParams,
    ): Promise<AsyncIterable<AIStreamChunk>> => {
      return this.inner.models.generateContentStream(
        params as unknown as Parameters<typeof this.inner.models.generateContentStream>[0]
      ) as unknown as Promise<AsyncIterable<AIStreamChunk>>;
    },
  };
}

// ─── Factory ───────────────────────────────────────────────────────────────

/** Return the configured AI client (Ollama or Gemini). */
export function getAiClient(): AIClient {
  if (getProvider() === 'ollama') {
    const { endpoint, model } = getOllamaConfig();
    return new OllamaClient(endpoint, model);
  }
  return new GeminiClient(getApiKey());
}

/** True when the current provider is local Ollama. */
export function isOllamaMode(): boolean {
  return getProvider() === 'ollama';
}

// ─── Ollama model discovery ────────────────────────────────────────────────

export interface OllamaModelInfo { name: string; size: number }

/**
 * Fetch the list of models available in a running Ollama instance.
 * Returns an empty array if Ollama is not running or unreachable.
 */
export async function listOllamaModels(endpoint = 'http://localhost:11434'): Promise<OllamaModelInfo[]> {
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string; size: number }) => ({
      name: m.name,
      size: m.size,
    }));
  } catch {
    return [];
  }
}

/**
 * Check whether an Ollama instance is reachable at the given endpoint.
 */
export async function checkOllamaHealth(endpoint = 'http://localhost:11434'): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
