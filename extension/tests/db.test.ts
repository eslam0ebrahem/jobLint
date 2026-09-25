import { describe, expect, it } from 'vitest';
import { getActiveJobs, getAllJobs, getEvents, getJob, recordOutcome, saveEvent, saveJob, updateJobColumn, updateJobNotes } from '@/src/lib/db';

describe('IndexedDB repository', () => {
  it('deduplicates by identity and returns newest first', async () => {
    const first = await saveJob({ source: 'linkedin', jobId: 'one', title: 'Engineer', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/one' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await saveJob({ source: 'linkedin', jobId: 'two', title: 'Designer', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/two' });
    const duplicate = await saveJob({ source: 'linkedin', jobId: 'one', title: 'Engineer updated', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/one?utm_source=test' });
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.id).toBe(first.id);
    expect((await getActiveJobs()).map((job) => job.id)).toEqual([first.id, second.id]);
    expect((await getAllJobs()).length).toBe(2);
  });

  it('actively repairs legacy v5 records during the v6 upgrade', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('joblint-db', 5);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('jobs', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-updated', 'updatedAt');
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('jobs', 'readwrite');
        transaction.objectStore('jobs').put({ id: 'legacy-1', source: 'linkedin', title: 'Legacy Engineer', company: 'Acme', column: 'applied', status: 'active' });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    const [job] = await getActiveJobs();
    expect(job).toMatchObject({ id: 'legacy-1', column: 'applied', source: 'linkedin' });
    expect(job.identity?.key).toContain('linkedin');
    expect(job.createdAt).toBeTruthy();
    expect(job.updatedAt).toBeTruthy();
  });

  it('writes stage, note, and outcome events in the same repository flow', async () => {
    const saved = await saveJob({ source: 'manual', title: 'Backend Engineer', company: 'Acme' });
    await updateJobColumn(saved.id, 'applied');
    await updateJobNotes(saved.id, 'Recruiter email');
    const updated = await recordOutcome(saved.id, 'interview');
    expect(updated?.column).toBe('applied');
    expect(updated?.notes).toBe('Recruiter email');
    expect(updated?.outcome).toBe('interview');
    const events = await getEvents(saved.id);
    expect(events.map((event) => event.type)).toEqual(['clipped', 'stage_changed', 'note_added', 'outcome_recorded']);
    expect(await getJob(saved.id)).toMatchObject({ id: saved.id, outcome: 'interview' });
  });

  it('restores explicit event IDs without creating duplicates', async () => {
    const saved = await saveJob({ source: 'manual', title: 'Product Designer', company: 'Acme' });
    await saveEvent({ id: 'event-from-backup', jobId: saved.id, type: 'imported', at: '2026-01-01T00:00:00.000Z' });
    await saveEvent({ id: 'event-from-backup', jobId: saved.id, type: 'imported', at: '2026-01-01T00:00:00.000Z' });
    expect((await getEvents(saved.id)).filter((event) => event.id === 'event-from-backup')).toHaveLength(1);
  });
});
