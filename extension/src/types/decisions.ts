/**
 * Decision records and shortlist comparison.
 *
 * The kanban column is workflow state; the decision record is the user's
 * explicit intent. Keeping them separate means a job can be compared and
 * deferred without pretending it was rejected.
 */

import type { PolicyLevel } from './policy';

export type DecisionState = 'new' | 'shortlisted' | 'deferred' | 'applied' | 'passed' | 'revisit';

export const DECISION_STATES: readonly DecisionState[] = [
  'new',
  'shortlisted',
  'deferred',
  'applied',
  'passed',
  'revisit',
] as const;

export interface JobDecision {
  version: 1;
  /** Equal to the job ID; a job has at most one decision record. */
  id: string;
  jobId: string;
  state: DecisionState;
  rationale?: string;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobDecisionInput = Pick<JobDecision, 'jobId'> &
  Partial<Omit<JobDecision, 'version' | 'id' | 'createdAt' | 'updatedAt'>>;

export interface ComparisonRow {
  jobId: string;
  title: string;
  company: string;
  location?: string;
  score: number | null;
  verdict: 'Apply' | 'Caution' | 'Skip' | null;
  fitScore: number | null;
  opportunityScore: number | null;
  safetyScore: number | null;
  confidence: number | null;
  policyLevel: PolicyLevel;
  policyBlocked: boolean;
  policyIssues: string[];
  coveredRequirements: number;
  totalRequirements: number;
  gapRequirements: string[];
  compensationMax: number | null;
  compensationCurrency?: string;
  /** Days since the posting was published, when known. */
  postingAgeDays: number | null;
  stagedColumn: string;
  decisionState: DecisionState;
  nextAction?: string;
  evidenceIds: string[];
}

export interface JobComparison {
  version: 1;
  generatedAt: string;
  rows: ComparisonRow[];
  recommendedJobId?: string;
  /** Deterministic, human-readable reasons behind the recommendation. */
  basis: string[];
}

export interface DecisionInboxItem {
  jobId: string;
  title: string;
  company: string;
  state: DecisionState;
  score: number | null;
  policyLevel: PolicyLevel;
  policyBlocked: boolean;
  decision?: JobDecision;
  updatedAt: string;
}

export interface DecisionInbox {
  version: 1;
  generatedAt: string;
  items: DecisionInboxItem[];
  counts: Record<DecisionState, number>;
}
