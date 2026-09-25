import { describe, expect, it } from 'vitest';
import {
  contentHash,
  createDossier,
  createPostingSnapshot,
  dossierGaps,
  linkDossierEvent,
  normalizeDossier,
  removeDossierAnswer,
  setDossierStatus,
  upsertDossierAnswer,
  upsertDossierArtifact,
} from '@/src/domain/dossier';
import type { Job } from '@/src/types/job';

const NOW = '2026-09-25T12:00:00.000Z';
let counter = 0;
const createId = (prefix: string) => `${prefix}-${(counter += 1)}`;

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'linkedin',
    title: 'Senior React Engineer',
    company: 'Northstar Labs',
    location: 'Remote',
    description: 'Build React products.',
    requirements: '5+ years',
    salary: '$120,000',
    jobUrl: 'https://www.linkedin.com/jobs/view/1',
    applyUrl: 'https://boards.greenhouse.io/1',
    column: 'applied',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    evaluation: {
      version: 2,
      evaluator: 'heuristic',
      createdAt: NOW,
      score: 4.2,
      verdict: 'Apply',
      verdictLabel: 'Strong fit',
      archetype: 'engineering',
      seniority: 'senior',
      remote: 'remote',
      legitimacy: 'High Confidence',
      reason: 'Good overlap',
      matchedSkills: ['React'],
      missingSkills: [],
      redFlags: [],
      fitScore: 4,
      opportunityScore: 4,
      safetyScore: 5,
      confidence: 0.8,
      riskLevel: 'low',
      missingData: [],
      evidence: [],
      scoreBreakdown: { fit: 4, opportunity: 4, safety: 5, overall: 4.2 },
    },
    ...overrides,
  };
}

describe('application dossier', () => {
  it('hashes captured posting content deterministically and only on real text changes', () => {
    const first = createPostingSnapshot(job(), NOW);
    const same = createPostingSnapshot(job({ updatedAt: '2027-01-01T00:00:00.000Z' }), NOW);
    const changed = createPostingSnapshot(job({ description: 'Build React and GraphQL products.' }), NOW);
    expect(first.contentHash).toBe(same.contentHash);
    expect(first.contentHash).not.toBe(changed.contentHash);
    expect(contentHash(['  A  b '])).toBe(contentHash(['a  b']));
    expect(contentHash(['ab', 'c'])).not.toBe(contentHash(['a', 'bc']));
  });

  it('captures the posting, the evaluator version, and the policy level at open time', () => {
    const dossier = createDossier({
      job: job(),
      policy: { level: 'caution' } as never,
      claimIds: ['claim-react'],
      capturedAt: NOW,
      createId,
    });
    expect(dossier).toMatchObject({ jobId: 'job-1', status: 'draft' });
    expect(dossier.posting.contentHash).toBeTruthy();
    expect(dossier.packet).toMatchObject({ claimIds: ['claim-react'], policyLevel: 'caution' });
    expect(dossier.evaluation).toMatchObject({ evaluator: 'heuristic', evaluatorVersion: 2, score: 4.2, verdict: 'Apply' });
    expect(dossierGaps(dossier)).toEqual(['Attached artifact', 'Submission confirmation']);
  });

  it('records an evaluation-free posting as null instead of inventing one', () => {
    const dossier = createDossier({ job: job({ evaluation: undefined }), capturedAt: NOW, createId });
    expect(dossier.evaluation).toBeNull();
    expect(dossierGaps(dossier)).toContain('Evaluation');
  });

  it('upserts answers and artifacts by identity and never duplicates them', () => {
    let dossier = createDossier({ job: job(), capturedAt: NOW, createId });
    dossier = upsertDossierAnswer(dossier, { question: 'Why this role?', answer: 'Because React.' }, { createId, timestamp: NOW });
    dossier = upsertDossierAnswer(dossier, { question: 'Why this role?', answer: 'Because React and TypeScript.' }, { createId, timestamp: NOW });
    expect(dossier.answers).toHaveLength(1);
    expect(dossier.answers[0]?.answer).toBe('Because React and TypeScript.');

    dossier = upsertDossierArtifact(dossier, { kind: 'resume', label: 'Resume 2026', reference: '~/resume.pdf' }, { createId, timestamp: NOW });
    dossier = upsertDossierArtifact(dossier, { kind: 'resume', label: 'Resume 2026', reference: '~/resume-final.pdf' }, { createId, timestamp: NOW });
    expect(dossier.artifacts).toHaveLength(1);
    expect(dossier.artifacts[0]?.reference).toBe('~/resume-final.pdf');

    dossier = removeDossierAnswer(dossier, dossier.answers[0]!.id, NOW);
    expect(dossier.answers).toEqual([]);
  });

  it('rejects answers and artifacts with no substance', () => {
    const dossier = createDossier({ job: job(), capturedAt: NOW, createId });
    expect(() => upsertDossierAnswer(dossier, { question: '  ', answer: 'x' }, { createId, timestamp: NOW })).toThrow(/needs a question/);
    expect(() => upsertDossierArtifact(dossier, { kind: 'resume', label: 'Résumé', reference: '  ' }, { createId, timestamp: NOW })).toThrow(/label and a reference/);
    expect(() => upsertDossierArtifact(dossier, { kind: 'resume', label: '  ', reference: '~/resume.pdf' }, { createId, timestamp: NOW })).toThrow(/label and a reference/);
  });

  it('keeps an explicitly empty answer rather than inventing one', () => {
    const dossier = createDossier({ job: job(), capturedAt: NOW, createId });
    const saved = upsertDossierAnswer(dossier, { question: 'Notice period?', answer: '' }, { createId, timestamp: NOW });
    expect(saved.answers[0]?.answer).toBe('');
  });

  it('stamps a submission time and links event references once', () => {
    let dossier = createDossier({ job: job(), capturedAt: NOW, createId });
    dossier = setDossierStatus(dossier, 'submitted', '2026-09-26T09:00:00.000Z');
    expect(dossier.submittedAt).toBe('2026-09-26T09:00:00.000Z');
    dossier = linkDossierEvent(dossier, 'event-1', NOW);
    dossier = linkDossierEvent(dossier, 'event-1', NOW);
    expect(dossier.eventIds).toEqual(['event-1']);
  });

  it('round-trips through normalization and rejects malformed records', () => {
    const original = createDossier({ job: job(), capturedAt: NOW, createId });
    const restored = normalizeDossier(JSON.parse(JSON.stringify(original)));
    expect(restored?.jobId).toBe('job-1');
    expect(restored?.posting.title).toBe('Senior React Engineer');
    expect(normalizeDossier({ jobId: 'job-1' })).toBeUndefined();
    expect(normalizeDossier(null)).toBeUndefined();
  });
});
