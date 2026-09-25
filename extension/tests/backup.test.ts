import { describe, expect, it } from 'vitest';
import { claimDedupeKey, parseBackupPayload } from '@/src/domain/backup';

describe('backup parser', () => {
  it('accepts a legacy v1 array and normalizes its job fields', () => {
    const parsed = parseBackupPayload([{ id: 'old-1', source: 'linkedin', title: 'Engineer', company: 'Acme', evaluation: { score: 4, redFlags: [] } }]);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]?.input).toMatchObject({ id: 'old-1', source: 'linkedin', title: 'Engineer', column: 'to_apply', status: 'active' });
    expect(parsed.issues).toEqual([]);
  });

  it('validates v2 events and reports malformed records without discarding valid data', () => {
    const parsed = parseBackupPayload({
      schemaVersion: 2,
      jobs: [{ source: 'manual', title: 'Designer', company: 'Acme' }, { source: 'manual', title: '', company: 'Acme' }],
      events: [{ id: 'e1', jobId: 'missing', type: 'imported', at: '2026-01-01T00:00:00.000Z' }, { id: 'bad', jobId: 'x', type: 'unknown', at: 'x' }],
      followUps: [{ id: 'f1', jobId: 'missing', title: 'Call recruiter', dueAt: '2099-01-01T00:00:00.000Z', status: 'open' }, { id: 'bad', jobId: 'x', title: '', dueAt: 'not-a-date' }],
      profile: { roles: 'Designer' },
      preferences: { riskTolerance: 'cautious' },
    });
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.followUps).toHaveLength(1);
    expect(parsed.followUps[0]).toMatchObject({ id: 'f1', jobId: 'missing', title: 'Call recruiter' });
    expect(parsed.issues).toHaveLength(3);
    expect(parsed.profile?.roles).toBe('Designer');
    expect(parsed.preferences?.riskTolerance).toBe('cautious');
  });

  it('rejects unknown schema versions clearly', () => {
    expect(() => parseBackupPayload({ schemaVersion: 99, jobs: [] })).toThrow('Unsupported backup schema');
  });

  it('parses v3 claims, dossiers, decisions, and policy overrides, skipping only the malformed ones', () => {
    const parsed = parseBackupPayload({
      schemaVersion: 3,
      jobs: [{ id: 'job-1', source: 'manual', title: 'Engineer', company: 'Acme' }],
      events: [],
      followUps: [],
      claims: [
        { id: 'claim-1', kind: 'skill', label: 'React', status: 'verified', source: 'resume', createdAt: '2026-01-01T00:00:00.000Z' },
        { kind: 'skill', label: '' },
      ],
      dossiers: [
        {
          id: 'dossier-1',
          jobId: 'job-1',
          status: 'submitted',
          createdAt: '2026-01-01T00:00:00.000Z',
          posting: { capturedAt: '2026-01-01T00:00:00.000Z', title: 'Engineer', company: 'Acme', description: 'Body', contentHash: 'abc', detector: { source: 'manual', strategy: 'manual', state: 'detected', version: '1' } },
          packet: { packetVersion: 2, generatedAt: '2026-01-01T00:00:00.000Z', claimIds: ['claim-1'], policyLevel: 'caution' },
          answers: [{ id: 'a1', question: 'Why?', answer: 'Because.', claimIds: ['claim-1'] }],
          artifacts: [],
          eventIds: ['e1'],
        },
        { id: 'broken' },
      ],
      decisions: [{ id: 'job-1', jobId: 'job-1', state: 'shortlisted', createdAt: '2026-01-01T00:00:00.000Z' }, { jobId: 'job-2', state: 'nope' }],
      policyOverrides: [{ key: 'job-1::deadline_passed', jobId: 'job-1', code: 'deadline_passed', level: 'caution', at: '2026-01-01T00:00:00.000Z' }, { jobId: 'job-1', code: 'deadline_passed', level: 'weird' }],
      policyConstraints: { doNotApplyCompanies: ['Acme'], stalePostingDays: 9_999 },
      profile: { roles: 'Engineer' },
      preferences: { riskTolerance: 'cautious' },
    });
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.claims).toHaveLength(1);
    expect(parsed.claims[0]).toMatchObject({ id: 'claim-1', label: 'React', status: 'verified' });
    expect(parsed.dossiers).toHaveLength(1);
    expect(parsed.dossiers[0]).toMatchObject({ jobId: 'job-1', status: 'submitted' });
    expect(parsed.dossiers[0]?.packet.claimIds).toEqual(['claim-1']);
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.policyOverrides).toHaveLength(1);
    expect(parsed.policyConstraints).toMatchObject({ doNotApplyCompanies: ['Acme'], stalePostingDays: 365 });
    // One bad claim, one bad dossier, one bad decision, one bad override.
    expect(parsed.issues).toHaveLength(4);
  });

  it('ignores v3-only sections when an older payload is imported', () => {
    const parsed = parseBackupPayload({ schemaVersion: 2, jobs: [{ source: 'manual', title: 'Engineer', company: 'Acme' }], claims: [{ kind: 'skill', label: 'React' }] });
    expect(parsed.claims).toEqual([]);
    expect(parsed.dossiers).toEqual([]);
    expect(parsed.policyConstraints).toBeUndefined();
  });

  it('de-duplicates claims by kind and label so re-importing never doubles the ledger', () => {
    expect(claimDedupeKey({ kind: 'skill', label: 'Node.js' })).toBe(claimDedupeKey({ kind: 'skill', label: 'node js' }));
    expect(claimDedupeKey({ kind: 'skill', label: 'React' })).not.toBe(claimDedupeKey({ kind: 'language', label: 'React' }));
  });
});
