import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { DiscoveryRecord } from '@/src/types/discovery';
import type { FollowUp } from '@/src/types/job';
import type {
  ApplicationEvent,
  ApplicationOutcome,
  Column,
  Job,
  NewJob,
} from '@/src/types/job';
import type { CandidateClaim } from '@/src/types/claims';
import type { ApplicationDossier } from '@/src/types/dossier';
import type { JobDecision } from '@/src/types/decisions';
import type { StoredPolicyOverride } from '@/src/types/policy';
import { createJobIdentity, identityMatches } from '@/src/domain/identity';
import { normalizeJob } from '@/src/domain/jobs';
import { isApplicationOutcome, isColumn } from '@/src/domain/shared';
import { normalizeEvaluation } from '@/src/lib/evaluation/normalize';

export const DB_NAME = 'joblint-db';
export const DB_VERSION = 9;

export interface JobLintDB extends DBSchema {
  jobs: {
    key: string;
    value: Job;
    indexes: {
      'by-status': string;
      'by-updated': string;
    };
  };
  events: {
    key: string;
    value: ApplicationEvent;
    indexes: {
      'by-job': string;
      'by-time': string;
    };
  };
  discovery: {
    key: string;
    value: DiscoveryRecord;
    indexes: {
      'by-identity': string;
      'by-source': string;
      'by-status': string;
      'by-updated': string;
    };
  };
  followUps: {
    key: string;
    value: FollowUp;
    indexes: {
      'by-job': string;
      'by-due': string;
      'by-status': string;
    };
  };
  claims: {
    key: string;
    value: CandidateClaim;
    indexes: {
      'by-kind': string;
      'by-status': string;
      'by-updated': string;
    };
  };
  dossiers: {
    key: string;
    value: ApplicationDossier;
    indexes: {
      'by-job': string;
      'by-status': string;
      'by-updated': string;
    };
  };
  decisions: {
    key: string;
    value: JobDecision;
    indexes: {
      'by-state': string;
      'by-updated': string;
    };
  };
  policyOverrides: {
    key: string;
    value: StoredPolicyOverride;
    indexes: {
      'by-job': string;
    };
  };
}

export type WriteEvent = Omit<ApplicationEvent, 'id' | 'at'> & { id?: string; at?: string };
export type SaveJobOptions = {
  /** Event emitted when a new record is created. Defaults to `clipped`. */
  creationEventType?: 'clipped' | 'imported';
  /** Additional event to emit in the same transaction (for example, an evaluation). */
  eventType?: 'evaluation_completed' | 're_evaluated' | 'imported';
  /** Do not add a creation event when restoring a record. */
  addCreationEvent?: boolean;
  /** During a restore, let the incoming stage/status replace the existing workflow. */
  overwriteWorkflow?: boolean;
};

let dbPromise: Promise<IDBPDatabase<JobLintDB>> | undefined;
let lastEventTimestamp = 0;

/** Test-only lifecycle hook; production code never calls this. */
export async function resetDatabaseForTests(): Promise<void> {
  const current = dbPromise;
  dbPromise = undefined;
  lastEventTimestamp = 0;
  if (current) {
    try {
      (await current).close();
    } catch {
      // A test may already have closed the connection.
    }
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextEventTimestamp(): string {
  const current = Date.now();
  lastEventTimestamp = Math.max(current, lastEventTimestamp + 1);
  return new Date(lastEventTimestamp).toISOString();
}

function normalizeStoredJob(input: NewJob | Job, existing?: Job, preserveTimestamps = false, overwriteWorkflow = false): Job {
  return normalizeJob(input, {
    existing,
    preserveTimestamps,
    overwriteWorkflow,
    timestamp: now(),
    createId: makeId,
  });
}

function addEvent(
  tx: IDBPTransaction<JobLintDB, ('jobs' | 'events')[], 'readwrite'>,
  event: WriteEvent,
): Promise<ApplicationEvent> {
  const record: ApplicationEvent = {
    ...event,
    id: event.id || makeId('event'),
    at: event.at || nextEventTimestamp(),
  } as ApplicationEvent;
  return tx.objectStore('events').put(record).then(() => record);
}

export function getDb(): Promise<IDBPDatabase<JobLintDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JobLintDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('jobs')) {
          const store = db.createObjectStore('jobs', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-updated', 'updatedAt');
        } else {
          const store = transaction.objectStore('jobs');
          if (!Array.from(store.indexNames).includes('by-status')) store.createIndex('by-status', 'status');
          if (!Array.from(store.indexNames).includes('by-updated')) store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by-job', 'jobId');
          store.createIndex('by-time', 'at');
        }
        if (!db.objectStoreNames.contains('discovery')) {
          const store = db.createObjectStore('discovery', { keyPath: 'id' });
          store.createIndex('by-identity', 'identity.key');
          store.createIndex('by-source', 'job.source');
          store.createIndex('by-status', 'status');
          store.createIndex('by-updated', 'updatedAt');
        } else {
          const store = transaction.objectStore('discovery');
          if (!Array.from(store.indexNames).includes('by-identity')) store.createIndex('by-identity', 'identity.key');
          if (!Array.from(store.indexNames).includes('by-source')) store.createIndex('by-source', 'job.source');
          if (!Array.from(store.indexNames).includes('by-status')) store.createIndex('by-status', 'status');
          if (!Array.from(store.indexNames).includes('by-updated')) store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('followUps')) {
          const store = db.createObjectStore('followUps', { keyPath: 'id' });
          store.createIndex('by-job', 'jobId');
          store.createIndex('by-due', 'dueAt');
          store.createIndex('by-status', 'status');
        } else {
          const store = transaction.objectStore('followUps');
          if (!Array.from(store.indexNames).includes('by-job')) store.createIndex('by-job', 'jobId');
          if (!Array.from(store.indexNames).includes('by-due')) store.createIndex('by-due', 'dueAt');
          if (!Array.from(store.indexNames).includes('by-status')) store.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('claims')) {
          const store = db.createObjectStore('claims', { keyPath: 'id' });
          store.createIndex('by-kind', 'kind');
          store.createIndex('by-status', 'status');
          store.createIndex('by-updated', 'updatedAt');
        } else {
          const store = transaction.objectStore('claims');
          if (!Array.from(store.indexNames).includes('by-kind')) store.createIndex('by-kind', 'kind');
          if (!Array.from(store.indexNames).includes('by-status')) store.createIndex('by-status', 'status');
          if (!Array.from(store.indexNames).includes('by-updated')) store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('dossiers')) {
          const store = db.createObjectStore('dossiers', { keyPath: 'id' });
          store.createIndex('by-job', 'jobId');
          store.createIndex('by-status', 'status');
          store.createIndex('by-updated', 'updatedAt');
        } else {
          const store = transaction.objectStore('dossiers');
          if (!Array.from(store.indexNames).includes('by-job')) store.createIndex('by-job', 'jobId');
          if (!Array.from(store.indexNames).includes('by-status')) store.createIndex('by-status', 'status');
          if (!Array.from(store.indexNames).includes('by-updated')) store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('decisions')) {
          const store = db.createObjectStore('decisions', { keyPath: 'id' });
          store.createIndex('by-state', 'state');
          store.createIndex('by-updated', 'updatedAt');
        } else {
          const store = transaction.objectStore('decisions');
          if (!Array.from(store.indexNames).includes('by-state')) store.createIndex('by-state', 'state');
          if (!Array.from(store.indexNames).includes('by-updated')) store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('policyOverrides')) {
          const store = db.createObjectStore('policyOverrides', { keyPath: 'key' });
          store.createIndex('by-job', 'jobId');
        } else {
          const store = transaction.objectStore('policyOverrides');
          if (!Array.from(store.indexNames).includes('by-job')) store.createIndex('by-job', 'jobId');
        }

        // v1-v5 records were not actively repaired. Do that now, while the
        // versioned upgrade transaction is still available, instead of waiting
        // for a user action to lazily repair an old database.
        if (oldVersion > 0 && oldVersion < DB_VERSION) {
          const store = transaction.objectStore('jobs');
          void (async () => {
            let cursor = await store.openCursor();
            while (cursor) {
              const repaired = normalizeStoredJob(cursor.value as Job, undefined, true);
              await cursor.update(repaired);
              cursor = await cursor.continue();
            }
          })();
        }
      },
    });
  }
  return dbPromise;
}

function byNewest<T extends { updatedAt?: string; at?: string }>(a: T, b: T): number {
  return (b.updatedAt || b.at || '').localeCompare(a.updatedAt || a.at || '');
}

export async function getActiveJobs(): Promise<Job[]> {
  const db = await getDb();
  const jobs = await db.getAll('jobs');
  return jobs
    .map((job) => normalizeStoredJob(job, job, true))
    .filter((job) => job.status === 'active')
    .sort(byNewest);
}

export async function getAllJobs(): Promise<Job[]> {
  const jobs = await (await getDb()).getAll('jobs');
  return jobs
    .map((job) => normalizeStoredJob(job, job, true))
    .sort(byNewest);
}

export async function getJob(id: string): Promise<Job | undefined> {
  const job = await (await getDb()).get('jobs', id);
  return job ? normalizeStoredJob(job, job, true) : undefined;
}

export async function findJobByIdentity(input: NewJob): Promise<Job | undefined> {
  const identity = createJobIdentity(input);
  const jobs = await getAllJobs();
  return jobs.find((job) => identityMatches(job.identity || createJobIdentity(job), identity));
}

export async function saveJob(input: NewJob | Job, options: SaveJobOptions = {}): Promise<{ id: string; isNew: boolean; job: Job }> {
  const db = await getDb();
  const idMatch = input.id ? await db.get('jobs', input.id) : undefined;
  const identityMatch = await findJobByIdentity(input);
  const existing = identityMatch || (idMatch ? idMatch : undefined);
  // Never let a restored ID overwrite an unrelated posting. Identity wins;
  // an ID collision is resolved with a fresh local ID instead.
  const safeInput = idMatch && !existing ? { ...input, id: undefined } : input;
  const job = normalizeStoredJob(safeInput, existing, false, options.overwriteWorkflow);
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  await tx.objectStore('jobs').put(job);
  if (!identityMatch && options.addCreationEvent !== false) {
    await addEvent(tx, { jobId: job.id, type: options.creationEventType || 'clipped' });
  }
  if (options.eventType) {
    await addEvent(tx, { jobId: job.id, type: options.eventType });
  }
  await tx.done;
  return { id: job.id, isNew: !identityMatch, job };
}

export async function updateJobColumn(id: string, column: Column): Promise<Job | undefined> {
  if (!isColumn(column)) return undefined;
  const db = await getDb();
  const job = await db.get('jobs', id);
  if (!job) return undefined;
  const updated = normalizeStoredJob({ ...job, column }, job, false, true);
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  await tx.objectStore('jobs').put(updated);
  await addEvent(tx, { jobId: id, type: 'stage_changed', from: job.column, to: column });
  await tx.done;
  return updated;
}

export async function updateJobNotes(id: string, notes: string): Promise<Job | undefined> {
  const db = await getDb();
  const job = await db.get('jobs', id);
  if (!job) return undefined;
  const updated = normalizeStoredJob({ ...job, notes: typeof notes === 'string' ? notes.slice(0, 20_000) : '' }, job);
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  await tx.objectStore('jobs').put(updated);
  await addEvent(tx, { jobId: id, type: 'note_added' });
  await tx.done;
  return updated;
}

export async function updateJobEvaluation(
  id: string,
  evaluation: Job['evaluation'],
  eventType: 'evaluation_completed' | 're_evaluated' = 'evaluation_completed',
): Promise<Job | undefined> {
  const db = await getDb();
  const job = await db.get('jobs', id);
  if (!job) return undefined;
  const updated = normalizeStoredJob({ ...job, evaluation: normalizeEvaluation(evaluation) }, job);
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  await tx.objectStore('jobs').put(updated);
  await addEvent(tx, { jobId: id, type: eventType });
  await tx.done;
  return { ...updated, identity: updated.identity || createJobIdentity(updated) };
}

export async function recordOutcome(id: string, outcome: ApplicationOutcome): Promise<Job | undefined> {
  if (!isApplicationOutcome(outcome)) return undefined;
  const db = await getDb();
  const job = await db.get('jobs', id);
  if (!job) return undefined;
  const outcomeSnapshot = job.outcomeSnapshot || (job.evaluation ? {
    score: job.evaluation.score,
    verdict: job.evaluation.verdict,
    evaluator: job.evaluation.evaluator,
    createdAt: job.evaluation.createdAt,
  } : undefined);
  const updated = normalizeStoredJob({ ...job, outcome, outcomeSnapshot }, job);
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  await tx.objectStore('jobs').put(updated);
  await addEvent(tx, { jobId: id, type: 'outcome_recorded', outcome });
  await tx.done;
  return updated;
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['jobs', 'events', 'dossiers', 'decisions', 'policyOverrides'], 'readwrite');
  await tx.objectStore('jobs').delete(id);
  const eventKeys = await tx.objectStore('events').index('by-job').getAllKeys(id);
  await Promise.all(eventKeys.map((key) => tx.objectStore('events').delete(key)));
  const dossierKeys = await tx.objectStore('dossiers').index('by-job').getAllKeys(id);
  await Promise.all(dossierKeys.map((key) => tx.objectStore('dossiers').delete(key)));
  const overrideKeys = await tx.objectStore('policyOverrides').index('by-job').getAllKeys(id);
  await Promise.all(overrideKeys.map((key) => tx.objectStore('policyOverrides').delete(key)));
  await tx.objectStore('decisions').delete(id);
  await tx.done;
}

export async function getEvents(jobId?: string): Promise<ApplicationEvent[]> {
  const db = await getDb();
  const events = jobId ? await db.getAllFromIndex('events', 'by-job', jobId) : await db.getAllFromIndex('events', 'by-time');
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export async function saveEvent(event: WriteEvent): Promise<ApplicationEvent> {
  const db = await getDb();
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  const saved = await addEvent(tx, event);
  await tx.done;
  return saved;
}

export async function saveEvents(events: WriteEvent[]): Promise<ApplicationEvent[]> {
  const db = await getDb();
  const tx = db.transaction(['jobs', 'events'], 'readwrite');
  const saved = await Promise.all(events.map((event) => addEvent(tx, event)));
  await tx.done;
  return saved;
}

export async function getRepositoryStats(): Promise<{
  version: number;
  jobCount: number;
  eventCount: number;
  discoveryCount: number;
  followUpCount: number;
  claimCount: number;
  dossierCount: number;
  decisionCount: number;
  policyOverrideCount: number;
}> {
  const db = await getDb();
  const [jobCount, eventCount, discoveryCount, followUpCount, claimCount, dossierCount, decisionCount, policyOverrideCount] =
    await Promise.all([
      db.count('jobs'),
      db.count('events'),
      db.count('discovery'),
      db.count('followUps'),
      db.count('claims'),
      db.count('dossiers'),
      db.count('decisions'),
      db.count('policyOverrides'),
    ]);
  return {
    version: db.version,
    jobCount,
    eventCount,
    discoveryCount,
    followUpCount,
    claimCount,
    dossierCount,
    decisionCount,
    policyOverrideCount,
  };
}

export const jobRepository = {
  getActiveJobs,
  getAllJobs,
  getJob,
  findJobByIdentity,
  saveJob,
  updateJobColumn,
  updateJobNotes,
  updateJobEvaluation,
  recordOutcome,
  deleteJob,
  getEvents,
  saveEvent,
  saveEvents,
  getRepositoryStats,
};
