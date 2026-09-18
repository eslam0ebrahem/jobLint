/**
 * llm.ts — LLM-powered job evaluation.
 * Inspired by career-ops/batch-evaluate-gemini.mjs
 */

import type { DetectedJob, JobEvaluation } from '@/src/types/job';
import { getAiConfig } from '@/src/lib/ai';
import { DEFAULT_CANDIDATE_SKILLS } from './skills';

export async function evaluateWithLlm(
  job: DetectedJob,
  fallback: JobEvaluation,
  profile?: Record<string, string>
): Promise<{ success: boolean; evaluation: JobEvaluation; error?: string }> {
  const config = await getAiConfig();
  if (!config.baseUrl || !config.apiKey || !config.model) {
    return { success: false, evaluation: fallback, error: 'AI endpoint is not configured in Settings' };
  }

  const cleanUrl = config.baseUrl.trim().replace(/\/+$/, '');
  const prompt = `Evaluate this job posting against the candidate's profile following career-ops scoring.
Respond ONLY with a single JSON object (no markdown, no code fences, no preamble, do not output reasoning tags).

CANDIDATE PROFILE:
Roles: ${profile?.roles || 'Software Engineer, Backend Developer'}
Skills: ${profile?.skills || DEFAULT_CANDIDATE_SKILLS.join(', ')}
Location: ${profile?.location || 'Remote / Europe'}
Target Salary: ${profile?.salary || 'Not specified'}

JOB POSTING:
Company: ${job.company}
Title: ${job.title}
Location: ${job.location || 'Not specified'}
Salary: ${job.salary || 'Not specified'}
Description:
${(job.description || job.requirements || '').slice(0, 4000)}

JSON format:
{
  "score": 4.2,
  "verdict": "Apply",
  "archetype": "Backend",
  "seniority": "Senior",
  "remote": "Remote",
  "legitimacy": "High Confidence",
  "matchedSkills": ["Node.js", "Express"],
  "missingSkills": ["Kubernetes"],
  "redFlags": [],
  "reason": "one concise sentence explaining score, max 140 chars"
}
Rules:
- score: float between 1.0 and 5.0
- verdict: "Apply" (>=4.0), "Caution" (3.5-3.9), or "Skip" (<3.5)
- legitimacy: "High Confidence", "Proceed with Caution", or "Suspicious"
- reason: max 140 characters`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error?.message || errJson.message || `HTTP ${res.status}: ${res.statusText}`;
      console.warn(`[JobLint AI] API error ${res.status}: ${errMsg}`);
      const isPayment = res.status === 402;
      return {
        success: false,
        evaluation: {
          ...fallback,
          reason: isPayment
            ? `${fallback.reason} (AI credits exhausted: 402 Payment Required)`.slice(0, 140)
            : fallback.reason,
        },
        error: isPayment ? 'AI credits exhausted (402 Payment Required)' : `API error: ${errMsg}`,
      };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
    const finishReason = data.choices?.[0]?.finish_reason;

    if (!rawContent) {
      return { success: false, evaluation: fallback, error: 'Model returned empty response' };
    }

    // Strip <think>...</think> tags emitted by reasoning models (MiniMax, DeepSeek, etc.)
    let cleanContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (cleanContent.includes('<think>')) {
      cleanContent = cleanContent.split(/<\/think>/i)[1]?.trim() || '';
    }

    // Extract JSON object
    const start = cleanContent.indexOf('{');
    const end = cleanContent.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      if (finishReason === 'length') {
        return {
          success: false,
          evaluation: fallback,
          error: 'Model reached token limit during reasoning. Please try again.',
        };
      }
      return {
        success: false,
        evaluation: fallback,
        error: 'Could not extract valid JSON from model response.',
      };
    }

    const parsed = JSON.parse(cleanContent.slice(start, end + 1));
    const score = Number.isFinite(Number(parsed.score))
      ? Math.min(5, Math.max(1, Math.round(Number(parsed.score) * 10) / 10))
      : fallback.score;

    const verdict = score >= 4.0 ? 'Apply' : score >= 3.5 ? 'Caution' : 'Skip';
    const verdictLabel =
      verdict === 'Apply' ? '🟢 Apply' : verdict === 'Caution' ? '🟡 Apply with caution' : '🔴 Skip';

    const aiEvaluation: JobEvaluation = {
      score,
      verdict,
      verdictLabel,
      archetype: parsed.archetype || fallback.archetype,
      seniority: parsed.seniority || fallback.seniority,
      level: fallback.level,
      remote: parsed.remote || fallback.remote,
      legitimacy:
        parsed.legitimacy === 'Suspicious' || parsed.legitimacy === 'Proceed with Caution'
          ? parsed.legitimacy
          : 'High Confidence',
      reason: String(parsed.reason || fallback.reason).slice(0, 140),
      matchedSkills:
        Array.isArray(parsed.matchedSkills) && parsed.matchedSkills.length > 0
          ? parsed.matchedSkills
          : fallback.matchedSkills,
      missingSkills: Array.isArray(parsed.missingSkills)
        ? parsed.missingSkills
        : fallback.missingSkills,
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : fallback.redFlags,
      aiEnhanced: true,
    };

    return { success: true, evaluation: aiEvaluation };
  } catch (err: any) {
    return {
      success: false,
      evaluation: fallback,
      error: err?.message || 'Failed to connect to AI endpoint',
    };
  }
}
