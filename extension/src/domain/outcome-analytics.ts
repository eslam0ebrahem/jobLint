import type { ApplicationOutcome, Job } from '@/src/types/job';
import type { AnalyticsStatus, EvaluatorCalibration, OutcomeAnalytics, OutcomeCalibrationBucket } from '@/src/types/analytics';

export const MINIMUM_CALIBRATION_SAMPLES = 20;
const POSITIVE_OUTCOMES = new Set<ApplicationOutcome>(['interview', 'offer']);
const NEGATIVE_OUTCOMES = new Set<ApplicationOutcome>(['not_interested', 'rejected', 'withdrawn']);
const BUCKETS = [
  { id: 'low', label: '1.0–1.9', minScore: 1, maxScore: 1.9, predictedPositiveRate: 0.15 },
  { id: 'guarded', label: '2.0–2.9', minScore: 2, maxScore: 2.9, predictedPositiveRate: 0.3 },
  { id: 'middle', label: '3.0–3.9', minScore: 3, maxScore: 3.9, predictedPositiveRate: 0.55 },
  { id: 'strong', label: '4.0–5.0', minScore: 4, maxScore: 5, predictedPositiveRate: 0.8 },
];

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function positive(outcome: ApplicationOutcome | undefined): boolean | undefined {
  if (!outcome) return undefined;
  if (POSITIVE_OUTCOMES.has(outcome)) return true;
  if (NEGATIVE_OUTCOMES.has(outcome)) return false;
  return undefined;
}

function validSnapshot(job: Job): { score: number; positive: boolean } | undefined {
  if (!job.outcome || !job.outcomeSnapshot) return undefined;
  const score = Number(job.outcomeSnapshot.score);
  if (!Number.isFinite(score) || score < 1 || score > 5) return undefined;
  const outcome = positive(job.outcome);
  return outcome === undefined ? undefined : { score, positive: outcome };
}

function calibrationMessage(status: AnalyticsStatus, sampleSize: number, positiveCount: number, negativeCount: number): string {
  if (status === 'insufficient-data') return `Collect at least ${MINIMUM_CALIBRATION_SAMPLES} completed outcomes before treating calibration as directional evidence.`;
  if (!positiveCount || !negativeCount) return 'Calibration is available, but the current sample lacks both positive and negative outcomes; treat it as provisional.';
  return 'Calibration is based on locally recorded outcomes and is advisory only; the deterministic evaluator is not silently changed.';
}

function buildCalibration(jobs: Job[]): EvaluatorCalibration {
  const samples = jobs.map(validSnapshot).filter((sample): sample is { score: number; positive: boolean } => Boolean(sample));
  const sampleSize = samples.length;
  const status: AnalyticsStatus = sampleSize >= MINIMUM_CALIBRATION_SAMPLES ? 'ready' : 'insufficient-data';
  const positiveCount = samples.filter((sample) => sample.positive).length;
  const negativeCount = sampleSize - positiveCount;
  const buckets: OutcomeCalibrationBucket[] = BUCKETS.map((bucket) => {
    const matching = samples.filter((sample) => sample.score >= bucket.minScore && sample.score <= bucket.maxScore);
    return {
      id: bucket.id,
      label: bucket.label,
      minScore: bucket.minScore,
      maxScore: bucket.maxScore,
      samples: matching.length,
      positiveOutcomes: matching.filter((sample) => sample.positive).length,
      observedPositiveRate: matching.length && status === 'ready' ? round(matching.filter((sample) => sample.positive).length / matching.length) : null,
      averageScore: matching.length ? round(matching.reduce((sum, sample) => sum + sample.score, 0) / matching.length) : null,
      predictedPositiveRate: bucket.predictedPositiveRate,
    };
  });
  const meanPredicted = sampleSize ? samples.reduce((sum, sample) => {
    const bucket = BUCKETS.find((item) => sample.score >= item.minScore && sample.score <= item.maxScore);
    return sum + (bucket?.predictedPositiveRate || 0.5);
  }, 0) / sampleSize : null;
  const observedPositiveRate = sampleSize && status === 'ready' ? round(positiveCount / sampleSize) : null;
  const brierScore = status === 'ready' && sampleSize ? round(samples.reduce((sum, sample) => {
    const bucket = BUCKETS.find((item) => sample.score >= item.minScore && sample.score <= item.maxScore);
    const predicted = bucket?.predictedPositiveRate || 0.5;
    return sum + ((predicted - (sample.positive ? 1 : 0)) ** 2);
  }, 0) / sampleSize, 3) : null;
  const suggestedScoreAdjustment = status === 'ready' && meanPredicted !== null && observedPositiveRate !== null
    ? round(Math.max(-0.3, Math.min(0.3, (observedPositiveRate - meanPredicted) * 2)), 2)
    : null;
  return {
    status,
    minimumSampleSize: MINIMUM_CALIBRATION_SAMPLES,
    sampleSize,
    buckets,
    brierScore,
    meanPredictedPositiveRate: meanPredicted === null ? null : round(meanPredicted),
    observedPositiveRate,
    suggestedScoreAdjustment,
    message: calibrationMessage(status, sampleSize, positiveCount, negativeCount),
  };
}

export function calculateOutcomeAnalytics(jobs: Job[], generatedAt = new Date().toISOString()): OutcomeAnalytics {
  const outcomeCounts: Partial<Record<ApplicationOutcome, number>> = {};
  const scoreTotals = new Map<ApplicationOutcome, { total: number; count: number }>();
  let scoreTotal = 0;
  let scoreCount = 0;
  for (const job of jobs) {
    if (job.outcome) {
      outcomeCounts[job.outcome] = (outcomeCounts[job.outcome] || 0) + 1;
      const score = job.outcomeSnapshot?.score;
      if (typeof score === 'number' && Number.isFinite(score)) {
        scoreTotal += score;
        scoreCount += 1;
        const aggregate = scoreTotals.get(job.outcome) || { total: 0, count: 0 };
        aggregate.total += score;
        aggregate.count += 1;
        scoreTotals.set(job.outcome, aggregate);
      }
    }
  }
  const positiveOutcomeCount = [...POSITIVE_OUTCOMES].reduce((sum, outcome) => sum + (outcomeCounts[outcome] || 0), 0);
  const negativeOutcomeCount = [...NEGATIVE_OUTCOMES].reduce((sum, outcome) => sum + (outcomeCounts[outcome] || 0), 0);
  const jobsWithOutcome = Object.values(outcomeCounts).reduce((sum, count) => sum + (count || 0), 0);
  return {
    generatedAt,
    totalJobs: jobs.length,
    jobsWithOutcome,
    outcomeCounts,
    positiveOutcomeCount,
    negativeOutcomeCount,
    pendingOutcomeCount: jobs.length - jobsWithOutcome,
    averageScoreWithOutcome: scoreCount ? round(scoreTotal / scoreCount) : null,
    scoreByOutcome: Object.fromEntries([...scoreTotals.entries()].map(([outcome, aggregate]) => [outcome, round(aggregate.total / aggregate.count)])),
    calibration: buildCalibration(jobs),
  };
}
