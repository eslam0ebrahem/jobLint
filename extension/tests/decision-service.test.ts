import { describe, expect, it, vi } from 'vitest';
import { DecisionService } from '@/src/application/decision-service';
import type { DecisionRepository } from '@/src/application/decision-service';
import type { JobDecision } from '@/src/types/decisions';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job } from '@/src/types/job';
import type { PolicyConstraints, StoredPolicyOverride } from '@/src/types/policy';
import { normalizeDecision, MAX_COMPARISON_ROWS } from '@/src/domain/decisions';

const NOW = '2026-09-25T12:00:00.000Z';
const CONSTRAINTS: PolicyConstraints = {
  doNotApplyCompanies: [],
  doNotApplyDomains: [],
  authorizedRegions: ['Remote'],
  minimumCompensation: null,
  stalePostingDays: 45,
  minEvaluationConfidence: 0,
};

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    source: 'linkedin',
    title: `Role ${id}`,
    company: 'Acme',
    location: 'Remote',
    jobUrl: `https://www.linkedin.com/jobs/view/${id}`,
    column: 'to_apply',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createService(jobs: Job[]) {
  const store = new Map<string, JobDecision>();
  const repository: DecisionRepository = {
    getAll: async () => [...store.values()],
    getByJobId: async (jobId) => store.get(jobId),
    save: async (input) => {
      const record = normalizeDecision(input, { existing: store.get((input as { jobId: string }).jobId), timestamp: NOW });
      if (record) store.set(record.jobId, record);
      return record;
    },
    delete: async (jobId) => store.delete(jobId),
  };
  const service = new DecisionService(
    { get: async (id) => jobs.find((item) => item.id === id), list: async () => jobs },
    repository,
    { getAll: async () => [] as CandidateClaim[] },
    { getAll: async () => [] as StoredPolicyOverride[], getConstraints: async () => CONSTRAINTS },
    undefined,
    { changed: vi.fn() },
    () => NOW,
  );
  return { service, store };
}

describe('decision service', () => {
  it('stores both a rationale and a next action', async () => {
    const { service } = createService([job('job-1')]);
    const saved = await service.set('job-1', { state: 'shortlisted', rationale: 'Comp is competitive', nextAction: 'Send résumé' });
    expect(saved).toMatchObject({ state: 'shortlisted', rationale: 'Comp is competitive', nextAction: 'Send résumé' });
  });

  it('clears a decision so the job returns to the undecided state', async () => {
    const { service, store } = createService([job('job-1')]);
    await service.set('job-1', { state: 'shortlisted', nextAction: 'Send résumé' });
    expect(store.size).toBe(1);

    await expect(service.clear('job-1')).resolves.toBe(true);
    expect(store.size).toBe(0);
    const inbox = await service.inbox();
    expect(inbox.items.find((item) => item.jobId === 'job-1')?.state).toBe('new');
  });

  it('refuses to clear a decision that was never made', async () => {
    const { service } = createService([job('job-1')]);
    await expect(service.clear('job-1')).rejects.toThrow('No decision recorded');
  });

  it('rejects an unknown state instead of silently defaulting', async () => {
    const { service, store } = createService([job('job-1')]);
    await expect(service.set('job-1', { state: 'nope' })).rejects.toThrow('Unknown decision state');
    expect(store.size).toBe(0);
  });

  it('refuses a decision on a job that does not exist', async () => {
    const { service } = createService([job('job-1')]);
    await expect(service.set('missing', { state: 'shortlisted' })).rejects.toThrow('Job not found');
  });

  it('keeps a cleared field cleared instead of resurrecting the old value', async () => {
    const { service } = createService([job('job-1')]);
    await service.set('job-1', { state: 'deferred', rationale: 'Timing', nextAction: 'Revisit in Q1' });
    const updated = await service.set('job-1', { state: 'applied' });
    expect(updated).toMatchObject({ state: 'applied', rationale: 'Timing', nextAction: 'Revisit in Q1' });
  });

  it('requires at least two saved jobs to compare', async () => {
    const { service } = createService([job('job-1'), job('job-2')]);
    await expect(service.compare(['job-1'])).rejects.toThrow('at least two');
    await expect(service.compare(['job-1', 'job-1'])).rejects.toThrow('at least two');
    await expect(service.compare(['job-1', 'missing'])).rejects.toThrow('at least two saved jobs');
  });

  it('de-duplicates ids and caps the comparison size', async () => {
    const jobs = Array.from({ length: MAX_COMPARISON_ROWS + 3 }, (_, index) => job(`job-${index}`));
    const { service } = createService(jobs);
    const ids = [...jobs, jobs[0]!].map((item) => item.id);
    const comparison = await service.compare(ids);
    expect(comparison.rows).toHaveLength(MAX_COMPARISON_ROWS);
  });

  it('lists undecided jobs and any job that carries a decision', async () => {
    const { service } = createService([job('job-1'), job('job-2'), job('job-3')]);
    await service.set('job-2', { state: 'passed' });
    const inbox = await service.inbox();
    // job-1 and job-3 are undecided triage items; job-2 is listed because it
    // has an explicit decision. A deferred job with no record is not listed.
    expect(inbox.items.map((item) => item.jobId).sort()).toEqual(['job-1', 'job-2', 'job-3']);
    expect(inbox.items.find((item) => item.jobId === 'job-2')?.state).toBe('passed');
    expect(inbox.counts.new).toBe(2);
    expect(inbox.counts.passed).toBe(1);
  });

  it('notifies subscribers when a decision is written or cleared', async () => {
    const changed = vi.fn();
    const store = new Map<string, JobDecision>();
    const service = new DecisionService(
      { get: async () => job('job-1'), list: async () => [job('job-1')] },
      {
        getAll: async () => [...store.values()],
        getByJobId: async (jobId) => store.get(jobId),
        save: async (input) => {
          const record = normalizeDecision(input, { existing: store.get((input as { jobId: string }).jobId), timestamp: NOW });
          if (record) store.set(record.jobId, record);
          return record;
        },
        delete: async (jobId) => store.delete(jobId),
      },
      { getAll: async () => [] as CandidateClaim[] },
      { getAll: async () => [] as StoredPolicyOverride[], getConstraints: async () => CONSTRAINTS },
      undefined,
      { changed },
      () => NOW,
    );
    await service.set('job-1', { state: 'shortlisted' });
    await service.clear('job-1');
    expect(changed).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenNthCalledWith(1, 'job-1');
  });
});
