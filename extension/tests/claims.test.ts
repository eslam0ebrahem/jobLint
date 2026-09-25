import { describe, expect, it } from 'vitest';
import {
  attributeEvaluationClaims,
  buildRequirementEvidence,
  claimIdsForEvaluation,
  groundedSkills,
  labelsMatch,
  matchRequirement,
  normalizeClaim,
  summarizeClaims,
} from '@/src/domain/claims';
import { evaluateJob, normalizeEvaluation } from '@/src/lib/evaluation';
import type { CandidateClaim } from '@/src/types/claims';
import type { DetectedJob, Job, JobEvaluation } from '@/src/types/job';

const NOW = '2026-09-25T12:00:00.000Z';

function claim(overrides: Partial<CandidateClaim> & Pick<CandidateClaim, 'label'>): CandidateClaim {
  return {
    version: 1,
    id: `claim-${overrides.label}`,
    kind: 'skill',
    status: 'verified',
    source: 'resume',
    createdAt: NOW,
    updatedAt: NOW,
    verifiedAt: NOW,
    ...overrides,
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'linkedin',
    title: 'Senior React Engineer',
    company: 'Northstar Labs',
    location: 'Remote',
    description: 'Build React and TypeScript products.',
    column: 'to_apply',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    facts: {
      version: 1,
      employmentType: 'full-time',
      workMode: 'remote',
      skills: ['React', 'TypeScript', 'GraphQL'],
      benefits: [],
      qualifications: ['5+ years experience'],
      extractedAt: NOW,
      evidence: ['description'],
    },
    ...overrides,
  };
}

describe('candidate claim ledger', () => {
  it('normalizes a claim and falls back instead of throwing on unknown enums', () => {
    const saved = normalizeClaim(
      { kind: 'not-a-kind', label: '  React  ', status: 'nope', source: 'nope' },
      { timestamp: NOW, createId: () => 'claim-new' },
    );
    expect(saved).toMatchObject({ id: 'claim-new', kind: 'skill', label: 'React', status: 'asserted', source: 'manual' });
    expect(normalizeClaim({ kind: 'skill' }, { timestamp: NOW, createId: () => 'x' })).toBeUndefined();
  });

  it('stamps a verification time only when a claim is verified', () => {
    const asserted = normalizeClaim({ kind: 'skill', label: 'React' }, { timestamp: NOW, createId: () => 'a' });
    expect(asserted?.verifiedAt).toBeUndefined();
    const verified = normalizeClaim({ kind: 'skill', label: 'React', status: 'verified' }, { timestamp: NOW, createId: () => 'b' });
    expect(verified?.verifiedAt).toBe(NOW);
  });

  it('matches labels across punctuation and nesting but never on a two-letter token', () => {
    expect(labelsMatch('Node.js', 'node js')).toBe(true);
    expect(labelsMatch('PostgreSQL', 'postgres')).toBe(true);
    expect(labelsMatch('Golang', 'Go')).toBe(false);
    expect(labelsMatch('', 'React')).toBe(false);
  });

  it('separates verified coverage, asserted coverage, and real gaps', () => {
    const ledger = [claim({ label: 'React' }), claim({ id: 'claim-ts', label: 'TypeScript', status: 'asserted' })];
    expect(matchRequirement('React', ledger)).toMatchObject({ status: 'covered', claimIds: ['claim-React'] });
    expect(matchRequirement('TypeScript', ledger)).toMatchObject({ status: 'partial' });
    expect(matchRequirement('Rust', ledger)).toMatchObject({ status: 'gap', claimIds: [] });
    expect(matchRequirement('  ', ledger)).toMatchObject({ status: 'unknown' });
  });

  it('ignores archived and disputed claims when measuring coverage', () => {
    const ledger = [claim({ label: 'React', status: 'archived' }), claim({ id: 'claim-2', label: 'GraphQL', status: 'disputed' })];
    expect(matchRequirement('React', ledger).status).toBe('gap');
    expect(matchRequirement('GraphQL', ledger).status).toBe('gap');
  });

  it('builds an ordered, de-duplicated requirement list for a posting', () => {
    const ledger = [claim({ label: 'react.js' })];
    const requirements = buildRequirementEvidence(job(), ledger);
    expect(requirements.map((item) => item.requirement)).toEqual(['React', 'TypeScript', 'GraphQL', '5+ years experience']);
    expect(requirements[0]).toMatchObject({ status: 'covered' });
  });

  it('cites claims for the skills the evaluator already matched', () => {
    const ledger = [claim({ label: 'React' }), claim({ id: 'claim-2', label: 'TypeScript' })];
    expect(claimIdsForEvaluation(job({ evaluation: { matchedSkills: ['React', 'TypeScript'] } } as Partial<Job>), ledger)).toEqual([
      'claim-React',
      'claim-2',
    ]);
    expect(groundedSkills(job({ evaluation: { matchedSkills: ['React', 'Vue'] } } as Partial<Job>), ledger)).toEqual([
      { skill: 'React', claimIds: ['claim-React'], status: 'covered' },
    ]);
  });

  it('summarizes the ledger by kind and status', () => {
    const snapshot = summarizeClaims([claim({ label: 'React' }), claim({ id: 'claim-2', label: 'Go', kind: 'language', status: 'asserted' })]);
    expect(snapshot).toMatchObject({ version: 1, kindCounts: { skill: 1, language: 1 }, statusCounts: { verified: 1, asserted: 1 } });
    expect(snapshot.updatedAt).toBe(NOW);
  });
});

const posting: DetectedJob = {
  source: 'linkedin',
  jobId: 'attr-1',
  title: 'Senior React Engineer',
  company: 'Northstar Labs',
  location: 'Remote',
  description: 'Build React and TypeScript products with GraphQL and PostgreSQL. 5+ years of experience.',
};

function report(): JobEvaluation {
  return evaluateJob(posting, { roles: 'React Engineer', skills: 'React, TypeScript, GraphQL, PostgreSQL', location: 'Remote' });
}

function scoringFields(evaluation: JobEvaluation) {
  const { score, verdict, fitScore, opportunityScore, safetyScore, confidence, scoreBreakdown, matchedSkills, missingSkills, redFlags, riskLevel, reason, missingData } = evaluation;
  return { score, verdict, fitScore, opportunityScore, safetyScore, confidence, scoreBreakdown, matchedSkills, missingSkills, redFlags, riskLevel, reason, missingData };
}

describe('evaluator claim attribution', () => {
  it('adds a coverage signal without touching a single scoring field', () => {
    const base = report();
    const attributed = attributeEvaluationClaims(base, [claim({ label: 'React' }), claim({ id: 'claim-2', label: 'TypeScript' })]);

    expect(scoringFields(attributed)).toEqual(scoringFields(base));
    expect(attributed.version).toBe(2);
    expect(attributed.evidence.length).toBe(base.evidence.length + 1);

    const coverage = attributed.evidence.find((item) => item.id === 'claims');
    expect(coverage).toMatchObject({ category: 'profile', support: 'verified' });
    expect(coverage?.claimIds?.sort()).toEqual(['claim-2', 'claim-React']);
    expect(coverage?.detail).toContain('Verified:');
    expect(coverage?.detail).toContain('No claim covers:');
  });

  it('tags the existing skill signal with the same provenance', () => {
    const attributed = attributeEvaluationClaims(report(), [claim({ label: 'React' })]);
    const skills = attributed.evidence.find((item) => item.id === 'skills');
    expect(skills?.claimIds).toEqual(['claim-React']);
    expect(skills?.support).toBe('verified');
  });

  it('distinguishes asserted from verified and from unbacked', () => {
    const attributed = attributeEvaluationClaims(report(), [claim({ id: 'claim-ts', label: 'TypeScript', status: 'asserted', verifiedAt: undefined })]);
    const coverage = attributed.evidence.find((item) => item.id === 'claims');
    expect(coverage?.support).toBe('asserted');
    expect(coverage?.detail).toContain('Asserted but unverified:');

    const nothing = attributeEvaluationClaims(report(), [claim({ label: 'Kubernetes', kind: 'skill' })]);
    expect(nothing.evidence.find((item) => item.id === 'claims')?.support).toBe('unbacked');
  });

  it('adds nothing at all when the ledger is empty or fully archived', () => {
    const base = report();
    expect(attributeEvaluationClaims(base, [])).toBe(base);
    const archived = attributeEvaluationClaims(base, [claim({ label: 'React', status: 'archived' })]);
    expect(archived.evidence.length).toBe(base.evidence.length);
  });

  it('survives evaluation normalization so stored reports keep their provenance', () => {
    const attributed = attributeEvaluationClaims(report(), [claim({ label: 'React' })]);
    const restored = normalizeEvaluation(JSON.parse(JSON.stringify(attributed)));
    expect(restored?.evidence.find((item) => item.id === 'claims')?.claimIds).toEqual(['claim-React']);
    expect(restored?.score).toBe(attributed.score);
  });

  it('is idempotent, so re-attributing never stacks duplicate signals', () => {
    const once = attributeEvaluationClaims(report(), [claim({ label: 'React' })]);
    const twice = attributeEvaluationClaims(once, [claim({ label: 'React' })]);
    expect(twice.evidence.filter((item) => item.id === 'claims')).toHaveLength(1);
    expect(twice.evidence).toHaveLength(once.evidence.length);
  });
});
