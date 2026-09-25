import type { DiscoveryRecord, DiscoveryStatus } from '@/src/types/discovery';
import { getDb } from './job-repository';

function newestFirst(a: DiscoveryRecord, b: DiscoveryRecord): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export async function getDiscoveryRecords(): Promise<DiscoveryRecord[]> {
  return (await (await getDb()).getAll('discovery')).sort(newestFirst);
}

export async function getDiscoveryRecord(id: string): Promise<DiscoveryRecord | undefined> {
  return (await getDb()).get('discovery', id);
}

export async function saveDiscoveryRecords(records: DiscoveryRecord[]): Promise<{
  records: DiscoveryRecord[];
  addedCount: number;
  refreshedCount: number;
}> {
  if (!records.length) return { records, addedCount: 0, refreshedCount: 0 };
  const db = await getDb();
  const existing = await Promise.all(records.map((record) => db.get('discovery', record.id)));
  const existingById = new Map(existing.filter((record): record is DiscoveryRecord => Boolean(record)).map((record) => [record.id, record]));
  const merged = records.map((record) => {
    const previous = existingById.get(record.id);
    return {
      ...record,
      status: previous?.status || record.status,
      capturedAt: previous?.capturedAt || record.capturedAt,
      savedJobId: previous?.savedJobId || record.savedJobId,
    } as DiscoveryRecord;
  });
  const tx = db.transaction('discovery', 'readwrite');
  await Promise.all(merged.map((record) => tx.store.put(record)));
  await tx.done;
  return {
    records: merged,
    addedCount: merged.filter((record) => !existingById.has(record.id)).length,
    refreshedCount: merged.filter((record) => existingById.has(record.id)).length,
  };
}

export async function setDiscoveryStatus(
  id: string,
  status: DiscoveryStatus,
  updatedAt: string,
  savedJobId?: string,
): Promise<DiscoveryRecord | undefined> {
  const db = await getDb();
  const existing = await db.get('discovery', id);
  if (!existing) return undefined;
  const updated: DiscoveryRecord = {
    ...existing,
    status,
    updatedAt,
    savedJobId: savedJobId || existing.savedJobId,
  };
  await db.put('discovery', updated);
  return updated;
}

export const discoveryRepository = {
  getAll: getDiscoveryRecords,
  getById: getDiscoveryRecord,
  saveMany: saveDiscoveryRecords,
  setStatus: setDiscoveryStatus,
};
