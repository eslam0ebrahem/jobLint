import type { AiConfig, AiProviderId } from '@/src/types/job';

export type { AiConfig } from '@/src/types/job';

export interface ProviderPreset {
  id: AiProviderId;
  label: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models?: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', requiresApiKey: true },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', requiresApiKey: true },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', requiresApiKey: true },
  { id: 'minimax', label: 'MiniMax', baseUrl: 'https://api.minimax.io/v1', requiresApiKey: true },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', requiresApiKey: false },
  { id: 'custom', label: 'Custom OpenAI-compatible endpoint', baseUrl: '', requiresApiKey: true },
];

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'custom',
  baseUrl: '',
  apiKey: '',
  model: '',
  enabled: false,
  autoEnhance: false,
  timeoutMs: 20_000,
};

function isProvider(value: unknown): value is AiProviderId {
  return PROVIDER_PRESETS.some((preset) => preset.id === value);
}

function isLocalUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

export function cleanBaseUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalUrl(url))) return '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+(chat\/completions|models)\/?$/i, '').replace(/\/+$/, '');
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export function cleanApiKey(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
}

export function getAiAuthHeaders(apiKey: string): Record<string, string> {
  const key = cleanApiKey(apiKey);
  return {
    ...(key ? { Authorization: `Bearer ${key}`, 'x-api-key': key } : {}),
    'HTTP-Referer': 'https://joblint.dev',
    'X-Title': 'JobLint',
  };
}

function legacyConfig(value: Record<string, unknown>): Partial<AiConfig> {
  return {
    provider: isProvider(value.provider) ? value.provider : 'custom',
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : typeof value.legacyBaseUrl === 'string' ? value.legacyBaseUrl : '',
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    model: typeof value.model === 'string' ? value.model : '',
    enabled: value.enabled === true,
    autoEnhance: value.autoEnhance === true,
    timeoutMs: typeof value.timeoutMs === 'number' ? Math.min(60_000, Math.max(2_000, value.timeoutMs)) : DEFAULT_AI_CONFIG.timeoutMs,
  };
}

export async function getAiConfig(): Promise<AiConfig> {
  const stored = await browser.storage.local.get(['aiConfig', 'baseUrl', 'apiKey', 'model']);
  if (stored.aiConfig && typeof stored.aiConfig === 'object' && !Array.isArray(stored.aiConfig)) {
    return { ...DEFAULT_AI_CONFIG, ...legacyConfig(stored.aiConfig as Record<string, unknown>) };
  }
  return {
    ...DEFAULT_AI_CONFIG,
    ...legacyConfig(stored),
    enabled: Boolean(stored.baseUrl && stored.apiKey && stored.model),
  };
}

export async function saveAiConfig(config: AiConfig): Promise<AiConfig> {
  if (!isProvider(config.provider)) throw new Error('Choose a supported AI provider.');
  const baseUrl = cleanBaseUrl(config.baseUrl);
  const apiKey = cleanApiKey(config.apiKey);
  const model = config.model.trim();
  if (config.enabled && !baseUrl) throw new Error('Enter a valid HTTPS endpoint (HTTP is allowed for localhost).');
  if (config.enabled && !model) throw new Error('Enter or discover a model before enabling AI review.');
  const provider = PROVIDER_PRESETS.find((preset) => preset.id === config.provider);
  if (config.enabled && provider?.requiresApiKey && !apiKey) throw new Error('This provider requires an API key.');
  const normalized: AiConfig = {
    provider: config.provider,
    baseUrl,
    apiKey,
    model,
    enabled: config.enabled,
    autoEnhance: config.enabled && config.autoEnhance === true,
    timeoutMs: Math.min(60_000, Math.max(2_000, Math.round(config.timeoutMs || DEFAULT_AI_CONFIG.timeoutMs))),
  };
  await browser.storage.local.set({ aiConfig: normalized });
  return normalized;
}

export async function clearAiConfig(): Promise<void> {
  await browser.storage.local.remove(['aiConfig', 'baseUrl', 'apiKey', 'model', 'models']);
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  const message = body && typeof body === 'object' ? (body as Record<string, unknown>).message : undefined;
  return typeof message === 'string' ? message : `HTTP ${response.status}: ${response.statusText}`;
}

export async function fetchAiModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = DEFAULT_AI_CONFIG.timeoutMs,
): Promise<{ success: boolean; models: string[]; error?: string }> {
  const url = cleanBaseUrl(baseUrl);
  if (!url) return { success: false, models: [], error: 'Enter a valid HTTPS endpoint (HTTP is allowed for localhost).' };
  const key = cleanApiKey(apiKey);
  const timeout = withTimeout(Math.min(60_000, Math.max(2_000, timeoutMs)));
  try {
    const response = await fetch(`${url}/models`, {
      headers: getAiAuthHeaders(key),
      signal: timeout.signal,
    });
    if (!response.ok) return { success: false, models: [], error: await responseError(response) };
    const data: unknown = await response.json().catch(() => ({}));
    const raw = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
        ? (data as { data: unknown[] }).data
        : [];
    const models = [...new Set<string>(raw.map((item: unknown): string => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const value = item as Record<string, unknown>;
        return typeof value.id === 'string' ? value.id : typeof value.name === 'string' ? value.name : '';
      }
      return '';
    }).filter(Boolean))].sort();
    return models.length
      ? { success: true, models }
      : { success: false, models: [], error: 'The endpoint returned no model IDs.' };
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'The connection timed out.'
      : error instanceof Error ? error.message : 'Could not connect to the endpoint.';
    return { success: false, models: [], error: message };
  } finally {
    timeout.cancel();
  }
}
