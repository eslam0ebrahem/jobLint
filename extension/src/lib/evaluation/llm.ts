import type { DetectedJob, JobEvaluation } from '@/src/types/job';
import { getAiConfig, cleanBaseUrl, getAiAuthHeaders } from '@/src/lib/ai';

export async function evaluateWithLlm(job: DetectedJob, fallback: JobEvaluation, profile?: Record<string, string>): Promise<JobEvaluation> {
  const cfg = await getAiConfig();
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) return fallback;

  const prompt = [
    'Evaluate job for candidate. Respond ONLY with JSON (no think tags, no markdown):',
    `Candidate: roles="${profile?.roles || 'Software Engineer'}", skills="${profile?.skills || ''}", loc="${profile?.location || ''}"`,
    `Job: ${job.title} at ${job.company} (${job.location || ''})`,
    `Text: ${(job.description || '').slice(0, 3000)}`,
    'Format: {"score":4.2,"verdict":"Apply","archetype":"Backend","seniority":"Senior","remote":"Remote","matchedSkills":["Node.js"],"missingSkills":["Go"],"reason":"one concise sentence"}',
  ].join('\n');

  try {
    const res = await fetch(`${cleanBaseUrl(cfg.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAiAuthHeaders(cfg.apiKey),
      },
      body: JSON.stringify({ model: cfg.model.trim(), messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 3000 }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || err.message || res.statusText;
      console.warn(`[JobLint AI] ${res.status}: ${msg}`);
      if (res.status === 402) {
        return { ...fallback, reason: `${fallback.reason} (AI credits exhausted: 402)` };
      }
      if (res.status === 403) {
        return { ...fallback, reason: `${fallback.reason} (AI 403: Selected model restricted)` };
      }
      if (res.status === 429) {
        return { ...fallback, reason: `${fallback.reason} (AI rate limited: 429)` };
      }
      return fallback;
    }

    const data = await res.json();
    let text = (data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (text.includes('</think>')) text = text.split('</think>')[1].trim();

    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return fallback;

    const p = JSON.parse(text.slice(start, end + 1));
    const score = Math.min(5, Math.max(1, Math.round(Number(p.score || fallback.score) * 10) / 10));
    const verdict = (score >= 4 ? 'Apply' : score >= 3.5 ? 'Caution' : 'Skip') as 'Apply' | 'Caution' | 'Skip';

    return {
      ...fallback,
      score,
      verdict,
      verdictLabel: verdict === 'Apply' ? '🟢 Apply' : verdict === 'Caution' ? '🟡 Apply with caution' : '🔴 Skip',
      archetype: p.archetype || fallback.archetype,
      seniority: p.seniority || fallback.seniority,
      remote: p.remote || fallback.remote,
      reason: String(p.reason || fallback.reason).slice(0, 140),
      matchedSkills: Array.isArray(p.matchedSkills) && p.matchedSkills.length ? p.matchedSkills : fallback.matchedSkills,
      missingSkills: Array.isArray(p.missingSkills) ? p.missingSkills : fallback.missingSkills,
      aiEnhanced: true,
    };
  } catch (err) {
    console.warn('[JobLint AI] Error:', err);
    return fallback;
  }
}
