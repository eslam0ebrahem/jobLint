import { describe, expect, it, vi } from 'vitest';
import { cleanApiKey, cleanBaseUrl, DEFAULT_AI_CONFIG, fetchAiModels, getAiConfig, saveAiConfig } from '@/src/lib/ai';
import { evaluateJob } from '@/src/lib/evaluation';
import { evaluateWithLlm } from '@/src/lib/evaluation/llm';
import type { DetectedJob } from '@/src/types/job';

const job: DetectedJob = {
  source: 'manual',
  title: 'React Engineer',
  company: 'Acme',
  description: 'React and TypeScript role.',
};

describe('optional AI adapter', () => {
  it('normalizes safe endpoint and key values', () => {
    expect(cleanBaseUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1');
    expect(cleanBaseUrl('http://example.com/v1')).toBe('');
    expect(cleanBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(cleanApiKey('Bearer sk-test')).toBe('sk-test');
  });

  it('rejects enabling an incomplete configuration', async () => {
    await expect(saveAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true, baseUrl: '', model: 'x' })).rejects.toThrow('endpoint');
    await expect(saveAiConfig({ ...DEFAULT_AI_CONFIG, enabled: true, baseUrl: 'https://api.example.com/v1', model: '' })).rejects.toThrow('model');
  });

  it('falls back on malformed model output without replacing the local report', async () => {
    await saveAiConfig({ ...DEFAULT_AI_CONFIG, provider: 'openai', baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'test-model', enabled: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })));
    const fallback = evaluateJob(job, { roles: 'React Engineer', skills: 'React, TypeScript' });
    const result = await evaluateWithLlm(job, fallback, { roles: 'React Engineer', skills: 'React, TypeScript' });
    expect(result).toEqual(fallback);
  });

  it('attaches an AI advisory while preserving the deterministic score', async () => {
    await saveAiConfig({ ...DEFAULT_AI_CONFIG, provider: 'openai', baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'test-model', enabled: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 3.1, verdict: 'Skip', reason: 'Partial evidence', matchedSkills: ['React'], missingSkills: ['AWS'] }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const fallback = evaluateJob(job, { roles: 'React Engineer', skills: 'React, TypeScript' });
    const result = await evaluateWithLlm(job, fallback, { roles: 'React Engineer', skills: 'React, TypeScript' });
    expect(result.aiEnhanced).toBe(true);
    expect(result.aiAssessment?.model).toBe('test-model');
    expect(result.score).toBe(fallback.score);
  });

  it('returns a safe error for model discovery failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'nope' }), { status: 401, statusText: 'Unauthorized' })));
    await expect(fetchAiModels('https://api.example.com/v1', 'bad')).resolves.toMatchObject({ success: false, error: 'nope' });
    await expect(getAiConfig()).resolves.toMatchObject({ enabled: false });
  });
});
