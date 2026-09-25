/**
 * Application dossier.
 *
 * A dossier is an immutable, local record of what was actually sent to an
 * employer: the posting as captured, the answers given, the versions of the
 * packet and evaluator that produced them, and the artifacts referenced. It
 * never overwrites the job; the job keeps moving and the dossier keeps the
 * evidence of one specific submission.
 */

import type { JobFacts, JobSource, DetectionState } from './job';
import type { PolicyLevel } from './policy';

export interface PostingSnapshot {
  version: 1;
  capturedAt: string;
  title: string;
  company: string;
  location?: string;
  jobUrl?: string;
  applyUrl?: string;
  description: string;
  requirements?: string;
  salary?: string;
  facts?: JobFacts;
  /** Stable hash of the captured text so reposts and edits are detectable. */
  contentHash: string;
  detector: {
    source: JobSource;
    strategy: string;
    state: DetectionState;
    version: string;
  };
}

export interface DossierAnswer {
  id: string;
  question: string;
  answer: string;
  /** Claim IDs the answer relies on, when known. */
  claimIds: string[];
  updatedAt: string;
}

export type DossierArtifactKind = 'resume' | 'cover_letter' | 'portfolio' | 'other';

export interface DossierArtifact {
  id: string;
  kind: DossierArtifactKind;
  label: string;
  /** Local filename, URL, or free-text pointer. JobLint never uploads the file. */
  reference: string;
  claimIds: string[];
  createdAt: string;
}

export type DossierStatus = 'draft' | 'submitted' | 'closed';

export interface ApplicationDossier {
  version: 1;
  id: string;
  jobId: string;
  status: DossierStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  posting: PostingSnapshot;
  packet: {
    packetVersion: number;
    generatedAt: string;
    score: number | null;
    claimIds: string[];
    policyLevel: PolicyLevel;
  };
  evaluation: {
    evaluator: 'heuristic' | 'ai';
    evaluatorVersion: number;
    score: number;
    verdict: 'Apply' | 'Caution' | 'Skip';
    createdAt: string;
  } | null;
  answers: DossierAnswer[];
  artifacts: DossierArtifact[];
  /** Application event IDs that belong to this submission. */
  eventIds: string[];
}

export type DossierAnswerInput = Omit<DossierAnswer, 'id' | 'updatedAt' | 'claimIds'> & { id?: string; claimIds?: string[] };
export type DossierArtifactInput = Omit<DossierArtifact, 'id' | 'createdAt' | 'claimIds'> & { id?: string; claimIds?: string[] };
