import type { PolicyCode, PolicyLevel, PolicyOverride, StoredPolicyOverride } from '@/src/types/policy';
import { isPolicyCode, isPolicyLevel } from '@/src/domain/policy';
import { getDb } from './job-repository';

export type PolicyOverrideLookupFn = (jobId: string, code: PolicyCode) => PolicyOverride | undefined;

export function policyOverrideKey(jobId: string, code: PolicyCode): string {
  return `${jobId}::${code}`;
}

function toMap(overrides: StoredPolicyOverride[]): Map<string, StoredPolicyOverride> {
  return new Map(overrides.map((override) => [override.key, override]));
}

export async function getPolicyOverrides(jobId?: string): Promise<StoredPolicyOverride[]> {
  const db = await getDb();
  return jobId ? db.getAllFromIndex('policyOverrides', 'by-job', jobId) : db.getAll('policyOverrides');
}

/** Lookup shaped for `evaluatePolicy`, which stays free of storage concerns. */
export async function policyOverrideLookup(): Promise<PolicyOverrideLookupFn> {
  const overrides = toMap(await getPolicyOverrides());
  return (jobId, code) => overrides.get(policyOverrideKey(jobId, code));
}

export async function savePolicyOverride(input: {
  jobId: string;
  code: string;
  level?: unknown;
  note?: unknown;
}): Promise<StoredPolicyOverride | undefined> {
  if (!input.jobId || !isPolicyCode(input.code)) return undefined;
  const timestamp = new Date().toISOString();
  const key = policyOverrideKey(input.jobId, input.code);
  const existing = await (await getDb()).get('policyOverrides', key);
  const level: PolicyLevel = isPolicyLevel(input.level) ? input.level : 'caution';
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 1_000) : undefined;
  const record: StoredPolicyOverride = {
    key,
    jobId: input.jobId,
    code: input.code,
    at: timestamp,
    level,
    ...(note ? { note } : {}),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  await (await getDb()).put('policyOverrides', record);
  return record;
}

export async function deletePolicyOverride(jobId: string, code: string): Promise<boolean> {
  if (!isPolicyCode(code)) return false;
  const db = await getDb();
  const key = policyOverrideKey(jobId, code);
  if (!(await db.get('policyOverrides', key))) return false;
  await db.delete('policyOverrides', key);
  return true;
}

export const policyRepository = {
  getAll: getPolicyOverrides,
  getLookup: policyOverrideLookup,
  save: savePolicyOverride,
  delete: deletePolicyOverride,
};
