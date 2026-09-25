import { describe, expect, it } from 'vitest';
import { capturedDescription, diffPostings, postingContentHash, TRACKED_POSTING_FIELDS } from '@/src/domain/repost';
import { createPostingSnapshot } from '@/src/domain/dossier';
import type { DetectedJob, Job } from '@/src/types/job';

const posting: DetectedJob = {
  source: 'linkedin',
  jobId: 'rt-1',
  title: 'Senior React Engineer',
  company: 'Northstar Labs',
  location: 'Remote',
  salary: '$140,000',
  description: 'Build React and TypeScript products.',
  requirements: '5+ years experience.',
  jobUrl: 'https://www.linkedin.com/jobs/view/rt-1',
  applyUrl: 'https://boards.greenhouse.io/northstar/rt-1',
};

function stored(overrides: Partial<Job> = {}): Job {
  return {
    ...posting,
    id: 'job-1',
    column: 'to_apply',
    status: 'active',
    clippedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('posting diff', () => {
  it('reports no change for the same posting', () => {
    const diff = diffPostings(stored(), posting);
    expect(diff).toMatchObject({ changed: false, contentChanged: false });
    expect(diff.summary).toBe('No change detected.');
    expect(diff.beforeHash).toBe(diff.afterHash);
  });

  it('ignores whitespace-only churn', () => {
    const diff = diffPostings(stored(), { ...posting, description: 'Build   React and  TypeScript products.' });
    expect(diff.changed).toBe(false);
  });

  it('detects a description change as a content repost', () => {
    const diff = diffPostings(stored(), { ...posting, description: 'Build React and TypeScript products. Now on-call.' });
    expect(diff).toMatchObject({ changed: true, contentChanged: true });
    expect(diff.fields.map((change) => change.field)).toEqual(['description']);
    expect(diff.summary).toContain('description:');
    expect(diff.summary).toContain('→');
    expect(diff.beforeHash).not.toBe(diff.afterHash);
  });

  it('separates a detail-only change from a real content change', () => {
    const titleOnly = diffPostings(stored(), { ...posting, title: 'Staff React Engineer' });
    expect(titleOnly).toMatchObject({ changed: true, contentChanged: false });

    const closed = diffPostings(stored(), { ...posting, description: 'This role has been filled.' });
    expect(closed).toMatchObject({ changed: true, contentChanged: true });
  });

  it('records several changed fields in a stable order and previews long text', () => {
    const long = 'x'.repeat(400);
    const diff = diffPostings(stored(), { ...posting, salary: '$160,000', applyUrl: 'https://jobs.example.com/1', description: long });
    expect(diff.fields.map((change) => change.field)).toEqual(['salary', 'description', 'applyUrl']);
    expect(diff.fields[1]?.after).toHaveLength(61);
    expect(diff.summary.length).toBeLessThanOrEqual(1_000);
  });

  it('treats a cleared field as a change', () => {
    const diff = diffPostings(stored(), { ...posting, salary: undefined });
    expect(diff.changed).toBe(true);
    expect(diff.fields[0]).toMatchObject({ field: 'salary', after: undefined });
    expect(diff.summary).toContain('(empty)');
  });

  it('hashes the same text a dossier would freeze', () => {
    const job = stored();
    expect(postingContentHash(job)).toBe(createPostingSnapshot(job, '2026-01-01T00:00:00.000Z').contentHash);
    expect(capturedDescription(job)).toBe('Build React and TypeScript products.');
    expect(capturedDescription({ title: 'T', company: 'C', requirements: 'Only requirements.' })).toBe('Only requirements.');
    expect(TRACKED_POSTING_FIELDS).toContain('description');
  });
});
