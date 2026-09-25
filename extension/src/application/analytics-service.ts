import { calculateOutcomeAnalytics } from '@/src/domain/outcome-analytics';
import { calculateFunnelAnalytics } from '@/src/domain/funnel-analytics';
import type { FunnelAnalytics, OutcomeAnalytics } from '@/src/types/analytics';
import type { ApplicationEvent, FollowUp, Job } from '@/src/types/job';

export interface AnalyticsJobReader {
  getAllJobs(): Promise<Job[]>;
  getEvents(jobId?: string): Promise<ApplicationEvent[]>;
}

export interface AnalyticsFollowUpReader {
  getAll(jobId?: string): Promise<FollowUp[]>;
}

export class OutcomeAnalyticsService {
  constructor(
    private readonly jobs: AnalyticsJobReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly followUps?: AnalyticsFollowUpReader,
  ) {}

  async getSnapshot(): Promise<OutcomeAnalytics> {
    return calculateOutcomeAnalytics(await this.jobs.getAllJobs(), this.now());
  }

  async getFunnelSnapshot(): Promise<FunnelAnalytics> {
    const [jobs, events, followUps] = await Promise.all([
      this.jobs.getAllJobs(),
      this.jobs.getEvents(),
      this.followUps?.getAll(),
    ]);
    return calculateFunnelAnalytics({ jobs, events, followUps: followUps || [] }, this.now());
  }
}
