import { calculateOutcomeAnalytics } from '@/src/domain/outcome-analytics';
import type { OutcomeAnalytics } from '@/src/types/analytics';
import type { Job } from '@/src/types/job';

export interface AnalyticsJobReader {
  getAllJobs(): Promise<Job[]>;
}

export class OutcomeAnalyticsService {
  constructor(
    private readonly jobs: AnalyticsJobReader,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getSnapshot(): Promise<OutcomeAnalytics> {
    return calculateOutcomeAnalytics(await this.jobs.getAllJobs(), this.now());
  }
}
