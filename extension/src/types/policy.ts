/**
 * Workflow policy gates.
 *
 * Gates answer "should I be allowed to move forward on this posting, given
 * what the user told me about themselves?" They are deliberately separate from
 * the deterministic score: a high-scoring job can still be blocked, and a
 * blocked job keeps its score so the user can override deliberately.
 */

export type PolicyLevel = 'pass' | 'caution' | 'block' | 'unknown';

export type PolicyCode =
  | 'do_not_apply_company'
  | 'do_not_apply_domain'
  | 'work_authorization'
  | 'untrusted_source'
  | 'apply_url_mismatch'
  | 'posting_freshness_unknown'
  | 'stale_posting'
  | 'deadline_passed'
  | 'compensation_below_floor'
  | 'low_evaluation_confidence';

export interface PolicyGateDefinition {
  code: PolicyCode;
  title: string;
  description: string;
  /** Blocks are always overridable; the user is the only authority on their own applications. */
  overridable: boolean;
}

export interface PolicyOverride {
  at: string;
  /** The level the gate reports after the user overrode it. */
  level: PolicyLevel;
  note?: string;
}

export interface PolicyDecision {
  code: PolicyCode;
  level: PolicyLevel;
  title: string;
  reason: string;
  /** Job facts, evaluation evidence, or claim IDs that produced the decision. */
  evidenceIds: string[];
  overridable: boolean;
  override?: PolicyOverride;
}

export interface PolicyReport {
  version: 1;
  jobId: string;
  /** Worst effective level across all decisions. */
  level: PolicyLevel;
  decisions: PolicyDecision[];
  blocked: boolean;
  /** Decisions that are still `unknown` because the user has not configured the constraint. */
  unresolved: number;
  overridden: number;
  generatedAt: string;
}

/** User-authored constraints. Empty lists mean "not configured", never "allow". */
export interface PolicyConstraints {
  doNotApplyCompanies: string[];
  doNotApplyDomains: string[];
  /** Regions the user is authorized to work in, as free-form labels (`US`, `California`). */
  authorizedRegions: string[];
  minimumCompensation: number | null;
  /** Days after `postedAt` before a posting is treated as stale. */
  stalePostingDays: number;
  /** Minimum evaluation confidence before a posting needs a human look. */
  minEvaluationConfidence: number;
}

export interface PolicyOverrideInput {
  jobId: string;
  code: PolicyCode;
  level?: PolicyLevel;
  note?: string;
}

/** A persisted, per-job override of one gate. */
export interface StoredPolicyOverride extends PolicyOverride {
  key: string;
  jobId: string;
  code: PolicyCode;
  createdAt: string;
  updatedAt: string;
}

export const POLICY_LEVELS: readonly PolicyLevel[] = ['pass', 'caution', 'block', 'unknown'] as const;

/** Worst-first ordering used to reduce a set of decisions to one level. */
export const POLICY_LEVEL_RANK: Readonly<Record<PolicyLevel, number>> = {
  block: 3,
  caution: 2,
  unknown: 1,
  pass: 0,
};

export const DEFAULT_POLICY_CONSTRAINTS: PolicyConstraints = {
  doNotApplyCompanies: [],
  doNotApplyDomains: [],
  authorizedRegions: [],
  minimumCompensation: null,
  stalePostingDays: 45,
  minEvaluationConfidence: 0.4,
};

export const POLICY_CODES: readonly PolicyCode[] = [
  'do_not_apply_company',
  'do_not_apply_domain',
  'work_authorization',
  'untrusted_source',
  'apply_url_mismatch',
  'posting_freshness_unknown',
  'stale_posting',
  'deadline_passed',
  'compensation_below_floor',
  'low_evaluation_confidence',
] as const;
