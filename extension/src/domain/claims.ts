import {
  CLAIM_KINDS,
  CLAIM_SOURCES,
  CLAIM_STATUSES,
  type CandidateClaim,
  type CandidateClaimInput,
  type ClaimKind,
  type ClaimLedgerSnapshot,
  type ClaimSource,
  type ClaimStatus,
  type RequirementEvidence,
} from '@/src/types/claims';
import type { ClaimSupport, EvaluationEvidence, Job, JobEvaluation } from '@/src/types/job';
import { cleanString, isRecord } from './shared';

export const MATCHABLE_CLAIM_KINDS: readonly ClaimKind[] = [
  'skill',
  'role',
  'experience',
  'certification',
  'education',
  'language',
] as const;

/** Claims in these states can support a packet statement. */
const SUPPORTING_STATUSES: readonly ClaimStatus[] = ['verified', 'asserted'];

export function isClaimKind(value: unknown): value is ClaimKind {
  return typeof value === 'string' && CLAIM_KINDS.includes(value as ClaimKind);
}

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === 'string' && CLAIM_STATUSES.includes(value as ClaimStatus);
}

export function isClaimSource(value: unknown): value is ClaimSource {
  return typeof value === 'string' && CLAIM_SOURCES.includes(value as ClaimSource);
}

export interface NormalizeClaimOptions {
  existing?: CandidateClaim;
  timestamp: string;
  createId: (prefix: string) => string;
}

/**
 * Deterministic, offline normalization. Unknown enum values fall back rather
 * than throwing so a malformed import can never break the ledger.
 */
export function normalizeClaim(input: unknown, options: NormalizeClaimOptions): CandidateClaim | undefined {
  if (!isRecord(input)) return undefined;
  const existing = options.existing;
  const label = cleanString(input.label, 200);
  if (!label) return undefined;
  const status = isClaimStatus(input.status) ? input.status : existing?.status || 'asserted';
  const source = isClaimSource(input.source) ? input.source : existing?.source || 'manual';
  const createdAt = existing?.createdAt || cleanString(input.createdAt, 100) || options.timestamp;
  const claim: CandidateClaim = {
    version: 1,
    id: existing?.id || cleanString(input.id, 200) || options.createId('claim'),
    kind: isClaimKind(input.kind) ? input.kind : existing?.kind || 'skill',
    label,
    value: cleanString(input.value, 1_000),
    status,
    source,
    reference: cleanString(input.reference, 2_000),
    notes: cleanString(input.notes, 2_000),
    createdAt,
    updatedAt: options.timestamp,
  };
  if (status === 'verified') {
    claim.verifiedAt = existing?.verifiedAt && existing.status === 'verified' ? existing.verifiedAt : options.timestamp;
  }
  return claim;
}

/** Strips punctuation so `Node.js`, `node js` and `NODEJS` compare equal. */
export function compactLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Containment match with a length floor: `postgres` covers `postgresql`, but a
 * two-letter token never matches by accident.
 */
export function labelsMatch(requirement: string, claim: string): boolean {
  const left = compactLabel(requirement);
  const right = compactLabel(claim);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 4 && longer.includes(shorter);
}

export function supportingClaims(claims: CandidateClaim[]): CandidateClaim[] {
  return claims.filter(
    (claim) =>
      SUPPORTING_STATUSES.includes(claim.status) &&
      MATCHABLE_CLAIM_KINDS.includes(claim.kind) &&
      compactLabel(claim.label).length > 0,
  );
}

/** Matches one requirement against the ledger and explains the result. */
export function matchRequirement(requirement: string, claims: CandidateClaim[]): RequirementEvidence {
  const trimmed = requirement.trim();
  if (!trimmed) return { requirement: trimmed, status: 'unknown', claimIds: [] };
  const candidates = supportingClaims(claims);
  const matched = candidates.filter((claim) => labelsMatch(trimmed, claim.label));
  if (!matched.length) return { requirement: trimmed, status: 'gap', claimIds: [] };
  const verified = matched.filter((claim) => claim.status === 'verified');
  const status = verified.length ? 'covered' : 'partial';
  const detail = verified.length
    ? `Supported by ${verified.map((claim) => claim.label).join(', ')}.`
    : `Asserted but not verified: ${matched.map((claim) => claim.label).join(', ')}.`;
  return { requirement: trimmed, status, claimIds: matched.map((claim) => claim.id), detail };
}

function requirementPool(job: Job): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  const push = (value: string | undefined) => {
    const label = value?.trim();
    if (!label) return;
    const key = compactLabel(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(label);
  };
  for (const skill of job.facts?.skills || []) push(skill);
  for (const skill of job.evaluation?.matchedSkills || []) push(skill);
  for (const qualification of job.facts?.qualifications || []) push(qualification);
  for (const gap of job.evaluation?.missingSkills || []) push(gap);
  return pool;
}

/** Ordered, de-duplicated requirement coverage for a posting. */
export function buildRequirementEvidence(job: Job, claims: CandidateClaim[], limit = 12): RequirementEvidence[] {
  return requirementPool(job)
    .slice(0, limit)
    .map((requirement) => matchRequirement(requirement, claims));
}

/** Claim IDs that support the skills the evaluator already matched. */
export function claimIdsForEvaluation(job: Job, claims: CandidateClaim[]): string[] {
  const matched = job.evaluation?.matchedSkills || [];
  const ids = new Set<string>();
  for (const skill of matched) {
    for (const claim of supportingClaims(claims)) {
      if (labelsMatch(skill, claim.label)) ids.add(claim.id);
    }
  }
  return [...ids];
}

/** Claim-backed skills for a posting, used to ground packet talking points. */
export function groundSkillsFor(
  matchedSkills: string[],
  claims: CandidateClaim[],
): { skill: string; claimIds: string[]; status: 'covered' | 'partial' }[] {
  const candidates = supportingClaims(claims);
  const result: { skill: string; claimIds: string[]; status: 'covered' | 'partial' }[] = [];
  for (const skill of matchedSkills) {
    const matched = candidates.filter((claim) => labelsMatch(skill, claim.label));
    if (!matched.length) continue;
    result.push({
      skill,
      claimIds: matched.map((claim) => claim.id),
      status: matched.some((claim) => claim.status === 'verified') ? 'covered' : 'partial',
    });
  }
  return result;
}

export function groundedSkills(job: Job, claims: CandidateClaim[]): { skill: string; claimIds: string[]; status: 'covered' | 'partial' }[] {
  return groundSkillsFor(job.evaluation?.matchedSkills || [], claims);
}

const SUPPORT_CONFIDENCE: Record<ClaimSupport, number> = { verified: 0.9, asserted: 0.6, unbacked: 0.3 };

/**
 * Attributes an already-computed evaluation to the claim ledger.
 *
 * Strictly additive: every scoring field is copied through untouched, so the
 * deterministic score cannot move because of a claim. An empty ledger adds
 * nothing, so a profile-only user never sees phantom coverage.
 */
export function attributeEvaluationClaims(evaluation: JobEvaluation, claims: CandidateClaim[]): JobEvaluation {
  const ledger = claims.filter((claim) => claim.status !== 'archived');
  if (!ledger.length) return evaluation;
  const grounded = groundSkillsFor(evaluation.matchedSkills, claims);
  const groundedSkills_ = new Set(grounded.map((item) => item.skill));
  const unbacked = evaluation.matchedSkills.filter((skill) => !groundedSkills_.has(skill));
  const verified = grounded.filter((item) => item.status === 'covered');
  const asserted = grounded.filter((item) => item.status === 'partial');
  const support: ClaimSupport = verified.length ? 'verified' : asserted.length ? 'asserted' : 'unbacked';
  const claimIds = [...new Set(grounded.flatMap((item) => item.claimIds))];

  const detail = grounded.length
    ? [
        verified.length ? `Verified: ${verified.map((item) => item.skill).join(', ')}.` : '',
        asserted.length ? `Asserted but unverified: ${asserted.map((item) => item.skill).join(', ')}.` : '',
        unbacked.length ? `No claim covers: ${unbacked.join(', ')}.` : '',
      ].filter(Boolean).join(' ')
    : 'None of the matched skills are covered by your claim ledger.';

  const claimEvidence: EvaluationEvidence = {
    id: 'claims',
    category: 'profile',
    label: 'Claim ledger coverage',
    value: `${grounded.length}/${evaluation.matchedSkills.length} matched skills backed`,
    detail,
    confidence: SUPPORT_CONFIDENCE[support],
    claimIds,
    support,
  };

  const evidence = evaluation.evidence
    .filter((item) => item.id !== 'claims')
    .map((item) => (item.id === 'skills' ? { ...item, claimIds, support } : item));
  evidence.push(claimEvidence);

  return { ...evaluation, evidence };
}

export function summarizeClaims(claims: CandidateClaim[]): ClaimLedgerSnapshot {
  const kindCounts = Object.fromEntries(CLAIM_KINDS.map((kind) => [kind, 0])) as Record<ClaimKind, number>;
  const statusCounts = Object.fromEntries(CLAIM_STATUSES.map((status) => [status, 0])) as Record<ClaimStatus, number>;
  for (const claim of claims) {
    kindCounts[claim.kind] += 1;
    statusCounts[claim.status] += 1;
  }
  const updatedAt = claims.reduce<string | null>((latest, claim) => (!latest || claim.updatedAt > latest ? claim.updatedAt : latest), null);
  return { version: 1, claims, kindCounts, statusCounts, updatedAt };
}

export type { CandidateClaimInput };
