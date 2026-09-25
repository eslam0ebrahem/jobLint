import { describe, expect, it } from 'vitest';
import { applicationPacketToMarkdown, buildApplicationPacket } from '@/src/domain/application-packet';
import { evaluateJob } from '@/src/lib/evaluation';
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

describe('local application packets', () => {
  it('grounds alignment and profile points in captured evidence without inventing claims', () => {
    const packet = buildApplicationPacket(job(), profile, '2026-09-25T12:00:00.000Z');
    expect(packet).toMatchObject({ version: 1, localOnly: true, generatedAt: '2026-09-25T12:00:00.000Z', alignment: { score: evaluation.score, verdict: evaluation.verdict } });
    expect(packet.evidence.some((item) => item.source === 'evaluation')).toBe(true);
    expect(packet.evidence.some((item) => item.source === 'profile')).toBe(true);
    expect(packet.talkingPoints.join(' ')).toContain('do not claim experience beyond your profile');
    expect(packet.disclosure).toContain('No application text was sent to a server');
    expect(packet.questions).toContain('What is the expected review timeline?');
  });

  it('exports a readable local Markdown packet with an evidence index', () => {
    const markdown = applicationPacketToMarkdown(buildApplicationPacket(job(), profile));
    expect(markdown).toContain('# Application packet: Senior React Engineer');
    expect(markdown).toContain('## Evidence index');
    expect(markdown).toContain('Profile skills');
  });
});
