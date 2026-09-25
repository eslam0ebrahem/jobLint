import type { ClaimKind, ClaimStatus, RequirementEvidence } from '@/src/types/claims';
import type { Job, JobDeadline, JobEvaluation, Profile } from '@/src/types/job';

export interface PacketJobSnapshot {
  id: string;
  title: string;
  company: string;
  location?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionExcerpt?: string;
  deadline?: JobDeadline;
  facts?: Job['facts'];
}

export interface PacketProfileSnapshot {
  roles?: string;
  skills?: string;
  location?: string;
  summary?: string;
}

export interface PacketEvidence {
  id: string;
  source: 'job' | 'profile' | 'evaluation' | 'claim';
  label: string;
  value?: string;
  detail?: string;
  confidence: number;
  /** Set when the evidence is backed by a specific candidate claim. */
  claimIds?: string[];
}

/** A claim cited by the packet, inlined so the export stays self-contained. */
export interface PacketClaimReference {
  claimId: string;
  label: string;
  kind: ClaimKind;
  status: ClaimStatus;
  reference?: string;
}

/**
 * `not-configured` when the claim ledger is empty, so a profile-only user is
 * never told their claims are unsupported.
 */
export type PacketClaimCoverage = 'not-configured' | 'none' | 'partial' | 'full';

export interface ApplicationPacket {
  version: 2;
  localOnly: true;
  generatedAt: string;
  job: PacketJobSnapshot;
  profile: PacketProfileSnapshot;
  alignment: {
    score: number | null;
    verdict: JobEvaluation['verdict'] | null;
    confidence: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    missingData: string[];
  };
  claims: PacketClaimReference[];
  claimCoverage: PacketClaimCoverage;
  requirements: RequirementEvidence[];
  /** Matched skills with no claim behind them; the packet will not assert them. */
  unsupportedClaims: string[];
  talkingPoints: string[];
  questions: string[];
  checklist: string[];
  evidence: PacketEvidence[];
  disclosure: string;
}

export type ApplicationPacketProfile = Profile;
