import { describe, expect, it } from 'vitest';
import { extractJobFacts, normalizeJobFacts } from '@/src/domain/job-facts';
import { normalizeJob } from '@/src/domain/jobs';

const posting = {
  source: 'linkedin' as const,
  title: 'Senior Full-Time React Engineer',
  company: 'Northstar Labs',
  location: 'Remote — US',
  salary: '$120,000–$150,000 USD per year',
  description: 'We are looking for a senior engineer. Apply by October 20, 2026. Posted September 1, 2026. You have 5+ years of experience with React, TypeScript, and AWS. Benefits include health insurance, remote work, and paid time off.',
};

describe('normalized job facts', () => {
  it('extracts structured facts and explicit application deadlines deterministically', () => {
    const facts = extractJobFacts(posting, '2026-09-25T12:00:00.000Z');
    expect(facts).toMatchObject({
      employmentType: 'full-time',
      workMode: 'remote',
      deadline: { kind: 'application', date: '2026-10-20', source: 'description' },
      postedAt: '2026-09-01',
    });
    expect(facts.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'AWS']));
    expect(facts.benefits).toEqual(expect.arrayContaining(['health insurance', 'remote work', 'paid time off']));
    expect(facts.compensation).toMatchObject({ currency: 'USD', min: 120000, max: 150000, period: 'year' });
    expect(facts.qualifications.length).toBeGreaterThan(0);
  });

  it('normalizes facts on legacy job records while preserving a stable versioned shape', () => {
    const job = normalizeJob({ ...posting }, {
      timestamp: '2026-09-25T12:00:00.000Z',
      createId: () => 'job-facts-test',
    });
    expect(job.facts).toMatchObject({ version: 1, employmentType: 'full-time', workMode: 'remote' });
    expect(job.facts?.evidence).toContain('description');
    const repaired = normalizeJobFacts({ version: 99, skills: ['React', 'React'], workMode: 'remote' }, posting, '2026-09-25T12:00:00.000Z');
    expect(repaired.version).toBe(1);
    expect(repaired.skills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(new Set(repaired.skills).size).toBe(repaired.skills.length);
  });
});
