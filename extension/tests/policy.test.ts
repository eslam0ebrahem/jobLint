import { describe, expect, it } from 'vitest';
import { evaluatePolicy, hostMatches, normalizePolicyConstraints, reduceActionableLevel, reducePolicyLevel } from '@/src/domain/policy';
import type { Job } from '@/src/types/job';
import type { PolicyConstraints } from '@/src/types/policy';

const NOW = '2026-09-25T12:00:00.000Z';
const CONSTRAINTS: PolicyConstraints = {
  doNotApplyCompanies: ['Northstar Labs'],
  doNotApplyDomains: ['banned.example'],
  authorizedRegions: ['United States', 'Remote'],
  minimumCompensation: 120_000,
  stalePostingDays: 45,
  minEvaluationConfidence: 0.4,
};

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'linkedin',
    title: 'Senior React Engineer',
    company: 'Aurora Systems',
    location: 'United States',
    jobUrl: 'https://www.linkedin.com/jobs/view/1',
    column: 'to_apply',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function decisionFor(report: ReturnType<typeof evaluatePolicy>, code: string) {
  return report.decisions.find((item) => item.code === code);
}

describe('workflow policy gates', () => {
  it('matches hosts across subdomains and respects a leading wildcard', () => {
    expect(hostMatches('www.linkedin.com', 'linkedin.com')).toBe(true);
    expect(hostMatches('jobs.greenhouse.io', '*.greenhouse.io')).toBe(true);
    expect(hostMatches('notlinkedin.com', 'linkedin.com')).toBe(false);
    expect(hostMatches(undefined, 'linkedin.com')).toBe(false);
  });

  it('normalizes constraints and clamps hostile numbers', () => {
    const constraints = normalizePolicyConstraints({
      doNotApplyCompanies: ['  Acme  ', 'acme', ''],
      minimumCompensation: -5,
      stalePostingDays: 9_999,
      minEvaluationConfidence: 'high',
    });
    expect(constraints).toMatchObject({ doNotApplyCompanies: ['Acme'], minimumCompensation: null, stalePostingDays: 365 });
    expect(constraints.minEvaluationConfidence).toBe(0.4);
  });

  it('blocks a posting from an excluded company but lets the user override it explicitly', () => {
    const report = evaluatePolicy(job({ company: 'Northstar Labs' }), { constraints: CONSTRAINTS, now: NOW });
    expect(report.blocked).toBe(true);
    expect(report.level).toBe('block');
    expect(decisionFor(report, 'do_not_apply_company')).toMatchObject({ level: 'block', overridable: true, evidenceIds: ['job-company'] });

    const overridden = evaluatePolicy(job({ company: 'Northstar Labs' }), {
      constraints: CONSTRAINTS,
      now: NOW,
      overrides: (_jobId, code) =>
        code === 'do_not_apply_company' ? { at: NOW, level: 'caution', note: 'They contacted me first.' } : undefined,
    });
    expect(overridden.blocked).toBe(false);
    expect(overridden.level).toBe('caution');
    expect(overridden.overridden).toBe(1);
    expect(decisionFor(overridden, 'do_not_apply_company')).toMatchObject({ level: 'block', override: { level: 'caution' } });
  });

  it('blocks a posting whose apply link is on an excluded domain', () => {
    const report = evaluatePolicy(job({ jobUrl: 'https://boards.greenhouse.io/a', applyUrl: 'https://banned.example/apply' }), {
      constraints: CONSTRAINTS,
      now: NOW,
    });
    expect(decisionFor(report, 'do_not_apply_domain')).toMatchObject({ level: 'block' });
  });

  it('flags a posting that leaves the source host for an unknown destination', () => {
    const report = evaluatePolicy(job({ applyUrl: 'https://talent-sink.example/apply' }), { constraints: CONSTRAINTS, now: NOW });
    expect(decisionFor(report, 'apply_url_mismatch')).toMatchObject({ level: 'caution' });
    expect(decisionFor(report, 'untrusted_source')).toMatchObject({ level: 'pass' });

    const unknownHost = evaluatePolicy(job({ jobUrl: 'https://careers.random-blog.example/jobs/1' }), {
      constraints: CONSTRAINTS,
      now: NOW,
    });
    expect(decisionFor(unknownHost, 'untrusted_source')).toMatchObject({ level: 'caution' });
  });

  it('treats an unconfigured work-authorization gate as unknown, not as a pass', () => {
    const report = evaluatePolicy(job(), { constraints: { ...CONSTRAINTS, authorizedRegions: [] }, now: NOW });
    expect(decisionFor(report, 'work_authorization')).toMatchObject({ level: 'unknown' });
    expect(report.unresolved).toBeGreaterThan(0);
  });

  it('cautions when the posting location is outside the authorized regions', () => {
    const report = evaluatePolicy(job({ location: 'Berlin, Germany' }), { constraints: CONSTRAINTS, now: NOW });
    expect(decisionFor(report, 'work_authorization')).toMatchObject({ level: 'caution' });
  });

  it('blocks a captured deadline that has already passed', () => {
    const report = evaluatePolicy(
      job({
        facts: {
          version: 1,
          employmentType: 'full-time',
          workMode: 'remote',
          skills: [],
          benefits: [],
          qualifications: [],
          extractedAt: NOW,
          evidence: ['description'],
          deadline: { kind: 'application', date: '2026-09-01T00:00:00.000Z', raw: 'Sep 1', confidence: 0.9, source: 'description' },
        },
      }),
      { constraints: CONSTRAINTS, now: NOW },
    );
    expect(decisionFor(report, 'deadline_passed')).toMatchObject({ level: 'block' });
  });

  it('cautions on a stale posting and on compensation below the floor', () => {
    const stale = evaluatePolicy(
      job({
        facts: {
          version: 1,
          employmentType: 'full-time',
          workMode: 'remote',
          skills: [],
          benefits: [],
          qualifications: [],
          extractedAt: NOW,
          evidence: [],
          postedAt: '2026-06-01T00:00:00.000Z',
          compensation: { raw: '$90,000', currency: 'USD', max: 90_000, period: 'year' },
        },
      }),
      { constraints: CONSTRAINTS, now: NOW },
    );
    expect(decisionFor(stale, 'stale_posting')).toMatchObject({ level: 'caution' });
    expect(decisionFor(stale, 'compensation_below_floor')).toMatchObject({ level: 'caution' });
    expect(decisionFor(stale, 'posting_freshness_unknown')).toBeUndefined();
  });

  it('stays deterministic and never escalates an override above the original level', () => {
    const first = evaluatePolicy(job(), { constraints: CONSTRAINTS, now: NOW });
    const second = evaluatePolicy(job(), { constraints: CONSTRAINTS, now: NOW });
    expect(first).toEqual(second);
    expect(reducePolicyLevel(['pass', 'unknown', 'caution'])).toBe('caution');
    expect(reducePolicyLevel(['pass', 'unknown'])).toBe('unknown');
    expect(reduceActionableLevel(['pass', 'unknown', 'caution'])).toBe('caution');
    expect(reduceActionableLevel(['pass', 'unknown'])).toBe('pass');
    expect(reduceActionableLevel(['unknown'])).toBe('unknown');
  });

  it('keeps an unconfigured gate out of the headline but still reports it', () => {
    const report = evaluatePolicy(job(), { constraints: { ...CONSTRAINTS, authorizedRegions: [] }, now: NOW });
    expect(report.level).toBe('pass');
    // Work authorization is unconfigured and the posting has no captured publish date.
    expect(report.unresolved).toBe(2);
    expect(decisionFor(report, 'work_authorization')).toMatchObject({ level: 'unknown' });
  });
});
