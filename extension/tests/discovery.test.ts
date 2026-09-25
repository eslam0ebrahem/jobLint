import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from '@/src/application/discovery-service';
import { discoveryRepository } from '@/src/infrastructure/database/discovery-repository';
import { resetDatabaseForTests } from '@/src/infrastructure/database/job-repository';
import { normalizeDiscoveryCandidate } from '@/src/domain/discovery';
import { evaluateJob } from '@/src/lib/evaluation';
import { DEFAULT_PREFERENCES, type DetectedJob, type Job, type Profile } from '@/src/types/job';

const profile: Profile = { roles: 'Engineer', skills: 'TypeScript, React' };

function candidate(overrides: Partial<DetectedJob> = {}): DetectedJob {
  return {
    source: 'linkedin',
    jobId: 'card-1',
    title: 'Senior React Engineer',
    company: 'Northstar Labs',
    location: 'Remote',
    jobUrl: 'https://www.linkedin.com/jobs/view/card-1',
    ...overrides,
  };
}

describe('discovery policy and inbox', () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it('normalizes unsafe or incomplete card input and keeps a stable identity ID', () => {
    const timestamp = '2026-09-25T00:00:00.000Z';
    const normalized = normalizeDiscoveryCandidate(candidate({ jobUrl: 'https://www.linkedin.com/jobs/view/card-1?utm_source=feed' }), timestamp);
    const repeated = normalizeDiscoveryCandidate(candidate({ jobUrl: 'https://www.linkedin.com/jobs/view/card-1' }), timestamp);
    expect(normalized?.id).toBe(repeated?.id);
    expect(normalized?.job.jobUrl).not.toContain('utm_source');
    expect(normalized?.revisitUrl).toBe('https://www.linkedin.com/jobs/view/card-1');
    expect(normalizeDiscoveryCandidate({ ...candidate(), jobUrl: 'javascript:alert(1)' }, timestamp)).toBeUndefined();
    expect(normalizeDiscoveryCandidate({ source: 'manual', title: 'Manual', company: 'Acme', jobUrl: 'https://example.com/job' }, timestamp)).toBeUndefined();
  });

  it('deduplicates scans, preserves dismissal, and coordinates save/revisit actions', async () => {
    const events = { changed: vi.fn() };
    const savedJob = { id: 'job-1', title: 'Senior React Engineer', company: 'Northstar Labs', column: 'to_apply', status: 'active' } as Job;
    const jobs = { saveFromDiscovery: vi.fn(async () => ({ job: savedJob, isNew: true })) };
    const service = new DiscoveryService(
      discoveryRepository,
      { getProfile: vi.fn(async () => profile), getPreferences: vi.fn(async () => DEFAULT_PREFERENCES) },
      jobs,
      evaluateJob,
      events,
      () => '2026-09-25T00:00:00.000Z',
    );

    const first = await service.ingest([candidate()]);
    expect(first).toMatchObject({ detectedCount: 1, addedCount: 1, newCount: 1, savedCount: 0 });
    const second = await service.ingest([candidate({ jobUrl: 'https://www.linkedin.com/jobs/view/card-1?trk=public' })]);
    expect(second).toMatchObject({ detectedCount: 1, addedCount: 0, refreshedCount: 1, newCount: 1 });

    const item = second.items[0];
    expect(item?.evaluation?.evaluator).toBe('heuristic');
    const saved = await service.save(item!.id);
    expect(saved).toMatchObject({ isNew: true, record: { status: 'saved', savedJobId: 'job-1' } });
    expect(await service.revisit(item!.id)).toBe(item!.job.jobUrl);
    await expect(service.save(item!.id)).rejects.toThrow('already saved');

    const secondItem = (await service.ingest([candidate({ jobId: 'card-2', title: 'Product Designer', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/card-2' })])).items.find((record) => record.job.jobId === 'card-2');
    expect(secondItem).toBeDefined();
    const dismissed = await service.dismiss(secondItem!.id);
    expect(dismissed.status).toBe('dismissed');
    expect((await service.ingest([candidate({ jobId: 'card-2', title: 'Product Designer updated', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/card-2' })])).items.find((record) => record.id === secondItem!.id)?.status).toBe('dismissed');
    expect(events.changed).toHaveBeenCalled();
  });
});
