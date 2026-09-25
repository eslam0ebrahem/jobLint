import type { ApplicationEvent, Job } from '@/src/types/job';
import type { PolicyCode, PolicyConstraints, PolicyLevel, PolicyOverrideInput, PolicyReport, StoredPolicyOverride } from '@/src/types/policy';
import { evaluatePolicy, isPolicyCode } from '@/src/domain/policy';

export interface PolicyJobReader {
  get(id: string): Promise<Job | undefined>;
}

export interface PolicySettingsReader {
  getPolicyConstraints(): Promise<PolicyConstraints>;
}

export interface PolicyOverrideRepository {
  getAll(jobId?: string): Promise<StoredPolicyOverride[]>;
  save(input: { jobId: string; code: string; level?: unknown; note?: unknown }): Promise<StoredPolicyOverride | undefined>;
  delete(jobId: string, code: string): Promise<boolean>;
}

export interface PolicyEvents {
  changed(jobId: string): void;
}

/** Appends the override to the job's transition ledger. */
export interface PolicyEventRecorder {
  recordEvent(jobId: string, type: ApplicationEvent['type'], metadata?: ApplicationEvent['metadata']): Promise<ApplicationEvent>;
}

/**
 * Applies the user's own constraints to a posting. Overrides are always
 * explicit and always recorded, so a gate never silently flips itself.
 */
export class PolicyService {
  constructor(
    private readonly jobs: PolicyJobReader,
    private readonly settings: PolicySettingsReader,
    private readonly overrides: PolicyOverrideRepository,
    private readonly ledger?: PolicyEventRecorder,
    private readonly events: PolicyEvents = { changed: () => undefined },
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async report(jobId: string): Promise<PolicyReport> {
    const job = await this.jobs.get(jobId);
    if (!job) throw new Error('Job not found.');
    const [constraints, stored] = await Promise.all([
      this.settings.getPolicyConstraints(),
      this.overrides.getAll(jobId),
    ]);
    const map = new Map<string, StoredPolicyOverride>(stored.map((item) => [item.code, item]));
    const report = evaluatePolicy(job, {
      constraints,
      now: this.now(),
      overrides: (_id, code: PolicyCode) => map.get(code),
    });
    return report;
  }

  async reportFor(job: Job): Promise<PolicyReport> {
    const [constraints, stored] = await Promise.all([
      this.settings.getPolicyConstraints(),
      this.overrides.getAll(job.id),
    ]);
    const map = new Map<string, StoredPolicyOverride>(stored.map((item) => [item.code, item]));
    return evaluatePolicy(job, { constraints, now: this.now(), overrides: (_id, code) => map.get(code) });
  }

  async override(input: PolicyOverrideInput): Promise<PolicyReport> {
    if (!isPolicyCode(input.code)) throw new Error('Unknown policy gate.');
    if (!input.jobId) throw new Error('A policy override needs a job.');
    const saved = await this.overrides.save({
      jobId: input.jobId,
      code: input.code,
      level: input.level ?? 'caution',
      note: input.note,
    });
    if (!saved) throw new Error('Could not save the policy override.');
    await this.record(input.jobId, input.code, saved.level, 'overridden');
    this.events.changed(input.jobId);
    return this.report(input.jobId);
  }

  async clearOverride(jobId: string, code: string): Promise<PolicyReport> {
    const removed = await this.overrides.delete(jobId, code);
    if (!removed) throw new Error('Policy override not found.');
    await this.record(jobId, code as PolicyCode, 'restored', 'cleared');
    this.events.changed(jobId);
    return this.report(jobId);
  }

  private async record(jobId: string, code: PolicyCode, level: PolicyLevel | 'restored', action: string): Promise<void> {
    try {
      await this.ledger?.recordEvent(jobId, 'policy_overridden', { gate: code, level, action });
    } catch {
      // The override is already persisted; the ledger entry is advisory.
    }
  }
}
