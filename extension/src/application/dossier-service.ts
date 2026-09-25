import type { ApplicationDossier, DossierAnswerInput, DossierArtifactInput, DossierStatus } from '@/src/types/dossier';
import type { ApplicationPacket } from '@/src/types/packet';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job } from '@/src/types/job';
import type { ApplicationEvent } from '@/src/types/job';
import type { PolicyReport } from '@/src/types/policy';
import {
  createDossier,
  linkDossierEvent,
  removeDossierAnswer,
  removeDossierArtifact,
  setDossierStatus,
  upsertDossierAnswer,
  upsertDossierArtifact,
} from '@/src/domain/dossier';
import { claimIdsForEvaluation } from '@/src/domain/claims';

export interface DossierRepository {
  getAll(jobId?: string): Promise<ApplicationDossier[]>;
  getById(id: string): Promise<ApplicationDossier | undefined>;
  getLatestForJob(jobId: string): Promise<ApplicationDossier | undefined>;
  save(record: ApplicationDossier): Promise<ApplicationDossier>;
  delete(id: string): Promise<boolean>;
}

export interface DossierJobReader {
  get(id: string): Promise<Job | undefined>;
  getEvents(jobId: string): Promise<{ id: string; type: string; at: string }[]>;
}

export interface DossierClaimReader {
  getAll(): Promise<CandidateClaim[]>;
}

export interface DossierEvents {
  changed(jobId: string): void;
}

/** Appends to the job's transition ledger so the dossier is replayable. */
export interface DossierEventRecorder {
  recordEvent(jobId: string, type: ApplicationEvent['type'], metadata?: ApplicationEvent['metadata']): Promise<ApplicationEvent>;
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Captures what was actually submitted. The dossier is written once per
 * submission and never mutates the job it came from.
 */
export class DossierService {
  constructor(
    private readonly jobs: DossierJobReader,
    private readonly repository: DossierRepository,
    private readonly claims: DossierClaimReader,
    private readonly ledger?: DossierEventRecorder,
    private readonly events: DossierEvents = { changed: () => undefined },
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  list(jobId?: string): Promise<ApplicationDossier[]> {
    return this.repository.getAll(jobId);
  }

  async open(jobId: string, packet?: ApplicationPacket, policy?: PolicyReport): Promise<ApplicationDossier> {
    const job = await this.jobs.get(jobId);
    if (!job) throw new Error('Job not found.');
    const timestamp = this.now();
    const claimIds = claimIdsForEvaluation(job, await this.claims.getAll());
    const dossier = createDossier({ job, packet, policy, claimIds, capturedAt: timestamp, createId: makeId });
    const saved = await this.repository.save(dossier);
    await this.record(saved, 'dossier_opened', { dossierId: saved.id, claims: claimIds.length });
    this.events.changed(jobId);
    return saved;
  }

  /** Creates the dossier only if the job has none yet, and returns the existing one otherwise. */
  async ensure(jobId: string, packet?: ApplicationPacket, policy?: PolicyReport): Promise<ApplicationDossier> {
    return (await this.repository.getLatestForJob(jobId)) || this.open(jobId, packet, policy);
  }

  async saveAnswer(id: string, input: DossierAnswerInput): Promise<ApplicationDossier> {
    const saved = await this.mutate(id, (dossier, timestamp) => upsertDossierAnswer(dossier, input, { createId: makeId, timestamp }));
    await this.record(saved, 'answer_recorded', { dossierId: saved.id, answers: saved.answers.length });
    return saved;
  }

  async removeAnswer(id: string, answerId: string): Promise<ApplicationDossier> {
    return this.mutate(id, (dossier, timestamp) => removeDossierAnswer(dossier, answerId, timestamp));
  }

  async saveArtifact(id: string, input: DossierArtifactInput): Promise<ApplicationDossier> {
    const saved = await this.mutate(id, (dossier, timestamp) => upsertDossierArtifact(dossier, input, { createId: makeId, timestamp }));
    await this.record(saved, 'artifact_attached', { dossierId: saved.id, artifacts: saved.artifacts.length });
    return saved;
  }

  async removeArtifact(id: string, artifactId: string): Promise<ApplicationDossier> {
    return this.mutate(id, (dossier, timestamp) => removeDossierArtifact(dossier, artifactId, timestamp));
  }

  async markStatus(id: string, status: DossierStatus): Promise<ApplicationDossier> {
    const saved = await this.mutate(id, (dossier, timestamp) => setDossierStatus(dossier, status, timestamp));
    await this.record(saved, status === 'submitted' ? 'dossier_submitted' : status === 'closed' ? 'dossier_closed' : 'dossier_opened', {
      dossierId: saved.id,
      status,
    });
    return saved;
  }

  async linkEvent(id: string, eventId: string): Promise<ApplicationDossier> {
    return this.mutate(id, (dossier, timestamp) => linkDossierEvent(dossier, eventId, timestamp));
  }

  async remove(id: string): Promise<true> {
    // The record must be read before deletion so subscribers are told which
    // job changed, not which dossier was dropped.
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error('Dossier not found.');
    const removed = await this.repository.delete(id);
    if (!removed) throw new Error('Dossier not found.');
    this.events.changed(existing.jobId);
    return true;
  }

  /** Best-effort: losing an audit entry must never fail the user's action. */
  private async record(
    dossier: ApplicationDossier,
    type: ApplicationEvent['type'],
    metadata: ApplicationEvent['metadata'],
  ): Promise<void> {
    try {
      await this.ledger?.recordEvent(dossier.jobId, type, metadata);
    } catch {
      // The dossier is already persisted; the ledger entry is advisory.
    }
  }

  private async mutate(
    id: string,
    update: (dossier: ApplicationDossier, timestamp: string) => ApplicationDossier,
  ): Promise<ApplicationDossier> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error('Dossier not found.');
    const saved = await this.repository.save(update(existing, this.now()));
    this.events.changed(saved.jobId);
    return saved;
  }
}
