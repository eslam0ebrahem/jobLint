import type {
  EvaluationEvidence,
  EvaluationScoreBreakdown,
  JobEvaluation,
  RiskLevel,
  Verdict,
} from '@/src/types/job';

const SCORE_MIN = 1;
const SCORE_MAX = 5;

function clampScore(value: unknown, fallback = 3): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(number * 10) / 10));
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function verdictFromScore(score: number): Verdict {
  return score >= 4 ? 'Apply' : score >= 3.5 ? 'Caution' : 'Skip';
}

function labelForVerdict(verdict: Verdict): string {
  return verdict === 'Apply' ? '🟢 Apply' : verdict === 'Caution' ? '🟡 Apply with caution' : '🔴 Skip';
}

function legacyRisk(redFlags: string[], legitimacy: JobEvaluation['legitimacy']): RiskLevel {
  if (legitimacy === 'Suspicious' || redFlags.some((flag) => /unpaid|commission|suspicious/i.test(flag))) return 'high';
  if (redFlags.length || legitimacy === 'Proceed with Caution') return 'medium';
  return 'low';
}

/**
 * Converts both the original v1 evaluation and partially populated imported
 * reports into the current report contract. Unknown values are represented as
 * missing evidence instead of being silently invented.
 */
export function normalizeEvaluation(value: unknown): JobEvaluation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const redFlags = stringArray(input.redFlags);
  const score = clampScore(input.score, 3);
  const verdict = (input.verdict === 'Apply' || input.verdict === 'Caution' || input.verdict === 'Skip'
    ? input.verdict
    : verdictFromScore(score)) as Verdict;
  const legitimacy = input.legitimacy === 'Suspicious' || input.legitimacy === 'Proceed with Caution'
    ? input.legitimacy
    : 'High Confidence';
  const fitScore = clampScore(input.fitScore, score);
  const opportunityScore = clampScore(input.opportunityScore, Math.max(1, score - 0.2));
  const safetyScore = clampScore(input.safetyScore, Math.max(1, score - redFlags.length * 0.5));
  const evidence = Array.isArray(input.evidence)
    ? (input.evidence as unknown[]).filter((item): item is EvaluationEvidence => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.id === 'string' && typeof candidate.label === 'string';
      })
    : [];
  const breakdown = (input.scoreBreakdown && typeof input.scoreBreakdown === 'object'
    ? input.scoreBreakdown
    : {}) as Partial<EvaluationScoreBreakdown>;
  const overall = clampScore(breakdown.overall, score);
  return {
    version: 2,
    evaluator: input.evaluator === 'ai' ? 'ai' : 'heuristic',
    createdAt: stringValue(input.createdAt, new Date().toISOString()),
    score,
    verdict,
    verdictLabel: stringValue(input.verdictLabel, labelForVerdict(verdict)),
    archetype: stringValue(input.archetype, 'Backend'),
    seniority: stringValue(input.seniority, 'Mid'),
    level: typeof input.level === 'string' ? input.level : undefined,
    remote: stringValue(input.remote, 'On-site'),
    legitimacy,
    reason: stringValue(input.reason, 'No evaluation rationale was recorded.'),
    matchedSkills: stringArray(input.matchedSkills),
    missingSkills: stringArray(input.missingSkills),
    redFlags,
    fitScore,
    opportunityScore,
    safetyScore,
    confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.5)),
    riskLevel: (input.riskLevel === 'high' || input.riskLevel === 'medium' || input.riskLevel === 'low'
      ? input.riskLevel
      : legacyRisk(redFlags, legitimacy)) as RiskLevel,
    missingData: stringArray(input.missingData),
    evidence,
    scoreBreakdown: {
      fit: fitScore,
      opportunity: opportunityScore,
      safety: safetyScore,
      overall,
    },
    aiEnhanced: input.aiEnhanced === true,
    aiModel: typeof input.aiModel === 'string' ? input.aiModel : undefined,
    aiAssessment: input.aiAssessment && typeof input.aiAssessment === 'object'
      ? (input.aiAssessment as JobEvaluation['aiAssessment'])
      : undefined,
  };
}
