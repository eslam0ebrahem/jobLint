import type { DiscoveryInboxSnapshot, DiscoveryRecord, DiscoverySaveResult } from '@/src/types/discovery';
import type { DetectedJob, Job, JobEvaluation, Profile, UserPreferences } from '@/src/types/job';
import { buildDiscoveryRecord, createDiscoveryInbox, normalizeDiscoveryCandidate } from '@/src/domain/discovery';

export interface DiscoveryRepository {
  getAll(): Promise<DiscoveryRecord[]>;
  getById(id: string): Promise<DiscoveryRecord | undefined>;
  saveMany(records: DiscoveryRecord[]): Promise<{ records: DiscoveryRecord[]; addedCount: number; refreshedCount: number }>;
  setStatus(id: string, status: DiscoveryRecord['status'], updatedAt: string, savedJobId?: string): Promise<DiscoveryRecord | undefined>;
}

export interface DiscoverySettings {
  getProfile(): Promise<Profile>;
  getPreferences(): Promise<UserPreferences>;
}

export interface DiscoveryJobSaver {
  saveFromDiscovery(job: DetectedJob): Promise<{ job: Job; isNew: boolean }>;
}

export type DiscoveryEvaluator = (
  job: DetectedJob,
  profile?: Profile,
  preferences?: UserPreferences,
) => JobEvaluation;

export interface DiscoveryEvents {
  changed(reason: string): void;
}

export class DiscoveryService {
  constructor(
    private readonly repository: DiscoveryRepository,
    private readonly settings: DiscoverySettings,
    private readonly jobs: DiscoveryJobSaver,
    private readonly evaluate: DiscoveryEvaluator,
    private readonly events: DiscoveryEvents,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(): Promise<DiscoveryInboxSnapshot> {
    return createDiscoveryInbox(await this.repository.getAll());
  }

  async ingest(values: unknown[]): Promise<DiscoveryInboxSnapshot> {
    const timestamp = this.now();
    const candidates = new Map<string, NonNullable<ReturnType<typeof normalizeDiscoveryCandidate>>>();
    for (const value of values) {
      const candidate = normalizeDiscoveryCandidate(value, timestamp);
      if (candidate) candidates.set(candidate.id, candidate);
    }
    if (!candidates.size) return this.list();

    const [profile, preferences, existing] = await Promise.all([
      this.settings.getProfile(),
      this.settings.getPreferences(),
      this.repository.getAll(),
    ]);
    const existingById = new Map(existing.map((record) => [record.id, record]));
    const records = [...candidates.values()].map((candidate) => buildDiscoveryRecord(
      candidate,
      this.evaluate(candidate.job, profile, preferences),
      existingById.get(candidate.id),
      timestamp,
    ));
    const saved = await this.repository.saveMany(records);
    this.events.changed('discovery-scanned');
    return createDiscoveryInbox(await this.repository.getAll(), {
      scannedAt: timestamp,
      detectedCount: candidates.size,
      addedCount: saved.addedCount,
      refreshedCount: saved.refreshedCount,
    });
  }

  async save(id: string): Promise<DiscoverySaveResult> {
    const record = await this.repository.getById(id);
    if (!record) throw new Error('Discovery item not found.');
    if (record.status === 'dismissed') throw new Error('Dismissed discovery items cannot be saved.');
    if (record.status === 'saved') throw new Error('Discovery item is already saved.');

    const result = await this.jobs.saveFromDiscovery({ ...record.job, evaluation: record.evaluation });
    const updated = await this.repository.setStatus(id, 'saved', this.now(), result.job.id);
    if (!updated) throw new Error('Discovery item not found after save.');
    this.events.changed('discovery-saved');
    return { record: updated, job: result.job, isNew: result.isNew };
  }

  async dismiss(id: string): Promise<DiscoveryRecord> {
    const record = await this.repository.getById(id);
    if (!record) throw new Error('Discovery item not found.');
    if (record.status === 'saved') throw new Error('Saved jobs cannot be dismissed from discovery.');
    const updated = await this.repository.setStatus(id, 'dismissed', this.now());
    if (!updated) throw new Error('Discovery item not found after dismissal.');
    this.events.changed('discovery-dismissed');
    return updated;
  }

  async revisit(id: string): Promise<string> {
    const record = await this.repository.getById(id);
    if (!record) throw new Error('Discovery item not found.');
    const url = record.job.jobUrl || record.job.applyUrl;
    if (!url) throw new Error('This discovery item has no valid revisit URL.');
    return url;
  }
}
