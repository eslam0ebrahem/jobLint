import { describe, expect, it } from 'vitest';
import { applicationPacketToMarkdown, buildApplicationPacket } from '@/src/domain/application-packet';
import { evaluateJob } from '@/src/lib/evaluation';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job, Profile } from '@/src/types/job';

const profile: Profile = { roles: 'React Engineer', skills: 'React, TypeScript', location: 'Remote', summary: 'Builds accessible products.' };
const input = {
  source: 'linkedin' as const,
  title: 'Senior React Engineer',
  company: 'Northstar Labs',
  location: 'Remote',
  description: 'Build React and TypeScript products. You have 5+ years of experience. Apply by October 20, 2026.',
  jobUrl: 'https://www.linkedin.com/jobs/view/packet-1',
};
const evaluation = evaluateJob(input, profile);

function job(): Job {
  return { ...input, id: 'job-1', column: 'to_apply', status: 'active', clippedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', evaluation, facts: undefined };
}

function claim(overrides: Partial<CandidateClaim> & Pick<CandidateClaim, 'label'>): CandidateClaim {
  return {
    version: 1,
    id: `claim-${overrides.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind: 'skill',
    value: undefined,
    status: 'verified',
    source: 'resume',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('local application packets', () => {
  it('grounds alignment and profile points in captured evidence without inventing claims', () => {
    const packet = buildApplicationPacket(job(), profile, '2026-09-25T12:00:00.000Z');
    expect(packet).toMatchObject({ version: 2, localOnly: true, generatedAt: '2026-09-25T12:00:00.000Z', alignment: { score: evaluation.score, verdict: evaluation.verdict } });
    expect(packet.evidence.some((item) => item.source === 'evaluation')).toBe(true);
    expect(packet.evidence.some((item) => item.source === 'profile')).toBe(true);
    expect(packet.talkingPoints.join(' ')).toContain('do not claim experience beyond your profile');
    expect(packet.disclosure).toContain('No application text was sent to a server');
    expect(packet.questions).toContain('What is the expected review timeline?');
  });

  it('reports an empty ledger as not configured rather than as unsupported claims', () => {
    const packet = buildApplicationPacket(job(), profile, '2026-09-25T12:00:00.000Z');
    expect(packet.claimCoverage).toBe('not-configured');
    expect(packet.unsupportedClaims).toEqual([]);
    expect(packet.claims).toEqual([]);
    expect(packet.checklist).toContain('Add your verifiable claims to the claim ledger so every skill you name has a source.');
  });

  it('cites verified claims in the evidence index and names what has no claim', () => {
    const ledger = [claim({ label: 'React' }), claim({ label: 'TypeScript' })];
    const packet = buildApplicationPacket(job(), profile, '2026-09-25T12:00:00.000Z', ledger);
    expect(packet.claimCoverage).toBe('full');
    expect(packet.unsupportedClaims).toEqual([]);
    expect(packet.claims.map((item) => item.label).sort()).toEqual(['React', 'TypeScript']);
    const claimEvidence = packet.evidence.filter((item) => item.source === 'claim');
    expect(claimEvidence.length).toBeGreaterThan(0);
    expect(claimEvidence[0]?.claimIds?.length).toBeGreaterThan(0);
    expect(packet.talkingPoints.join(' ')).toContain('backed by your verified claim');
  });

  it('separates asserted claims from verified ones and lists the gaps', () => {
    const ledger = [claim({ label: 'React', status: 'asserted', verifiedAt: undefined })];
    const packet = buildApplicationPacket(job(), profile, '2026-09-25T12:00:00.000Z', ledger);
    expect(packet.claimCoverage).toBe('partial');
    expect(packet.unsupportedClaims).toContain('TypeScript');
    expect(packet.talkingPoints.join(' ')).toContain('not yet verified');
    expect(packet.checklist).toContain('Re-verify any claim marked asserted before you rely on it in an interview.');
    expect(packet.requirements.some((item) => item.status === 'gap')).toBe(true);
  });

  it('exports a readable local Markdown packet with an evidence index', () => {
    const markdown = applicationPacketToMarkdown(buildApplicationPacket(job(), profile));
    expect(markdown).toContain('# Application packet: Senior React Engineer');
    expect(markdown).toContain('## Evidence index');
    expect(markdown).toContain('Profile skills');
    expect(markdown).toContain('- Claim coverage: not-configured');
  });
});
