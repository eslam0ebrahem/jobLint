import { describe, expect, it } from 'vitest';
import { parseBackupPayload } from '@/src/domain/backup';

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
      profile: { roles: 'Designer' },
      preferences: { riskTolerance: 'cautious' },
    });
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.issues).toHaveLength(2);
    expect(parsed.profile?.roles).toBe('Designer');
    expect(parsed.preferences?.riskTolerance).toBe('cautious');
  });

  it('rejects unknown schema versions clearly', () => {
    expect(() => parseBackupPayload({ schemaVersion: 99, jobs: [] })).toThrow('Unsupported backup schema');
  });
});
