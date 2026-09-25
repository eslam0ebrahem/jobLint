import { describe, expect, it, vi } from 'vitest';
import { JobService } from '@/src/application/job-service';
import { SettingsService } from '@/src/application/settings-service';
import { claimRepository } from '@/src/infrastructure/database/claim-repository';
import { jobRepository } from '@/src/infrastructure/database/job-repository';
import { browserSettingsRepository } from '@/src/infrastructure/settings/browser-settings-repository';
import { evaluateJob } from '@/src/lib/evaluation';
import type { AiReviewer } from '@/src/application/ai-review';
import type { DetectedJob } from '@/src/types/job';

const posting: DetectedJob = {
  source: 'linkedin',
  jobId: 'repost-1',
  title: 'Senior React Engineer',
  company: 'Northstar Labs',
  location: 'Remote',
  description: 'Build React and TypeScript products with GraphQL. 5+ years of experience.',
  jobUrl: 'https://www.linkedin.com/jobs/view/repost-1',
};

const noAi: AiReviewer = {
  review: async (_job, fallback) => fallback,
};

function createService(withClaims = true) {
  const settings = new SettingsService(browserSettingsRepository);
  const changed = vi.fn();
  const service = new JobService(
    jobRepository,
    settings,
    { getConfig: async () => ({ enabled: false, autoEnhance: false, provider: 'openai', baseUrl: '', apiKey: '', model: '', timeoutMs: 1_000 }) },
    evaluateJob,
    noAi,
    { changed },
    withClaims ? claimRepository : undefined,
  );
  return { service, settings, changed };
}

describe('clip-time provenance and repost detection', () => {
  it('attributes the fresh evaluation to the claim ledger on first clip', async () => {
    const { service, settings } = createService();
    await settings.saveProfile({ roles: 'React Engineer', skills: 'React, TypeScript, GraphQL' });
    await claimRepository.save({ kind: 'skill', label: 'React', status: 'verified', source: 'resume' });

    const { job } = await service.clip(posting);
    const coverage = job.evaluation?.evidence.find((item) => item.id === 'claims');
    expect(coverage).toMatchObject({ category: 'profile', support: 'verified' });
    expect(job.evaluation?.evidence.find((item) => item.id === 'skills')?.claimIds).toHaveLength(1);
    expect(await jobRepository.getEvents(job.id)).toHaveLength(1);
  });

  it('works without a claim ledger attached, adding no coverage signal', async () => {
    const { service } = createService(false);
    const { job } = await service.clip({ ...posting, jobId: 'no-claims-1' });
    expect(job.evaluation?.evidence.some((item) => item.id === 'claims')).toBe(false);
  });

  it('records a repost when the same posting is re-clipped with different text', async () => {
    const { service, changed } = createService();
    const first = await service.clip(posting);
    expect(first.isNew).toBe(true);

    const second = await service.clip({ ...posting, description: `${posting.description} This role is now on-call.` });
    expect(second.isNew).toBe(false);
    expect(second.job.id).toBe(first.job.id);

    const events = await jobRepository.getEvents(first.job.id);
    const reposts = events.filter((event) => event.type === 'repost_detected');
    expect(reposts).toHaveLength(1);
    expect(reposts[0]?.metadata).toMatchObject({ fields: 'description', contentChanged: true });
    expect(reposts[0]?.metadata?.summary).toContain('description:');
    // The first clip still has exactly one creation event.
    expect(events.filter((event) => event.type === 'clipped')).toHaveLength(1);
    expect(changed).toHaveBeenCalled();
  });

  it('stays silent when a re-clip brings identical text', async () => {
    const { service } = createService();
    await service.clip(posting);
    await service.clip({ ...posting, description: `  ${posting.description}  ` });
    const events = await jobRepository.getEvents('linkedin-repost-1');
    expect(events.some((event) => event.type === 'repost_detected')).toBe(false);
  });

  it('recomputes the evaluation from the new text rather than keeping the stale one', async () => {
    const { service } = createService();
    const first = await service.clip(posting);
    const before = first.job.evaluation;
    if (!before) throw new Error('Expected a first evaluation.');
    const second = await service.clip({ ...posting, description: 'Unpaid internship, commission-only role. React and TypeScript.' });
    const after = second.job.evaluation;
    if (!after) throw new Error('Expected a recomputed evaluation.');
    expect(after.redFlags).toContain('Unpaid / commission role');
    expect(after.reason).not.toBe(before.reason);
    expect(after.createdAt >= before.createdAt).toBe(true);
  });

  it('treats a new posting with the same company as a first clip, not a repost', async () => {
    const { service } = createService();
    await service.clip(posting);
    const other = await service.clip({ ...posting, jobId: 'repost-2', jobUrl: 'https://www.linkedin.com/jobs/view/repost-2' });
    expect(other.isNew).toBe(true);
    const events = await jobRepository.getEvents(other.job.id);
    expect(events.map((event) => event.type)).toEqual(['clipped']);
  });
});
