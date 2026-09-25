import type { FollowUp } from '@/src/types/job';
import { getDb } from './job-repository';

function byDue(a: FollowUp, b: FollowUp): number {
  const statusA = a.status === 'open' ? 0 : 1;
  const statusB = b.status === 'open' ? 0 : 1;
  return statusA - statusB || a.dueAt.localeCompare(b.dueAt) || b.updatedAt.localeCompare(a.updatedAt);
}

export async function getFollowUps(jobId?: string): Promise<FollowUp[]> {
  const db = await getDb();
  const records = jobId ? await db.getAllFromIndex('followUps', 'by-job', jobId) : await db.getAll('followUps');
  return records.sort(byDue);
}

export async function getFollowUp(id: string): Promise<FollowUp | undefined> {
  return (await getDb()).get('followUps', id);
}

export async function saveFollowUp(record: FollowUp): Promise<FollowUp> {
  await (await getDb()).put('followUps', record);
  return record;
}

export async function deleteFollowUp(id: string): Promise<void> {
  await (await getDb()).delete('followUps', id);
}

export const followUpRepository = {
  getAll: getFollowUps,
  getById: getFollowUp,
  save: saveFollowUp,
  delete: deleteFollowUp,
};
