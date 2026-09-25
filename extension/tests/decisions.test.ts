import { describe, expect, it } from 'vitest';
import { buildComparisonRow, compareJobs, isDecisionState, normalizeDecision } from '@/src/domain/decisions';
import { evaluatePolicy } from '@/src/domain/policy';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job } from '@/src/types/job';
import type { PolicyReport } from '@/src/types/policy';

const NOW = '2026-09-25T12:00:00.000Z';

const claim: CandidateClaim = {
  version: 1,
  id: 'claim-react',
  kind: 'skill',
  label: 'React',
  status: 'verified',
  source: 'resume',
  createdAt: NOW,
  updatedAt: NOW,
  verifiedAt: NOW,
};

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    source: 'linkedin',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    jobUrl: `https://www.linkedin.com/jobs/view/${id}`,
    column: 'to_apply',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    facts: {
      version: 1,
      employmentType: 'full-time',
      workMode: 'remote',
      skills: ['React', 'Rust'],
      benefits: [],
      qualifications: [],
      extractedAt: NOW,
      evidence: [],
      postedAt: '2026-09-01T00:00:00.000Z',
      compensation: { raw: '$150,000', currency: 'USD', max: 150_000, period: 'year' },
    },
    ...overrides,
  };
}

describe('decision records and shortlist comparison', () => {
  it('normalizes a decision and keeps the original creation time', () => {
    const first = normalizeDecision({ jobId: 'job-1', state: 'shortlisted' }, { timestamp: NOW });
    expect(first).toMatchObject({ version: 1, id: 'job-1', state: 'shortlisted', createdAt: NOW });
    const second = normalizeDecision({ jobId: 'job-1', state: 'nope', rationale: 'Good team' }, { existing: first, timestamp: '2026-10-01T00:00:00.000Z' });
    expect(second).toMatchObject({ state: 'shortlisted', rationale: 'Good team', createdAt: NOW, updatedAt: '2026-10-01T00:00:00.000Z' });
    expect(normalizeDecision({}, { timestamp: NOW })).toBeUndefined();
    expect(isDecisionState('revisit')).toBe(true);
    expect(isDecisionState('archived')).toBe(false);
  });

  it('summarizes score, coverage, compensation, freshness, and gates into one row', () => {
    const policy = evaluatePolicy(job('job-1'), { now: NOW });
    const row = buildComparisonRow(job('job-1', { evaluation: undefined }), [claim], policy, undefined, NOW);
    expect(row).toMatchObject({
      jobId: 'job-1',
      score: null,
      policyLevel: 'pass',
      policyBlocked: false,
      coveredRequirements: 1,
      totalRequirements: 2,
      compensationMax: 150_000,
      postingAgeDays: 24,
      decisionState: 'new',
    });
    expect(row.gapRequirements).toEqual(['Rust']);
    // An unconfigured gate is surfaced so the user knows a check never ran.
    expect(row.policyIssues).toEqual(['Work authorization']);
  });

  it('recommends the strongest posting but never one that a gate blocks', () => {
    const strong = job('strong', { title: 'Strong', evaluation: { score: 4.9 } as never });
    const weak = job('weak', { title: 'Weak', evaluation: { score: 2.1 } as never });
    const comparison = compareJobs([weak, strong], { claims: [claim], now: NOW });
    expect(comparison.recommendedJobId).toBe('strong');
    expect(comparison.basis.join(' ')).toContain('Highest local score');
    expect(comparison.rows).toHaveLength(2);

    const constraints = { doNotApplyCompanies: ['Blocked Co'], doNotApplyDomains: [], authorizedRegions: [], minimumCompensation: null, stalePostingDays: 45, minEvaluationConfidence: 0 };
    const blockedPolicy = evaluatePolicy(job('strong', { company: 'Blocked Co' }), { constraints, now: NOW });
    const blocked = compareJobs([strong, weak], { claims: [claim], policies: new Map([['strong', blockedPolicy]]), now: NOW });
    expect(blocked.recommendedJobId).toBe('weak');
    expect(blocked.rows.find((row) => row.jobId === 'strong')).toMatchObject({ policyBlocked: true });
    expect(blocked.rows.find((row) => row.jobId === 'strong')?.policyIssues).toContain('Excluded company');

    const allBlocked = compareJobs([strong, job('strong2', { company: 'Blocked Co' })], {
      claims: [claim],
      policies: new Map([['strong', blockedPolicy], ['strong2', blockedPolicy]]),
      now: NOW,
    });
    expect(allBlocked.recommendedJobId).toBeUndefined();
    expect(allBlocked.basis.join(' ')).toContain('blocked by a policy gate');
  });

  it('breaks score ties on claim coverage and stays deterministic', () => {
    const base = job('base');
    const covered = job('covered', {
      title: 'Covered',
      evaluation: { score: 4 } as never,
      facts: { ...base.facts!, skills: ['React'] },
    });
    const bare = job('bare', { title: 'Bare', evaluation: { score: 4 } as never });
    expect(covered.facts?.skills).toHaveLength(1);
    expect(bare.facts?.skills).toHaveLength(2);
    const first = compareJobs([bare, covered], { claims: [claim], now: NOW });
    const second = compareJobs([covered, bare], { claims: [claim], now: NOW });
    expect(first.recommendedJobId).toBe('covered');
    expect(second.recommendedJobId).toBe('covered');
    expect(first.rows.map((row) => row.jobId)).not.toEqual(second.rows.map((row) => row.jobId));
  });

  it('keeps a configured gate out of the issues list when it passes', () => {
    const constraints = { doNotApplyCompanies: [], doNotApplyDomains: [], authorizedRegions: ['Remote'], minimumCompensation: null, stalePostingDays: 45, minEvaluationConfidence: 0 };
    const policy = evaluatePolicy(job('job-1'), { constraints, now: NOW }) as PolicyReport;
    const row = buildComparisonRow(job('job-1'), [], policy, undefined, NOW);
    expect(row.policyLevel).toBe('pass');
    expect(row.policyIssues).toEqual([]);
  });
});
