import { describe, expect, it } from 'vitest';
import { calculateOutcomeAnalytics, MINIMUM_CALIBRATION_SAMPLES } from '@/src/domain/outcome-analytics';
import type { ApplicationOutcome, Job } from '@/src/types/job';

function job(index: number, outcome: ApplicationOutcome, score: number): Job {
  return { id: `job-${index}`, source: 'manual', title: `Engineer ${index}`, company: 'Acme', column: 'applied', status: 'active', clippedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', outcome, outcomeSnapshot: { score, verdict: score >= 4 ? 'Apply' : 'Caution', evaluator: 'heuristic', createdAt: '2026-01-01T00:00:00.000Z' } };
}

describe('outcome analytics and calibration', () => {
  it('suppresses calibration claims until the minimum sample is reached', () => {
    const small = calculateOutcomeAnalytics(Array.from({ length: MINIMUM_CALIBRATION_SAMPLES - 1 }, (_, index) => job(index, index % 2 ? 'rejected' : 'offer', 3)), '2026-09-25T00:00:00.000Z');
    expect(small.calibration.status).toBe('insufficient-data');
    expect(small.calibration.observedPositiveRate).toBeNull();
    expect(small.calibration.suggestedScoreAdjustment).toBeNull();
    expect(small.calibration.buckets.every((bucket) => bucket.observedPositiveRate === null)).toBe(true);
  });

  it('aggregates outcomes and exposes advisory calibration only after a sufficient sample', () => {
    const jobs = Array.from({ length: MINIMUM_CALIBRATION_SAMPLES }, (_, index) => job(index, index % 2 ? 'rejected' : 'offer', index % 3 === 0 ? 4 : 2));
    const analytics = calculateOutcomeAnalytics(jobs, '2026-09-25T00:00:00.000Z');
    expect(analytics.jobsWithOutcome).toBe(MINIMUM_CALIBRATION_SAMPLES);
    expect(analytics.positiveOutcomeCount).toBe(MINIMUM_CALIBRATION_SAMPLES / 2);
    expect(analytics.negativeOutcomeCount).toBe(MINIMUM_CALIBRATION_SAMPLES / 2);
    expect(analytics.calibration.status).toBe('ready');
    expect(analytics.calibration.sampleSize).toBe(MINIMUM_CALIBRATION_SAMPLES);
    expect(analytics.calibration.suggestedScoreAdjustment).not.toBeNull();
    expect(analytics.calibration.message).toContain('not silently changed');
  });
});
