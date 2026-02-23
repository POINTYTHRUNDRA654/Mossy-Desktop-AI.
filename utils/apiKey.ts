/**
 * Runtime AI provider + Gemini API key management.
 *
 * Supports two providers:
 *   'ollama'  – local, free, private (no API key required)
 *   'gemini'  – cloud, free tier available (API key required)
 *
 * All settings live in localStorage so they survive app restarts without
 * any rebuild — the user configures once and the packaged desktop app
 * remembers everything.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type AIProviderType = 'gemini' | 'ollama';

export interface OllamaConfig {
  endpoint: string;
  model: string;
}

// ─── Gemini API key ────────────────────────────────────────────────────────

const KEY_STORAGE = 'mossy_gemini_api_key';

/** Read the Gemini API key from localStorage (runtime, works in packaged app). */
export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) || '';
}

/** Persist the Gemini API key. */
export function setApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
  else localStorage.removeItem(KEY_STORAGE);
}

/** True when a non-empty Gemini API key is stored. */
export function hasApiKey(): boolean {
  return Boolean(localStorage.getItem(KEY_STORAGE));
}

// ─── Provider selection ────────────────────────────────────────────────────

const PROVIDER_STORAGE = 'mossy_ai_provider';

export function getProvider(): AIProviderType {
  return (localStorage.getItem(PROVIDER_STORAGE) as AIProviderType) || 'gemini';
}

export function setProvider(p: AIProviderType): void {
  localStorage.setItem(PROVIDER_STORAGE, p);
}

// ─── Ollama config ─────────────────────────────────────────────────────────

const OLLAMA_STORAGE = 'mossy_ollama_config';

export function getOllamaConfig(): OllamaConfig {
  try {
    const saved = localStorage.getItem(OLLAMA_STORAGE);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { endpoint: 'http://localhost:11434', model: 'gemma3' };
}

export function setOllamaConfig(config: OllamaConfig): void {
  localStorage.setItem(OLLAMA_STORAGE, JSON.stringify(config));
}

// ─── Combined readiness check ──────────────────────────────────────────────

/**
 * True when the app has enough configuration to make AI calls.
 * Ollama needs no key; Gemini needs an API key.
 */
export function isConfigured(): boolean {
  if (getProvider() === 'ollama') return true;
  return hasApiKey();
}
