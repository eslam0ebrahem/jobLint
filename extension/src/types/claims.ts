/**
 * Candidate claim ledger.
 *
 * A claim is something the user asserts about themselves, stored locally with
 * the provenance that justifies it. Claims never change the deterministic
 * score; they only add provenance so a packet can cite a specific, auditable
 * reason instead of a free-text profile string.
 */

export type ClaimKind =
  | 'skill'
  | 'role'
  | 'experience'
  | 'education'
  | 'certification'
  | 'authorization'
  | 'language'
  | 'compensation'
  | 'availability';

export type ClaimStatus = 'verified' | 'asserted' | 'disputed' | 'archived';

export type ClaimSource = 'profile' | 'resume' | 'manual' | 'import';

/** How well the claim ledger covers one requirement detected in a posting. */
export type RequirementStatus = 'covered' | 'partial' | 'gap' | 'unknown';

export interface CandidateClaim {
  version: 1;
  id: string;
  kind: ClaimKind;
  /** Canonical, matchable label (for example `TypeScript`). */
  label: string;
  /** Optional detail such as years, level, or scope. */
  value?: string;
  status: ClaimStatus;
  source: ClaimSource;
  /** Where the claim came from: a file name, a link, or a short note. */
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
}

export type CandidateClaimInput = Pick<CandidateClaim, 'kind' | 'label'> &
  Partial<Omit<CandidateClaim, 'version' | 'kind' | 'label' | 'createdAt' | 'updatedAt' | 'verifiedAt' | 'status' | 'source'>> & {
    id?: string;
    status?: ClaimStatus;
    source?: ClaimSource;
  };

export interface RequirementEvidence {
  requirement: string;
  status: RequirementStatus;
  claimIds: string[];
  detail?: string;
}

export interface ClaimLedgerSnapshot {
  version: 1;
  claims: CandidateClaim[];
  kindCounts: Record<ClaimKind, number>;
  statusCounts: Record<ClaimStatus, number>;
  updatedAt: string | null;
}

export const CLAIM_KINDS: readonly ClaimKind[] = [
  'skill',
  'role',
  'experience',
  'education',
  'certification',
  'authorization',
  'language',
  'compensation',
  'availability',
] as const;

export const CLAIM_STATUSES: readonly ClaimStatus[] = ['verified', 'asserted', 'disputed', 'archived'] as const;

export const CLAIM_SOURCES: readonly ClaimSource[] = ['profile', 'resume', 'manual', 'import'] as const;
