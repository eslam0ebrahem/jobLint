import type { DecisionState, JobDecision } from '@/src/types/decisions';
import { normalizeDecision } from '@/src/domain/decisions';
import { getDb } from './job-repository';

function byNewest(a: JobDecision, b: JobDecision): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export async function getDecisions(state?: DecisionState): Promise<JobDecision[]> {
  const db = await getDb();
  const decisions = state ? await db.getAllFromIndex('decisions', 'by-state', state) : await db.getAll('decisions');
  return decisions.sort(byNewest);
}

export async function getDecision(jobId: string): Promise<JobDecision | undefined> {
  return (await getDb()).get('decisions', jobId);
}

export async function saveDecision(input: unknown): Promise<JobDecision | undefined> {
  const timestamp = new Date().toISOString();
  const jobId = typeof input === 'object' && input ? (input as { jobId?: unknown }).jobId : undefined;
  const existing = typeof jobId === 'string' ? await getDecision(jobId) : undefined;
  const decision = normalizeDecision(input, { existing, timestamp });
  if (!decision) return undefined;
  await (await getDb()).put('decisions', decision);
  return decision;
}

export async function deleteDecision(jobId: string): Promise<boolean> {
  const db = await getDb();
  if (!(await db.get('decisions', jobId))) return false;
  await db.delete('decisions', jobId);
  return true;
}

export const decisionRepository = {
  getAll: getDecisions,
  getByJobId: getDecision,
  save: saveDecision,
  delete: deleteDecision,
};
