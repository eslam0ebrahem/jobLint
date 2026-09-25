import type { ApplicationEvent, ApplicationOutcome, Column, Job, JobSource, NewJob, Profile, UserPreferences } from '@/src/types/job';
import type { BackupIssue } from './messages';
import { sanitizeExternalUrl } from './identity';

const JOB_SOURCES: JobSource[] = ['linkedin', 'indeed', 'manual', 'other'];
const COLUMNS: Column[] = ['to_apply', 'applied', 'assessment', 'interviewing', 'offer', 'rejected'];
const OUTCOMES: ApplicationOutcome[] = ['interested', 'not_interested', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
const EVENT_TYPES: ApplicationEvent['type'][] = ['clipped', 'stage_changed', 'note_added', 'evaluation_completed', 're_evaluated', 'outcome_recorded', 'imported'];

export type ParsedBackup = {
  schemaVersion: 1 | 2;
  jobs: { input: NewJob; sourceId?: string }[];
  events: ApplicationEvent[];
  profile?: Profile;
  preferences?: UserPreferences;
  issues: BackupIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanString(value: unknown, maxLength = 20_000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function normalizeEvent(value: unknown): ApplicationEvent | undefined {
  if (!isRecord(value)) return undefined;
  const id = cleanString(value.id, 200);
  const jobId = cleanString(value.jobId, 500);
  const at = cleanString(value.at, 100);
  const type = value.type;
  if (!id || !jobId || !at || !EVENT_TYPES.includes(type as ApplicationEvent['type'])) return undefined;
  const from = COLUMNS.includes(value.from as Column) ? value.from as Column : undefined;
  const to = COLUMNS.includes(value.to as Column) ? value.to as Column : undefined;
  const outcome = OUTCOMES.includes(value.outcome as ApplicationOutcome) ? value.outcome as ApplicationOutcome : undefined;
  const metadata = isRecord(value.metadata)
    ? Object.fromEntries(Object.entries(value.metadata).filter((entry): entry is [string, string | number | boolean] => ['string', 'number', 'boolean'].includes(typeof entry[1])))
    : undefined;
  return { id, jobId, at, type: type as ApplicationEvent['type'], from, to, outcome, metadata };
}

export function parseBackupPayload(payload: unknown): ParsedBackup {
  if (Array.isArray(payload)) return parseBackupPayload({ schemaVersion: 1, jobs: payload });
  if (!isRecord(payload)) throw new Error('Backup payload is not an object or legacy job array.');
  const rawVersion = payload.schemaVersion;
  const schemaVersion: 1 | 2 = rawVersion === 2 ? 2 : 1;
  if (rawVersion !== undefined && rawVersion !== 1 && rawVersion !== 2) throw new Error(`Unsupported backup schema version: ${String(rawVersion)}.`);
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
    if (!title || !company || !JOB_SOURCES.includes(source as JobSource)) {
      issues.push({ index, reason: 'Record needs a valid title, company, and source.' });
      continue;
    }
    const candidate = value as Partial<Job>;
    const input: NewJob = {
      ...candidate,
      id: cleanString(candidate.id, 500),
      source: source as JobSource,
      title,
      company,
      location: cleanString(candidate.location, 1_000),
      salary: cleanString(candidate.salary, 1_000),
      description: cleanString(candidate.description),
      requirements: cleanString(candidate.requirements),
      applyUrl: sanitizeExternalUrl(cleanString(candidate.applyUrl, 4_000)),
      jobUrl: sanitizeExternalUrl(cleanString(candidate.jobUrl, 4_000)),
      notes: cleanString(candidate.notes),
      column: COLUMNS.includes(candidate.column as Column) ? candidate.column as Column : 'to_apply',
      status: candidate.status === 'discarded' ? 'discarded' : 'active',
      outcome: OUTCOMES.includes(candidate.outcome as ApplicationOutcome) ? candidate.outcome : undefined,
      evaluation: candidate.evaluation,
    };
    jobs.push({ input, sourceId: input.id });
  }

  const events = schemaVersion === 2 && Array.isArray(payload.events) ? payload.events.map(normalizeEvent).filter((event): event is ApplicationEvent => Boolean(event)) : [];
  if (schemaVersion === 2 && Array.isArray(payload.events)) {
    payload.events.forEach((value, index) => {
      if (!normalizeEvent(value)) issues.push({ index: rawJobs.length + index, reason: 'Event record is invalid.' });
    });
  }
  return {
    schemaVersion,
    jobs,
    events,
    profile: isRecord(payload.profile) ? payload.profile as Profile : undefined,
    preferences: isRecord(payload.preferences) ? payload.preferences as unknown as UserPreferences : undefined,
    issues,
  };
}
