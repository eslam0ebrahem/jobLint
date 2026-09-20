import type { Job, NewJob, Column } from '@/src/types/job';
import { openDB } from 'idb';

const dbPromise = openDB('joblint-db', 5, {
  upgrade(db) {
    if (db.objectStoreNames.contains('jobs')) db.deleteObjectStore('jobs');
    db.createObjectStore('jobs', { keyPath: 'id' });
  },
});

export const getActiveJobs = async (): Promise<Job[]> => {
  const jobs: Job[] = await (await dbPromise).getAll('jobs');
  return jobs
    .filter((j) => j.status === 'active')
    .sort((a, b) => b.clippedAt.localeCompare(a.clippedAt));
};

export const saveJob = async (job: Partial<Job> & NewJob) => {
  const db = await dbPromise;
  const id = job.id || (job.jobId ? `${job.source}-${job.jobId}` : crypto.randomUUID());
  const existing = await db.get('jobs', id);
  const now = new Date().toISOString();

  await db.put('jobs', {
    ...existing,
    ...job,
    id,
    clippedAt: existing?.clippedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  return { id, isNew: !existing };
};

export const updateJobColumn = async (id: string, column: Column) => {
  const db = await dbPromise;
  const job = await db.get('jobs', id);
  if (job) await db.put('jobs', { ...job, column, updatedAt: new Date().toISOString() });
};

export const updateJobNotes = async (id: string, notes: string) => {
  const db = await dbPromise;
  const job = await db.get('jobs', id);
  if (job) await db.put('jobs', { ...job, notes, updatedAt: new Date().toISOString() });
};

export const deleteJob = async (id: string) => (await dbPromise).delete('jobs', id);

