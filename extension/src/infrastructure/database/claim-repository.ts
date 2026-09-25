import type { CandidateClaim, ClaimKind, ClaimStatus } from '@/src/types/claims';
import { normalizeClaim } from '@/src/domain/claims';
import { getDb } from './job-repository';

function makeId(): string {
  return `claim-${crypto.randomUUID()}`;
}

function byUpdated(a: CandidateClaim, b: CandidateClaim): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.label.localeCompare(b.label);
}

export async function getClaims(options: { kind?: ClaimKind; status?: ClaimStatus } = {}): Promise<CandidateClaim[]> {
  const db = await getDb();
  const claims = options.kind
    ? await db.getAllFromIndex('claims', 'by-kind', options.kind)
    : options.status
      ? await db.getAllFromIndex('claims', 'by-status', options.status)
      : await db.getAll('claims');
  return claims.sort(byUpdated);
}

export async function getClaim(id: string): Promise<CandidateClaim | undefined> {
  return (await getDb()).get('claims', id);
}

export async function saveClaim(input: unknown): Promise<CandidateClaim | undefined> {
  const timestamp = new Date().toISOString();
  const requestedId = typeof input === 'object' && input ? (input as { id?: unknown }).id : undefined;
  const existing = typeof requestedId === 'string' ? await getClaim(requestedId) : undefined;
  const claim = normalizeClaim(input, { existing, timestamp, createId: makeId });
  if (!claim) return undefined;
  await (await getDb()).put('claims', claim);
  return claim;
}

export async function saveClaims(inputs: unknown[]): Promise<CandidateClaim[]> {
  const db = await getDb();
  const saved: CandidateClaim[] = [];
  for (const input of inputs) {
    const claim = await saveClaim(input);
    if (claim) saved.push(claim);
  }
  return db.getAll('claims').then(() => saved);
}

export async function deleteClaim(id: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.get('claims', id);
  if (!existing) return false;
  await db.delete('claims', id);
  return true;
}

export const claimRepository = {
  getAll: getClaims,
  getById: getClaim,
  save: saveClaim,
  saveMany: saveClaims,
  delete: deleteClaim,
};
