import type { CandidateClaim, ClaimKind, ClaimLedgerSnapshot, RequirementEvidence } from '@/src/types/claims';
import type { Job } from '@/src/types/job';
import { buildRequirementEvidence, claimIdsForEvaluation, groundedSkills, summarizeClaims } from '@/src/domain/claims';

export interface ClaimRepository {
  getAll(options?: { kind?: ClaimKind; status?: CandidateClaim['status'] }): Promise<CandidateClaim[]>;
  getById(id: string): Promise<CandidateClaim | undefined>;
  save(input: unknown): Promise<CandidateClaim | undefined>;
  delete(id: string): Promise<boolean>;
}

export interface ClaimEvents {
  changed(reason: string): void;
}

/** Owns the local fact ledger. It never changes a score; it only adds provenance. */
export class ClaimService {
  constructor(
    private readonly repository: ClaimRepository,
    private readonly events: ClaimEvents = { changed: () => undefined },
  ) {}

  async list(options: { kind?: ClaimKind; status?: CandidateClaim['status'] } = {}): Promise<ClaimLedgerSnapshot> {
    return summarizeClaims(await this.repository.getAll(options));
  }

  /** Raw ledger access for callers that already do their own aggregation. */
  getAll(options: { kind?: ClaimKind; status?: CandidateClaim['status'] } = {}): Promise<CandidateClaim[]> {
    return this.repository.getAll(options);
  }

  async save(input: unknown): Promise<CandidateClaim> {
    const claim = await this.repository.save(input);
    if (!claim) throw new Error('A claim needs a label.');
    this.events.changed('claim-saved');
    return claim;
  }

  async setStatus(id: string, status: CandidateClaim['status']): Promise<CandidateClaim> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error('Claim not found.');
    return this.save({ ...existing, status });
  }

  async remove(id: string): Promise<true> {
    const removed = await this.repository.delete(id);
    if (!removed) throw new Error('Claim not found.');
    this.events.changed('claim-deleted');
    return true;
  }

  async requirements(job: Job): Promise<RequirementEvidence[]> {
    return buildRequirementEvidence(job, await this.repository.getAll());
  }

  async evidenceFor(job: Job): Promise<{
    requirements: RequirementEvidence[];
    claimIds: string[];
    grounded: ReturnType<typeof groundedSkills>;
  }> {
    const claims = await this.repository.getAll();
    return {
      requirements: buildRequirementEvidence(job, claims),
      claimIds: claimIdsForEvaluation(job, claims),
      grounded: groundedSkills(job, claims),
    };
  }
}
