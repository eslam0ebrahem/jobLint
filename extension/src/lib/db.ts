import type { Job, NewJob } from '@/src/types/job';
import { openDB } from 'idb';

const dbPromise = openDB('joblint-db', 5, {
  upgrade(db) {
    if (db.objectStoreNames.contains('jobs')) db.deleteObjectStore('jobs');
    db.createObjectStore('jobs', { keyPath: 'id' });
  },
});

export const getActiveJobs = async (): Promise<Job[]> =>
  (await dbPromise)
    .getAll('jobs')
    .then((list) =>
      list
        .filter((j) => j.status === 'active')
        .sort((a, b) => b.clippedAt.localeCompare(a.clippedAt)),
    );

export const saveJob = async (
  job: Partial<Job> & NewJob,
): Promise<{ id: string; isNew: boolean }> => {
  const db = await dbPromise;
  const id =
    job.id || (job.jobId ? `${job.source}-${job.jobId}` : crypto.randomUUID());
  const existing = await db.get('jobs', id);
  const now = new Date().toISOString();

  await db.put('jobs', {
    ...existing,
    ...job,
    id,
    column: existing?.column || job.column || 'to_apply',
    status: existing?.status || job.status || 'active',
    notes: existing?.notes ?? job.notes,
    clippedAt: existing?.clippedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  return { id, isNew: !existing };
};

export const deleteJob = async (id: string): Promise<void> => {
  (await dbPromise).delete('jobs', id);
};
