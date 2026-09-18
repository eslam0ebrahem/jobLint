export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function getAiConfig(): Promise<AiConfig> {
  const res = await browser.storage.local.get(['baseUrl', 'apiKey', 'model']);
  return {
    baseUrl: (res.baseUrl as string) || '',
    apiKey: (res.apiKey as string) || '',
    model: (res.model as string) || '',
  };
}

export async function fetchAiModels(
  baseUrl: string,
  apiKey: string
): Promise<{ success: boolean; models: string[]; error?: string }> {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) return { success: false, models: [], error: 'Base URL is required' };
  if (!apiKey.trim()) return { success: false, models: [], error: 'API key is required' };

  try {
    const res = await fetch(`${cleanUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || err.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, models: [], error: msg };
    }

    const data = await res.json().catch(() => ({}));
    const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const models: string[] = rawList
      .map((m: unknown) => {
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object') {
          const obj = m as Record<string, unknown>;
          return String(obj.id || obj.name || '');
        }
        return '';
      })
      .filter(Boolean)
      .sort();

    if (models.length === 0) {
      return { success: false, models: [], error: 'No models returned from endpoint' };
    }

    return { success: true, models };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to connect to endpoint';
    return { success: false, models: [], error: errorMsg };
  }
}

export async function testAiConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) return { success: false, message: 'Base URL is required' };
  if (!apiKey.trim()) return { success: false, message: 'API key is required' };
  if (!model.trim()) return { success: false, message: 'Model name is required' };

  try {
    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 10,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || err.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    const data = await res.json().catch(() => ({}));
    const reply = data.choices?.[0]?.message?.content?.trim();
    return {
      success: true,
      message: `Connected successfully! Model responded: "${reply || 'OK'}"`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Connection failed. Check your Base URL and network.';
    return { success: false, message: errorMsg };
  }
}
