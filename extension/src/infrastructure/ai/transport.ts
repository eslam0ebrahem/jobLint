import type { AiConfig } from '@/src/types/job';
import {
  cleanApiKey,
  cleanBaseUrl,
  DEFAULT_AI_CONFIG,
  getAiAuthHeaders,
  type AiModelResult,
} from '@/src/domain/ai';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

export class AiHttpTransport {
  constructor(private readonly fetcher: FetchLike = (input, init) => fetch(input, init)) {}

  async fetchModels(
    baseUrl: string,
    apiKey: string,
    timeoutMs = DEFAULT_AI_CONFIG.timeoutMs,
  ): Promise<AiModelResult> {
    const url = cleanBaseUrl(baseUrl);
    if (!url) return { success: false, models: [], error: 'Enter a valid HTTPS endpoint (HTTP is allowed for localhost).' };
    const key = cleanApiKey(apiKey);
    const timeout = withTimeout(Math.min(60_000, Math.max(2_000, timeoutMs)));
    try {
      const response = await this.fetcher(`${url}/models`, {
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

  async complete(config: AiConfig, prompt: string): Promise<string | undefined> {
    const timeout = withTimeout(config.timeoutMs);
    try {
      const response = await this.fetcher(`${cleanBaseUrl(config.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAiAuthHeaders(config.apiKey) },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 700,
        }),
        signal: timeout.signal,
      });
      if (!response.ok) return undefined;
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') return undefined;
      const content = (data as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : undefined;
    } finally {
      timeout.cancel();
    }
  }
}

export async function fetchAiModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = DEFAULT_AI_CONFIG.timeoutMs,
): Promise<AiModelResult> {
  return new AiHttpTransport().fetchModels(baseUrl, apiKey, timeoutMs);
}
