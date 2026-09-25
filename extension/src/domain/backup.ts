import type {
  ApplicationEvent,
  FollowUp,
  Job,
  NewJob,
  Profile,
  UserPreferences,
} from '@/src/types/job';
import type { CandidateClaim, ClaimKind } from '@/src/types/claims';
import type { ApplicationDossier } from '@/src/types/dossier';
import type { JobDecision } from '@/src/types/decisions';
import type { PolicyConstraints, StoredPolicyOverride } from '@/src/types/policy';
import { normalizeClaim } from './claims';
import { normalizeDossier } from './dossier';
import { isDecisionState, normalizeDecision } from './decisions';
import { sanitizeExternalUrl } from './identity';
import { normalizePolicyConstraints } from './policy';
import {
  cleanString,
  isApplicationEventType,
  isApplicationOutcome,
  isColumn,
  isJobSource,
  isRecord,
} from './shared';

export type BackupSchemaVersion = 1 | 2 | 3;

export type BackupPayload = {
  schemaVersion: 3;
  exportedAt: string;
  jobs: Job[];
  events: ApplicationEvent[];
  followUps?: FollowUp[];
  claims?: CandidateClaim[];
  dossiers?: ApplicationDossier[];
  decisions?: JobDecision[];
  policyOverrides?: StoredPolicyOverride[];
  policyConstraints?: PolicyConstraints;
  profile: Profile;
  preferences: UserPreferences;
};
export type BackupConflictStrategy = 'skip' | 'overwrite';
export type BackupIssue = { index: number; reason: string };
export type BackupPreview = {
  valid: boolean;
  schemaVersion: BackupSchemaVersion;
  jobCount: number;
  eventCount: number;
  followUpCount: number;
  claimCount: number;
  dossierCount: number;
  decisionCount: number;
  policyOverrideCount: number;
  conflictCount: number;
  hasProfile: boolean;
  hasPreferences: boolean;
  hasPolicyConstraints: boolean;
  issues: BackupIssue[];
};
export type BackupImportResult = {
  imported: number;
  replaced: number;
  skipped: number;
  eventsImported: number;
  followUpsImported: number;
  claimsImported: number;
  dossiersImported: number;
  decisionsImported: number;
  policyOverridesImported: number;
  metadataImported: boolean;
  issues: BackupIssue[];
};
export type ParsedBackup = {
  schemaVersion: BackupSchemaVersion;
  jobs: { input: NewJob; sourceId?: string }[];
  events: ApplicationEvent[];
  followUps: FollowUp[];
  claims: CandidateClaim[];
  dossiers: ApplicationDossier[];
  decisions: JobDecision[];
  policyOverrides: StoredPolicyOverride[];
  policyConstraints?: PolicyConstraints;
  profile?: Profile;
  preferences?: UserPreferences;
  issues: BackupIssue[];
};

const FALLBACK_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function normalizeBackupClaim(value: unknown): CandidateClaim | undefined {
  return normalizeClaim(value, { timestamp: FALLBACK_TIMESTAMP, createId: () => 'claim-imported' });
}

function normalizeBackupDecision(value: unknown): JobDecision | undefined {
  // Lenient defaults would silently rewrite a corrupt state as `new`.
  if (!isRecord(value) || !isDecisionState(value.state)) return undefined;
  return normalizeDecision(value, { timestamp: FALLBACK_TIMESTAMP });
}

function normalizeBackupOverride(value: unknown): StoredPolicyOverride | undefined {
  if (!isRecord(value)) return undefined;
  const jobId = cleanString(value.jobId, 500);
  const code = cleanString(value.code, 100);
  const level = value.level;
  if (!jobId || !code) return undefined;
  if (level !== 'pass' && level !== 'caution' && level !== 'block' && level !== 'unknown') return undefined;
  return {
    key: `${jobId}::${code}`,
    jobId,
    code: code as StoredPolicyOverride['code'],
    at: cleanString(value.at, 100) || FALLBACK_TIMESTAMP,
    level,
    note: cleanString(value.note, 1_000),
    createdAt: cleanString(value.createdAt, 100) || FALLBACK_TIMESTAMP,
    updatedAt: cleanString(value.updatedAt, 100) || FALLBACK_TIMESTAMP,
  };
}

const FOLLOW_UP_KINDS = ['follow-up', 'application', 'interview', 'custom'] as const;
const FOLLOW_UP_STATUSES = ['open', 'completed', 'dismissed'] as const;

function normalizeFollowUp(value: unknown): FollowUp | undefined {
  if (!isRecord(value)) return undefined;
  const id = cleanString(value.id, 200);
  const jobId = cleanString(value.jobId, 500);
  const title = cleanString(value.title, 240);
  const dueAt = cleanString(value.dueAt, 100);
  if (!id || !jobId || !title || !dueAt || !Number.isFinite(Date.parse(dueAt))) return undefined;
  const kind = FOLLOW_UP_KINDS.includes(value.kind as typeof FOLLOW_UP_KINDS[number]) ? value.kind as FollowUp['kind'] : 'follow-up';
  const status = FOLLOW_UP_STATUSES.includes(value.status as typeof FOLLOW_UP_STATUSES[number]) ? value.status as FollowUp['status'] : 'open';
  const createdAt = cleanString(value.createdAt, 100) || new Date().toISOString();
  const updatedAt = cleanString(value.updatedAt, 100) || createdAt;
  return {
    id, jobId, title, dueAt: new Date(dueAt).toISOString(), kind, status,
    notes: cleanString(value.notes, 4_000),
    reminderAt: cleanString(value.reminderAt, 100),
    reminderId: cleanString(value.reminderId, 200),
    createdAt, updatedAt,
    completedAt: cleanString(value.completedAt, 100),
  };
}

function normalizeEvent(value: unknown): ApplicationEvent | undefined {
  if (!isRecord(value)) return undefined;
  const id = cleanString(value.id, 200);
  const jobId = cleanString(value.jobId, 500);
  const at = cleanString(value.at, 100);
  const type = value.type;
  if (!id || !jobId || !at || !isApplicationEventType(type)) return undefined;
  const from = isColumn(value.from) ? value.from : undefined;
  const to = isColumn(value.to) ? value.to : undefined;
  const outcome = isApplicationOutcome(value.outcome) ? value.outcome : undefined;
  const metadata = isRecord(value.metadata)
    ? Object.fromEntries(Object.entries(value.metadata).filter((entry): entry is [string, string | number | boolean] => ['string', 'number', 'boolean'].includes(typeof entry[1])))
    : undefined;
  return { id, jobId, at, type, from, to, outcome, metadata };
}

export function parseBackupPayload(payload: unknown): ParsedBackup {
  if (Array.isArray(payload)) return parseBackupPayload({ schemaVersion: 1, jobs: payload });
  if (!isRecord(payload)) throw new Error('Backup payload is not an object or legacy job array.');
  const rawVersion = payload.schemaVersion;
  const schemaVersion: BackupSchemaVersion = rawVersion === 3 ? 3 : rawVersion === 2 ? 2 : 1;
  if (rawVersion !== undefined && rawVersion !== 1 && rawVersion !== 2 && rawVersion !== 3) throw new Error(`Unsupported backup schema version: ${String(rawVersion)}.`);
  if (!Array.isArray(payload.jobs)) throw new Error('Backup does not contain a jobs array.');
  const rawJobs = payload.jobs as unknown[];

  const issues: BackupIssue[] = [];
  const jobs: ParsedBackup['jobs'] = [];
  for (const [index, value] of rawJobs.entries()) {
    if (!isRecord(value)) {
      issues.push({ index, reason: 'Record is not an object.' });
      continue;
    }
    const title = cleanString(value.title, 500);
    const company = cleanString(value.company, 500);
    const source = value.source;
    if (!title || !company || !isJobSource(source)) {
      issues.push({ index, reason: 'Record needs a valid title, company, and source.' });
      continue;
    }
    const candidate = value as Partial<Job>;
    const input: NewJob = {
      ...candidate,
      id: cleanString(candidate.id, 500),
      source,
      title,
      company,
      location: cleanString(candidate.location, 1_000),
      salary: cleanString(candidate.salary, 1_000),
      description: cleanString(candidate.description),
      requirements: cleanString(candidate.requirements),
      applyUrl: sanitizeExternalUrl(cleanString(candidate.applyUrl, 4_000)),
      jobUrl: sanitizeExternalUrl(cleanString(candidate.jobUrl, 4_000)),
      notes: cleanString(candidate.notes),
      column: isColumn(candidate.column) ? candidate.column : 'to_apply',
      status: candidate.status === 'discarded' ? 'discarded' : 'active',
      outcome: isApplicationOutcome(candidate.outcome) ? candidate.outcome : undefined,
      evaluation: candidate.evaluation,
    };
    jobs.push({ input, sourceId: input.id });
  }

  const events = schemaVersion >= 2 && Array.isArray(payload.events) ? payload.events.map(normalizeEvent).filter((event): event is ApplicationEvent => Boolean(event)) : [];
  const followUps = schemaVersion >= 2 && Array.isArray(payload.followUps) ? payload.followUps.map(normalizeFollowUp).filter((item): item is FollowUp => Boolean(item)) : [];
  if (schemaVersion >= 2 && Array.isArray(payload.events)) {
    payload.events.forEach((value, index) => {
      if (!normalizeEvent(value)) issues.push({ index: rawJobs.length + index, reason: 'Event record is invalid.' });
    });
  }
  if (schemaVersion >= 2 && Array.isArray(payload.followUps)) {
    payload.followUps.forEach((value, index) => {
      if (!normalizeFollowUp(value)) issues.push({ index: rawJobs.length + (Array.isArray(payload.events) ? payload.events.length : 0) + index, reason: 'Follow-up record is invalid.' });
    });
  }

  const claims = schemaVersion >= 3 && Array.isArray(payload.claims)
    ? payload.claims.map(normalizeBackupClaim).filter((item): item is CandidateClaim => Boolean(item))
    : [];
  const dossiers = schemaVersion >= 3 && Array.isArray(payload.dossiers)
    ? payload.dossiers.map(normalizeDossier).filter((item): item is ApplicationDossier => Boolean(item))
    : [];
  const decisions = schemaVersion >= 3 && Array.isArray(payload.decisions)
    ? payload.decisions.map(normalizeBackupDecision).filter((item): item is JobDecision => Boolean(item))
    : [];
  const policyOverrides = schemaVersion >= 3 && Array.isArray(payload.policyOverrides)
    ? payload.policyOverrides.map(normalizeBackupOverride).filter((item): item is StoredPolicyOverride => Boolean(item))
    : [];
  if (schemaVersion >= 3) {
    const offset =
      rawJobs.length +
      (Array.isArray(payload.events) ? payload.events.length : 0) +
      (Array.isArray(payload.followUps) ? payload.followUps.length : 0);
    const report = (values: unknown, label: string, normalize: (input: unknown) => unknown) => {
      if (!Array.isArray(values)) return;
      values.forEach((value, index) => {
        if (!normalize(value)) issues.push({ index: offset + index, reason: `${label} record is invalid.` });
      });
    };
    report(payload.claims, 'Claim', normalizeBackupClaim);
    report(payload.dossiers, 'Dossier', normalizeDossier);
    report(payload.decisions, 'Decision', normalizeBackupDecision);
    report(payload.policyOverrides, 'Policy override', normalizeBackupOverride);
  }
  return {
    schemaVersion,
    jobs,
    events,
    followUps,
    claims,
    dossiers,
    decisions,
    policyOverrides,
    policyConstraints: isRecord(payload.policyConstraints) ? normalizePolicyConstraints(payload.policyConstraints) : undefined,
    profile: isRecord(payload.profile) ? payload.profile as Profile : undefined,
    preferences: isRecord(payload.preferences) ? payload.preferences as unknown as UserPreferences : undefined,
    issues,
  };
}

/** Stable key used to de-duplicate claims when a backup is merged into an existing ledger. */
export function claimDedupeKey(claim: Pick<CandidateClaim, 'kind' | 'label'>): string {
  return `${claim.kind}:${claim.label.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
}

export type { ClaimKind };
