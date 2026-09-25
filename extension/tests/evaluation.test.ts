import { describe, expect, it } from 'vitest';
import { evaluateJob, getProfileMissingNotice, normalizeEvaluation, parseProfileSkills, detectRedFlags } from '@/src/lib/evaluation';
import { DEFAULT_PREFERENCES, type DetectedJob } from '@/src/types/job';

const job: DetectedJob = {
  source: 'linkedin',
  jobId: '123',
  title: 'Senior Full Stack Engineer',
  company: 'Acme Robotics',
  location: 'Remote · United States',
  salary: '$120,000–$150,000',
  description: 'Build TypeScript React and Node.js services with PostgreSQL, Docker, and AWS. You will collaborate with product teams and mentor engineers.',
};

describe('evidence evaluator', () => {
  it('returns a versioned, explainable local report', () => {
    const report = evaluateJob(job, { roles: 'Full Stack Engineer', skills: 'TypeScript, React, Node.js, PostgreSQL, AWS', location: 'United States' }, DEFAULT_PREFERENCES);
    expect(report.version).toBe(2);
    expect(report.evaluator).toBe('heuristic');
    expect(report.score).toBeGreaterThan(1);
    expect(report.score).toBeLessThanOrEqual(5);
    expect(report.evidence.length).toBeGreaterThan(4);
    expect(report.missingData).not.toContain('Candidate skills');
    expect(report.matchedSkills).toEqual(expect.arrayContaining(['TypeScript', 'React', 'Node.js']));
  });

  it('marks missing context instead of inventing evidence', () => {
    const report = evaluateJob({ source: 'manual', title: 'Backend Engineer', company: 'Example' });
    expect(report.missingData).toEqual(expect.arrayContaining(['Candidate skills', 'Target roles', 'Job description', 'Compensation']));
    expect(report.confidence).toBeLessThan(0.6);
  });

  it('detects high-risk language and normalizes legacy reports', () => {
    expect(detectRedFlags('Unpaid internship, commission-only role', 'Junior')).toContain('Unpaid / commission role');
    const legacy = normalizeEvaluation({ score: 4.2, verdict: 'Apply', legitimacy: 'High Confidence', matchedSkills: ['React'], redFlags: [] });
    expect(legacy?.version).toBe(2);
    expect(legacy?.fitScore).toBe(4.2);
    expect(legacy?.scoreBreakdown.overall).toBe(4.2);
  });

  it('normalizes skill aliases in the profile', () => {
    expect(parseProfileSkills('JS, ts, nodejs, postgresql, ci/cd')).toEqual(['JavaScript', 'TypeScript', 'Node.js', 'PostgreSQL', 'CI/CD']);
    expect(getProfileMissingNotice({ roles: '', skills: '' })).toContain('Target Roles');
  });
});
