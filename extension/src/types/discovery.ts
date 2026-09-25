import type { DetectedJob, Job, JobEvaluation, JobIdentity } from '@/src/types/job';

export type DiscoveryStatus = 'new' | 'saved' | 'dismissed';

export interface DiscoveryRecord {
  id: string;
  identity: JobIdentity;
  job: DetectedJob;
  evaluation?: JobEvaluation;
  status: DiscoveryStatus;
  capturedAt: string;
  updatedAt: string;
  savedJobId?: string;
}

export interface DiscoveryInboxSnapshot {
  items: DiscoveryRecord[];
  newCount: number;
  savedCount: number;
  dismissedCount: number;
  scannedAt?: string;
  detectedCount: number;
  addedCount: number;
  refreshedCount: number;
}

export interface DiscoverySaveResult {
  record: DiscoveryRecord;
  job: Job;
  isNew: boolean;
}
