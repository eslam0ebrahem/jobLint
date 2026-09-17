export type JobSource = 'linkedin' | 'indeed' | 'manual' | 'other';

export type Column =
  | 'to_apply'
  | 'applied'
  | 'assessment'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export type JobStatus = 'active' | 'discarded';

export interface DetectedJob {
  source: JobSource;
  jobId?: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  requirements?: string;
  description?: string;
  applyUrl?: string;
  jobUrl?: string;
}

export interface DetectionResult {
  job: DetectedJob;
}

export interface Job extends DetectedJob {
  id: string;
  column: Column;
  status: JobStatus;
  notes?: string;
  clippedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type NewJob = Omit<
  Job,
  'id' | 'clippedAt' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
};
