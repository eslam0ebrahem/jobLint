import { describe, expect, it } from 'vitest';
import { calculateJobInsights, normalizeJob } from '@/src/domain/jobs';
import { evaluateJob } from '@/src/lib/evaluation';

const normalizeOptions = {
  timestamp: '2026-01-01T00:00:00.000Z',
  createId: (prefix: string) => `${prefix}-fixed`,
};

describe('job domain policies', () => {
  it('normalizes malformed persisted fields without browser dependencies', () => {
    const job = normalizeJob({
      source: 'other',
      title: '  ',
      company: '',
      jobUrl: 'javascript:alert(1)',
      column: 'invalid' as never,
      status: 'invalid' as never,
    }, normalizeOptions);

    expect(job).toMatchObject({
      id: 'job-fixed',
      source: 'other',
      title: 'Untitled job',
      company: 'Unknown company',
      column: 'to_apply',
      status: 'active',
      clippedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(job.jobUrl).toBeUndefined();
    expect(job.identity?.source).toBe('other');
  });

  it('calculates active-job aggregates as a pure policy', () => {
    const base = normalizeJob({
      source: 'manual',
      title: 'React Engineer',
      company: 'Acme',
      description: 'React, TypeScript, Node.js, AWS, PostgreSQL role.',
    }, normalizeOptions);
    const evaluation = evaluateJob(base, { roles: 'React Engineer', skills: 'React, TypeScript' });
    const summary = calculateJobInsights([
      { ...base, column: 'applied', outcome: 'interview', evaluation },
      normalizeJob({ source: 'linkedin', title: 'Platform Engineer', company: 'Example' }, {
        ...normalizeOptions,
        createId: () => 'job-second',
      }),
    ]);

    expect(summary).toMatchObject({
      totalJobs: 2,
      activeJobs: 2,
      evaluatedJobs: 1,
      stageCounts: { to_apply: 1, applied: 1, assessment: 0, interviewing: 0, offer: 0, rejected: 0 },
      outcomeCounts: { interview: 1 },
      sourceCounts: { manual: 1, linkedin: 1 },
    });
    expect(summary.averageFit).toBe(evaluation.fitScore);
    expect(summary.averageOpportunity).toBe(evaluation.opportunityScore);
    expect(summary.averageSafety).toBe(evaluation.safetyScore);
  });
});
