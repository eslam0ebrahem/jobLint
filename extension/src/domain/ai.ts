import type { AiConfig, AiProviderId, UserPreferences } from '@/src/types/job';
import { isRecord } from './shared';

export type { AiConfig } from '@/src/types/job';

export interface ProviderPreset {
  id: AiProviderId;
  label: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models?: string[];
}

export type AiModelResult = { success: boolean; models: string[]; error?: string };

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

export function isAiProvider(value: unknown): value is AiProviderId {
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
    provider: isAiProvider(value.provider) ? value.provider : 'custom',
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : typeof value.legacyBaseUrl === 'string' ? value.legacyBaseUrl : '',
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    model: typeof value.model === 'string' ? value.model : '',
    enabled: value.enabled === true,
    autoEnhance: value.autoEnhance === true,
    timeoutMs: typeof value.timeoutMs === 'number' ? Math.min(60_000, Math.max(2_000, value.timeoutMs)) : DEFAULT_AI_CONFIG.timeoutMs,
  };
}

export function migrateAiConfig(stored: unknown): AiConfig {
  if (!isRecord(stored)) return { ...DEFAULT_AI_CONFIG };
  if (isRecord(stored.aiConfig)) {
    return { ...DEFAULT_AI_CONFIG, ...legacyConfig(stored.aiConfig) };
  }
  return {
    ...DEFAULT_AI_CONFIG,
    ...legacyConfig(stored),
    enabled: Boolean(stored.baseUrl && stored.apiKey && stored.model),
  };
}

export function normalizeAiConfigForSave(config: AiConfig): AiConfig {
  if (!isAiProvider(config.provider)) throw new Error('Choose a supported AI provider.');
  const baseUrl = cleanBaseUrl(config.baseUrl);
  const apiKey = cleanApiKey(config.apiKey);
  const model = config.model.trim();
  if (config.enabled && !baseUrl) throw new Error('Enter a valid HTTPS endpoint (HTTP is allowed for localhost).');
  if (config.enabled && !model) throw new Error('Enter or discover a model before enabling AI review.');
  const provider = PROVIDER_PRESETS.find((preset) => preset.id === config.provider);
  if (config.enabled && provider?.requiresApiKey && !apiKey) throw new Error('This provider requires an API key.');
  return {
    provider: config.provider,
    baseUrl,
    apiKey,
    model,
    enabled: config.enabled,
    autoEnhance: config.enabled && config.autoEnhance === true,
    timeoutMs: Math.min(60_000, Math.max(2_000, Math.round(config.timeoutMs || DEFAULT_AI_CONFIG.timeoutMs))),
  };
}

export function isAutomaticAiEnhancementEnabled(preferences: UserPreferences, config: AiConfig): boolean {
  return preferences.autoEnhanceWithAi && config.enabled && config.autoEnhance;
}

export function canReviewWithAi(config: AiConfig): boolean {
  return Boolean(
    config.enabled
    && config.baseUrl
    && config.model
    && (config.provider === 'ollama' || config.apiKey),
  );
}
