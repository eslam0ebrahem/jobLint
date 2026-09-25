import type { ApplicationOutcome } from '@/src/types/job';

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
