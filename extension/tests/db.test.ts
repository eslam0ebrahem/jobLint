import { describe, expect, it } from 'vitest';
import { discoveryRepository } from '@/src/infrastructure/database/discovery-repository';
import { followUpRepository } from '@/src/infrastructure/database/follow-up-repository';
import { getActiveJobs, getAllJobs, getEvents, getJob, recordOutcome, saveEvent, saveJob, updateJobColumn, updateJobNotes } from '@/src/infrastructure/database/job-repository';

async function seedLegacyDatabase(version: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('joblint-db', version);
    request.onupgradeneeded = () => {
      const jobs = request.result.createObjectStore('jobs', { keyPath: 'id' });
      if (version >= 5) {
        jobs.createIndex('by-status', 'status');
        jobs.createIndex('by-updated', 'updatedAt');
      }
      if (version >= 6) {
        const events = request.result.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('by-job', 'jobId');
        events.createIndex('by-time', 'at');
      }
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
}

async function readCurrentSchema(): Promise<{ version: number; stores: string[]; indexes: string[]; discoveryIndexes: string[]; followUpIndexes: string[] }> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('joblint-db');
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(['jobs', 'discovery', 'followUps'], 'readonly');
      resolve({
        version: database.version,
        stores: [...database.objectStoreNames].sort(),
        indexes: [...transaction.objectStore('jobs').indexNames].sort(),
        discoveryIndexes: [...transaction.objectStore('discovery').indexNames].sort(),
        followUpIndexes: [...transaction.objectStore('followUps').indexNames].sort(),
      });
      database.close();
    };
    request.onerror = () => reject(request.error);
  });
}

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

  it.each([1, 3, 5, 6])('repairs a legacy v%d database without losing job data', async (version) => {
    await seedLegacyDatabase(version);
    const [job] = await getActiveJobs();
    expect(job).toBeDefined();
    if (!job) throw new Error('Expected the migrated job to be restored.');
    expect(job).toMatchObject({ id: 'legacy-1', column: 'applied', source: 'linkedin' });
    expect(job.identity?.key).toContain('linkedin');
    expect(job.createdAt).toBeTruthy();
    expect(job.updatedAt).toBeTruthy();
    expect(await getEvents(job.id)).toEqual([]);
    expect(await readCurrentSchema()).toEqual({
      version: 8,
      stores: ['discovery', 'events', 'followUps', 'jobs'],
      indexes: ['by-status', 'by-updated'],
      discoveryIndexes: ['by-identity', 'by-source', 'by-status', 'by-updated'],
      followUpIndexes: ['by-due', 'by-job', 'by-status'],
    });
  });

  it('persists discovery records with stable upserts and status transitions', async () => {
    const record = {
      id: 'discovery-test-1',
      identity: { key: 'linkedin:card-1', source: 'linkedin' as const, sourceJobId: 'card-1', fingerprint: 'fingerprint' },
      job: { source: 'linkedin' as const, jobId: 'card-1', title: 'Card Engineer', company: 'Acme', jobUrl: 'https://www.linkedin.com/jobs/view/card-1' },
      status: 'new' as const,
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const first = await discoveryRepository.saveMany([record]);
    const second = await discoveryRepository.saveMany([{ ...record, job: { ...record.job, title: 'Updated Card Engineer' }, updatedAt: '2026-01-02T00:00:00.000Z' }]);
    expect(first.addedCount).toBe(1);
    expect(second.refreshedCount).toBe(1);
    const saved = await discoveryRepository.setStatus(record.id, 'saved', '2026-01-03T00:00:00.000Z', 'job-1');
    expect(saved).toMatchObject({ status: 'saved', savedJobId: 'job-1', job: { title: 'Updated Card Engineer' } });
    expect((await discoveryRepository.getAll())[0]?.id).toBe(record.id);
  });

  it('persists follow-ups independently from jobs and events', async () => {
    const record = {
      id: 'follow-up-test-1',
      jobId: 'legacy-1',
      kind: 'follow-up' as const,
      title: 'Send thank-you note',
      dueAt: '2026-01-04T09:00:00.000Z',
      status: 'open' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await followUpRepository.save(record);
    expect(await followUpRepository.getAll('legacy-1')).toEqual([record]);
    await followUpRepository.delete(record.id);
    expect(await followUpRepository.getAll()).toEqual([]);
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
