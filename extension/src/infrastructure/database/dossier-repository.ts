import type { ApplicationDossier, DossierStatus } from '@/src/types/dossier';
import { normalizeDossier } from '@/src/domain/dossier';
import { getDb } from './job-repository';

function byNewest(a: ApplicationDossier, b: ApplicationDossier): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export async function getDossiers(jobId?: string): Promise<ApplicationDossier[]> {
  const db = await getDb();
  const dossiers = jobId ? await db.getAllFromIndex('dossiers', 'by-job', jobId) : await db.getAll('dossiers');
  return dossiers.sort(byNewest);
}

export async function getDossier(id: string): Promise<ApplicationDossier | undefined> {
  return (await getDb()).get('dossiers', id);
}

/** Most recent dossier for a job, if one exists. */
export async function getLatestDossier(jobId: string): Promise<ApplicationDossier | undefined> {
  return (await getDossiers(jobId))[0];
}

export async function saveDossier(input: ApplicationDossier): Promise<ApplicationDossier> {
  const normalized = normalizeDossier(input);
  if (!normalized) throw new Error('The dossier record is not valid.');
  await (await getDb()).put('dossiers', normalized);
  return normalized;
}

export async function deleteDossier(id: string): Promise<boolean> {
  const db = await getDb();
  if (!(await db.get('dossiers', id))) return false;
  await db.delete('dossiers', id);
  return true;
}

export async function countDossiersByStatus(status: DossierStatus): Promise<number> {
  return (await getDb()).countFromIndex('dossiers', 'by-status', status);
}

export const dossierRepository = {
  getAll: getDossiers,
  getById: getDossier,
  getLatestForJob: getLatestDossier,
  save: saveDossier,
  delete: deleteDossier,
};
