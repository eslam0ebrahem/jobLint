import type { Job, NewJob } from '@/src/types/job';
import { openDB } from 'idb';

const DB_NAME = 'joblint-db';
const STORE = 'jobs';

const dbPromise = openDB(DB_NAME, 3, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: 'id' });
    }
  },
});

const getDB = () => dbPromise;

export const getJobs = async (): Promise<Job[]> =>
  (await getDB()).getAll(STORE);

export const getActiveJobs = async (): Promise<Job[]> => {
  const jobs = await getJobs();
  return jobs
    .filter((j) => j.status === 'active')
    .sort((a, b) => b.clippedAt.localeCompare(a.clippedAt));
};

export const getJob = async (id: string): Promise<Job | undefined> =>
  (await getDB()).get(STORE, id);

export const saveJob = async (job: Partial<Job> & NewJob): Promise<string> => {
  const db = await getDB();
  const id =
    job.id || (job.jobId ? `${job.source}-${job.jobId}` : crypto.randomUUID());
  const existing = await getJob(id);
  const now = new Date().toISOString();

  await db.put(STORE, {
    ...existing,
    ...job,
    id,
    column: existing?.column || job.column,
    status: existing?.status || job.status,
    notes: existing?.notes ?? job.notes,
    clippedAt: existing?.clippedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  return id;
};

export const updateJob = async (
  id: string,
  updates: Partial<Job>,
): Promise<void> => {
  const db = await getDB();
  const existing = await db.get(STORE, id);
  if (!existing) throw new Error(`Job ${id} not found`);

  await db.put(STORE, {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteJob = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete(STORE, id);
};
