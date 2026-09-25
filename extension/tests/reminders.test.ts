import { describe, expect, it, vi } from 'vitest';
import { FollowUpService } from '@/src/application/follow-up-service';
import { ReminderService } from '@/src/application/reminder-service';
import type { FollowUp, Job } from '@/src/types/job';
import { DEFAULT_PREFERENCES } from '@/src/types/job';

function makeJob(): Job {
  return {
    id: 'job-1', source: 'linkedin', title: 'React Engineer', company: 'Acme', column: 'to_apply', status: 'active', clippedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    facts: { version: 1, employmentType: 'full-time', workMode: 'remote', skills: [], benefits: [], qualifications: [], extractedAt: '2026-01-01T00:00:00.000Z', evidence: [], deadline: { kind: 'application', date: '2099-01-10', raw: 'Apply by 2099-01-10', confidence: 0.9, source: 'description' } },
  };
}

describe('follow-ups and reminders', () => {
  it('creates, completes, and removes follow-ups while keeping reminder state synchronized', async () => {
    const records = new Map<string, FollowUp>();
    const followUpRepository = {
      getAll: vi.fn(async (jobId?: string) => [...records.values()].filter((item) => !jobId || item.jobId === jobId)),
      getById: vi.fn(async (id: string) => records.get(id)),
      save: vi.fn(async (record: FollowUp) => { records.set(record.id, record); return record; }),
      delete: vi.fn(async (id: string) => { records.delete(id); }),
    };
    const scheduled: { id: string; when: string; kind: string }[] = [];
    const cancelled: string[] = [];
    const scheduler = {
      schedule: vi.fn(async (id: string, when: string, kind: 'follow-up' | 'deadline') => { scheduled.push({ id, when, kind }); }),
      cancel: vi.fn(async (id: string) => { cancelled.push(id); }),
      notify: vi.fn(async () => undefined),
      onAlarm: vi.fn(() => () => undefined),
    };
    const preferences = { ...DEFAULT_PREFERENCES, remindersEnabled: true, reminderLeadDays: 3 };
    const reminders = new ReminderService({ getAll: async () => [...records.values()] }, { getAll: async () => [makeJob()] }, { getPreferences: async () => preferences }, scheduler);
    const jobGateway = { get: vi.fn(async () => makeJob()), addActivity: vi.fn(async () => undefined) };
    const service = new FollowUpService(followUpRepository, jobGateway, reminders, { getPreferences: async () => preferences }, () => '2026-09-25T00:00:00.000Z', () => 'follow-up-1');

    const created = await service.create({ jobId: 'job-1', title: 'Send thank-you', dueAt: '2099-01-10' });
    expect(created.status).toBe('open');
    expect(created.reminderAt).toBe('2099-01-07T00:00:00.000Z');
    expect(scheduled.some((item) => item.kind === 'follow-up')).toBe(true);
    expect((await service.list('job-1'))).toHaveLength(1);

    const completed = await service.complete(created.id);
    expect(completed.status).toBe('completed');
    expect(scheduler.cancel).toHaveBeenCalledWith('joblint:follow-up:follow-up-1');
    await expect(service.remove(created.id)).resolves.toBe(true);
    expect(records.size).toBe(0);
    expect(jobGateway.addActivity).toHaveBeenCalledTimes(3);
  });

  it('does not notify when reminders are disabled and emits only a bounded notification payload when enabled', async () => {
    const notify = vi.fn(async () => undefined);
    const scheduler = { schedule: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined), notify, onAlarm: vi.fn(() => () => undefined) };
    const job = makeJob();
    const disabled = new ReminderService({ getAll: async () => [] }, { getAll: async () => [job] }, { getPreferences: async () => ({ ...DEFAULT_PREFERENCES, remindersEnabled: false }) }, scheduler);
    await expect(disabled.handleAlarm({ name: 'joblint:deadline:job-1' })).resolves.toBe(true);
    expect(notify).not.toHaveBeenCalled();
    const enabled = new ReminderService({ getAll: async () => [{ id: 'f-1', jobId: 'job-1', kind: 'follow-up', title: 'Call recruiter', dueAt: '2099-01-01T00:00:00.000Z', status: 'open', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] }, { getAll: async () => [job] }, { getPreferences: async () => ({ ...DEFAULT_PREFERENCES, remindersEnabled: true }) }, scheduler);
    await enabled.handleAlarm({ name: 'joblint:follow-up:f-1' });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'JobLint follow-up', body: 'Call recruiter · Acme' }));
  });
});
