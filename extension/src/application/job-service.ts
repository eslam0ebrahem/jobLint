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

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly settings: JobSettingsReader,
    private readonly aiConfigs: AiConfigReader,
    private readonly evaluate: LocalJobEvaluator,
    private readonly aiReviewer: AiReviewer,
    private readonly events: JobEvents,
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
    const result = await this.repository.saveJob({ ...job, evaluation, column: 'to_apply', status: 'active' });
    this.events.changed('job-clipped', result.job);
    return { job: result.job, isNew: result.isNew, aiEnhanced: evaluation?.aiEnhanced === true };
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
