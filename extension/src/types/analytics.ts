import type { ApplicationOutcome, Column, JobSource } from '@/src/types/job';

export type AnalyticsStatus = 'insufficient-data' | 'ready';

export interface OutcomeCalibrationBucket {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  samples: number;
  positiveOutcomes: number;
  observedPositiveRate: number | null;
  averageScore: number | null;
  predictedPositiveRate: number;
}

export interface EvaluatorCalibration {
  status: AnalyticsStatus;
  minimumSampleSize: number;
  sampleSize: number;
  buckets: OutcomeCalibrationBucket[];
  brierScore: number | null;
  meanPredictedPositiveRate: number | null;
  observedPositiveRate: number | null;
  suggestedScoreAdjustment: number | null;
  message: string;
}

export interface OutcomeAnalytics {
  generatedAt: string;
  totalJobs: number;
  jobsWithOutcome: number;
  outcomeCounts: Partial<Record<ApplicationOutcome, number>>;
  positiveOutcomeCount: number;
  negativeOutcomeCount: number;
  pendingOutcomeCount: number;
  averageScoreWithOutcome: number | null;
  scoreByOutcome: Partial<Record<ApplicationOutcome, number>>;
  calibration: EvaluatorCalibration;
}

export interface FunnelStage {
  id: string;
  label: string;
  columns: Column[];
  count: number;
}

export interface ChannelYield {
  channel: JobSource | 'unknown';
  clipped: number;
  applied: number;
  responseCount: number;
  interviewCount: number;
  offerCount: number;
  rejectedCount: number;
  inFlight: number;
  /** Response, interview, and offer rates over decided applications only. */
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
}

export interface FunnelTiming {
  samples: number;
  medianDaysToApply: number | null;
  medianDaysToResponse: number | null;
  medianDaysToOffer: number | null;
  p90DaysToApply: number | null;
}

export interface FollowUpAnalytics {
  total: number;
  open: number;
  completed: number;
  /** Follow-ups on jobs that later advanced past `to_apply`. */
  followedUpAndAdvanced: number;
  advancedRate: number | null;
}

export interface FunnelAnalytics {
  version: 1;
  generatedAt: string;
  status: AnalyticsStatus;
  minimumSampleSize: number;
  /** Applications that reached at least `applied`; in-flight jobs are excluded. */
  sampleSize: number;
  stages: FunnelStage[];
  channels: ChannelYield[];
  timing: FunnelTiming;
  followUps: FollowUpAnalytics;
  inFlight: number;
  inFlightNote: string;
  message: string;
}
