import { DECISION_STATES, type ComparisonRow, type DecisionState, type JobComparison, type JobDecision } from '@/src/types/decisions';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job } from '@/src/types/job';
import type { PolicyReport } from '@/src/types/policy';
import { buildRequirementEvidence } from './claims';
import { cleanString, isRecord } from './shared';

export const MAX_COMPARISON_ROWS = 5;

export function isDecisionState(value: unknown): value is DecisionState {
  return typeof value === 'string' && DECISION_STATES.includes(value as DecisionState);
}

export interface NormalizeDecisionOptions {
  existing?: JobDecision;
  timestamp: string;
}

export function normalizeDecision(input: unknown, options: NormalizeDecisionOptions): JobDecision | undefined {
  if (!isRecord(input)) return undefined;
  const jobId = cleanString(input.jobId, 500);
  if (!jobId) return undefined;
  const state = isDecisionState(input.state) ? input.state : options.existing?.state || 'new';
  const createdAt = options.existing?.createdAt || cleanString(input.createdAt, 100) || options.timestamp;
  return {
    version: 1,
    id: options.existing?.id || cleanString(input.id, 500) || jobId,
    jobId,
    state,
    rationale: cleanString(input.rationale, 4_000),
    nextAction: cleanString(input.nextAction, 500),
    createdAt,
    updatedAt: options.timestamp,
  };
}

function postingAgeDays(job: Job, now: string): number | null {
  const postedAt = job.facts?.postedAt;
  if (!postedAt) return null;
  const start = Date.parse(postedAt);
  const end = Date.parse(now);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function buildComparisonRow(
  job: Job,
  claims: CandidateClaim[],
  policy: PolicyReport | undefined,
  decision: JobDecision | undefined,
  now: string,
): ComparisonRow {
  const requirements = buildRequirementEvidence(job, claims);
  return {
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    score: job.evaluation?.score ?? null,
    verdict: job.evaluation?.verdict ?? null,
    fitScore: job.evaluation?.fitScore ?? null,
    opportunityScore: job.evaluation?.opportunityScore ?? null,
    safetyScore: job.evaluation?.safetyScore ?? null,
    confidence: job.evaluation?.confidence ?? null,
    policyLevel: policy?.level ?? 'unknown',
    policyBlocked: policy?.blocked ?? false,
    policyIssues: (policy?.decisions || [])
      .filter((decisionItem) => (decisionItem.override?.level ?? decisionItem.level) !== 'pass')
      .map((decisionItem) => decisionItem.title),
    coveredRequirements: requirements.filter((item) => item.status === 'covered' || item.status === 'partial').length,
    totalRequirements: requirements.length,
    gapRequirements: requirements.filter((item) => item.status === 'gap').map((item) => item.requirement),
    compensationMax: job.facts?.compensation?.max ?? null,
    compensationCurrency: job.facts?.compensation?.currency,
    postingAgeDays: postingAgeDays(job, now),
    stagedColumn: job.column,
    decisionState: decision?.state || 'new',
    nextAction: decision?.nextAction,
    evidenceIds: (policy?.decisions.flatMap((item) => item.evidenceIds) || []).filter(
      (id, index, all) => all.indexOf(id) === index,
    ),
  };
}

/**
 * Deterministic shortlist comparison. The recommendation is a transparent
 * ranking over the same fields the user can see, never a hidden model score.
 */
export function compareJobs(
  jobs: Job[],
  context: {
    claims: CandidateClaim[];
    policies?: Map<string, PolicyReport>;
    decisions?: Map<string, JobDecision>;
    now?: string;
  },
): JobComparison {
  const now = context.now ?? new Date().toISOString();
  const rows = jobs
    .slice(0, MAX_COMPARISON_ROWS)
    .map((job) =>
      buildComparisonRow(job, context.claims, context.policies?.get(job.id), context.decisions?.get(job.id), now),
    );

  const ranked = [...rows].sort((a, b) => {
    if (a.policyBlocked !== b.policyBlocked) return a.policyBlocked ? 1 : -1;
    if (a.policyLevel !== b.policyLevel) return rank(a.policyLevel) - rank(b.policyLevel);
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const coverageA = a.totalRequirements ? a.coveredRequirements / a.totalRequirements : 0;
    const coverageB = b.totalRequirements ? b.coveredRequirements / b.totalRequirements : 0;
    if (coverageA !== coverageB) return coverageB - coverageA;
    return a.title.localeCompare(b.title);
  });

  const best = ranked[0];
  const basis: string[] = [];
  if (best) {
    basis.push(`Highest local score (${best.score ?? 'not evaluated'}) among ${rows.length} compared postings.`);
    if (best.coveredRequirements) basis.push(`${best.coveredRequirements} of ${best.totalRequirements} detected requirements are backed by your claim ledger.`);
    if (best.policyLevel === 'pass') basis.push('No policy gate is cautioning on this posting.');
    if (best.policyBlocked) basis.push('This posting is blocked by a policy gate, so override it before acting.');
    if (best.confidence !== null) basis.push(`Evaluation confidence is ${Math.round(best.confidence * 100)}%.`);
  }
  return {
    version: 1,
    generatedAt: now,
    rows,
    recommendedJobId: best?.policyBlocked ? undefined : best?.jobId,
    basis,
  };
}

function rank(level: ComparisonRow['policyLevel']): number {
  return level === 'block' ? 3 : level === 'caution' ? 2 : level === 'unknown' ? 1 : 0;
}
