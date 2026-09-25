import type {
  AiConfig,
  ApplicationEvent,
  ApplicationOutcome,
  Column,
  DetectedJob,
  Job,
  JobEvaluation,
  JobInsightSummary,
  NewJob,
  Profile,
  UserPreferences,
} from '@/src/types/job';
import { calculateJobInsights } from '@/src/domain/jobs';
import { isAutomaticAiEnhancementEnabled } from '@/src/domain/ai';
import { attributeEvaluationClaims } from '@/src/domain/claims';
import { diffPostings, type PostingDiff } from '@/src/domain/repost';
import type { CandidateClaim } from '@/src/types/claims';
import type { AiReviewer } from './ai-review';

export interface JobSaveOptions {
  creationEventType?: 'clipped' | 'imported';
  eventType?: 'evaluation_completed' | 're_evaluated' | 'imported';
  addCreationEvent?: boolean;
  overwriteWorkflow?: boolean;
}

export interface JobRepository {
  getActiveJobs(): Promise<Job[]>;
  getAllJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  findJobByIdentity(input: NewJob): Promise<Job | undefined>;
  saveJob(input: NewJob | Job, options?: JobSaveOptions): Promise<{ id: string; isNew: boolean; job: Job }>;
  updateJobColumn(id: string, column: Column): Promise<Job | undefined>;
  updateJobNotes(id: string, notes: string): Promise<Job | undefined>;
  updateJobEvaluation(
    id: string,
    evaluation: Job['evaluation'],
    eventType?: 'evaluation_completed' | 're_evaluated',
  ): Promise<Job | undefined>;
  recordOutcome(id: string, outcome: ApplicationOutcome): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  getEvents(jobId?: string): Promise<ApplicationEvent[]>;
  saveEvents(events: ApplicationEvent[]): Promise<ApplicationEvent[]>;
}

/** Narrow gateway the evidence services use to append to the transition ledger. */
export interface JobEventRecorder {
  recordEvent(jobId: string, type: ApplicationEvent['type'], metadata?: ApplicationEvent['metadata']): Promise<ApplicationEvent>;
}

export interface JobSettingsReader {
  getProfile(): Promise<Profile>;
  getPreferences(): Promise<UserPreferences>;
}

export interface AiConfigReader {
  getConfig(): Promise<AiConfig>;
}

export type LocalJobEvaluator = (
  job: DetectedJob,
  profile?: Profile,
  preferences?: UserPreferences,
) => JobEvaluation;

export interface JobEvents {
  changed(reason: string, job?: Job): void;
}

/** Optional claim ledger, used only to attribute evidence to specific claims. */
export interface JobClaimReader {
  getAll(): Promise<CandidateClaim[]>;
}

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly settings: JobSettingsReader,
    private readonly aiConfigs: AiConfigReader,
    private readonly evaluate: LocalJobEvaluator,
    private readonly aiReviewer: AiReviewer,
    private readonly events: JobEvents,
    private readonly claims?: JobClaimReader,
  ) {}

  list(includeDiscarded = false): Promise<Job[]> {
    return includeDiscarded ? this.repository.getAllJobs() : this.repository.getActiveJobs();
  }

  get(id: string): Promise<Job | undefined> {
    return this.repository.getJob(id);
  }

  async checkSaved(job: DetectedJob): Promise<{ isSaved: boolean; job?: Job }> {
    const existing = await this.repository.findJobByIdentity(job);
    return { isSaved: Boolean(existing), job: existing };
  }

  async clip(job: DetectedJob): Promise<{ job: Job; isNew: boolean; aiEnhanced: boolean }> {
    const [profile, preferences] = await Promise.all([
      this.settings.getProfile(),
      this.settings.getPreferences(),
    ]);
    let evaluation = this.evaluate(job, profile, preferences);
    if (isAutomaticAiEnhancementEnabled(preferences, await this.aiConfigs.getConfig())) {
      evaluation = await this.aiReviewer.review(job, evaluation, profile);
    }
    evaluation = await this.withClaimProvenance(evaluation);
    // Captured before the write so the stored text can be compared to the new one.
    const previous = await this.repository.findJobByIdentity(job);
    const result = await this.repository.saveJob({ ...job, evaluation, column: 'to_apply', status: 'active' });
    if (previous) await this.recordRepost(previous, job, result.id);
    this.events.changed('job-clipped', result.job);
    return { job: result.job, isNew: result.isNew, aiEnhanced: evaluation?.aiEnhanced === true };
  }

  /**
   * Adds claim provenance to a finished report. Never changes a score, and
   * fails open so a ledger problem can never block an evaluation.
   */
  private async withClaimProvenance(evaluation: JobEvaluation): Promise<JobEvaluation> {
    if (!this.claims) return evaluation;
    try {
      return attributeEvaluationClaims(evaluation, await this.claims.getAll());
    } catch {
      return evaluation;
    }
  }

  /** Records a repost when re-clipping a posting whose captured text changed. */
  private async recordRepost(previous: Job, next: DetectedJob, jobId: string): Promise<PostingDiff | undefined> {
    const diff = diffPostings(previous, next);
    if (!diff.changed) return undefined;
    try {
      await this.repository.saveEvents([{
        id: `event-${crypto.randomUUID()}`,
        jobId,
        type: 'repost_detected',
        at: new Date().toISOString(),
        metadata: {
          fields: diff.fields.map((change) => change.field).join(','),
          contentChanged: diff.contentChanged,
          summary: diff.summary,
        },
      }]);
    } catch {
      // A missed audit entry must never fail the clip itself.
    }
    return diff;
  }

  async save(job: DetectedJob): Promise<Job> {
    const result = await this.repository.saveJob(job);
    this.events.changed('job-saved', result.job);
    return result.job;
  }

  async saveFromDiscovery(job: DetectedJob): Promise<{ job: Job; isNew: boolean }> {
    const result = await this.repository.saveJob({ ...job, column: 'to_apply', status: 'active' });
    this.events.changed('discovery-saved-as-job', result.job);
    return { job: result.job, isNew: result.isNew };
  }

  async move(id: string, column: Column): Promise<Job | undefined> {
    const job = await this.repository.updateJobColumn(id, column);
    if (job) this.events.changed('job-moved', job);
    return job;
  }

  async updateNotes(id: string, notes: string): Promise<Job | undefined> {
    const job = await this.repository.updateJobNotes(id, notes);
    if (job) this.events.changed('job-notes-updated', job);
    return job;
  }

  async delete(id: string): Promise<true> {
    await this.repository.deleteJob(id);
    this.events.changed('job-deleted');
    return true;
  }

  async recordOutcome(id: string, outcome: ApplicationOutcome): Promise<Job | undefined> {
    const job = await this.repository.recordOutcome(id, outcome);
    if (job) this.events.changed('job-outcome-updated', job);
    return job;
  }

  /**
   * Follow-up activity still touches the job record so `updatedAt` moves and
   * an open details drawer refetches. Use `recordEvent` for pure ledger appends.
   */
  async addActivity(
    jobId: string,
    type: Extract<ApplicationEvent['type'], `follow_up_${string}`>,
    metadata?: ApplicationEvent['metadata'],
  ): Promise<void> {
    const job = await this.repository.getJob(jobId);
    if (!job) throw new Error('Job not found.');
    const updated = await this.repository.saveJob(job, { addCreationEvent: false });
    await this.repository.saveEvents([{
      id: `event-${crypto.randomUUID()}`,
      jobId,
      type,
      at: new Date().toISOString(),
      metadata,
    }]);
    this.events.changed('job-activity-added', updated.job);
  }

  /**
   * Appends one entry to a job's transition ledger. Deliberately silent on the
   * job channel: a ledger entry is not a job mutation, and the caller already
   * broadcasts its own narrower event (dossiers/decisions/policy-changed).
   */
  async recordEvent(
    jobId: string,
    type: ApplicationEvent['type'],
    metadata?: ApplicationEvent['metadata'],
  ): Promise<ApplicationEvent> {
    const job = await this.repository.getJob(jobId);
    if (!job) throw new Error('Job not found.');
    const [saved] = await this.repository.saveEvents([{
      id: `event-${crypto.randomUUID()}`,
      jobId,
      type,
      at: new Date().toISOString(),
      metadata,
    }]);
    if (!saved) throw new Error('Could not append to the activity log.');
    return saved;
  }

  async evaluateJob(
    id: string | undefined,
    input: DetectedJob | undefined,
    enhanceAi: boolean,
  ): Promise<Job> {
    const job = id ? await this.repository.getJob(id) : input;
    if (!job) throw new Error('Job not found.');
    const [profile, preferences] = await Promise.all([
      this.settings.getProfile(),
      this.settings.getPreferences(),
    ]);
    let evaluation = this.evaluate(job, profile, preferences);
    if (enhanceAi) evaluation = await this.aiReviewer.review(job, evaluation, profile);
    evaluation = await this.withClaimProvenance(evaluation);
    const updated = id
      ? await this.repository.updateJobEvaluation(id, evaluation, job.evaluation ? 're_evaluated' : 'evaluation_completed')
      : (await this.repository.saveJob({ ...job, evaluation }, { eventType: 'evaluation_completed' })).job;
    if (!updated) throw new Error('Job not found.');
    this.events.changed('job-evaluated', updated);
    return updated;
  }

  getEvents(jobId?: string): Promise<ApplicationEvent[]> {
    return this.repository.getEvents(jobId);
  }

  async getInsights(): Promise<JobInsightSummary> {
    return calculateJobInsights(await this.repository.getActiveJobs());
  }
}
