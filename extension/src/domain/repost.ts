import type { DetectedJob, Job } from '@/src/types/job';
import { contentHash } from './dossier';

export const MAX_POSTING_DESCRIPTION = 20_000;

/** Fields a candidate would care about when a posting is re-listed or edited. */
export const TRACKED_POSTING_FIELDS = [
  'title',
  'company',
  'location',
  'salary',
  'description',
  'requirements',
  'jobUrl',
  'applyUrl',
] as const satisfies readonly (keyof DetectedJob)[];

/** Only these two count as the posting body actually changing. */
const CONTENT_FIELDS = new Set<keyof DetectedJob>(['description', 'requirements']);

export type PostingField = (typeof TRACKED_POSTING_FIELDS)[number];

export interface PostingFieldChange {
  field: PostingField;
  before?: string;
  after?: string;
}

export interface PostingDiff {
  changed: boolean;
  /** The description or requirements changed, not just the title or a URL. */
  contentChanged: boolean;
  beforeHash: string;
  afterHash: string;
  fields: PostingFieldChange[];
  /** Bounded, human-readable summary safe to persist in event metadata. */
  summary: string;
}

type PostingLike = Pick<DetectedJob, 'title' | 'company'> & Partial<DetectedJob>;

/** The exact text a dossier would freeze, shared so the hashes always agree. */
export function capturedDescription(job: PostingLike): string {
  return (job.description || job.requirements || '').slice(0, MAX_POSTING_DESCRIPTION);
}

export function postingContentHash(job: PostingLike): string {
  return contentHash([
    job.title,
    job.company,
    job.location,
    capturedDescription(job),
    job.requirements,
    job.salary,
    job.jobUrl,
    job.applyUrl,
  ]);
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function preview(value: string | undefined, limit = 60): string | undefined {
  const text = normalize(value);
  if (!text) return undefined;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function diffPostings(previous: Job | PostingLike, next: Job | PostingLike): PostingDiff {
  const beforeHash = postingContentHash(previous);
  const afterHash = postingContentHash(next);
  const fields: PostingFieldChange[] = [];
  for (const field of TRACKED_POSTING_FIELDS) {
    const before = normalize(previous[field]);
    const after = normalize(next[field]);
    if (before === after) continue;
    fields.push({ field, before: preview(before), after: preview(after) });
  }
  const contentChanged = fields.some((change) => CONTENT_FIELDS.has(change.field));
  return {
    changed: fields.length > 0,
    contentChanged,
    beforeHash,
    afterHash,
    fields,
    summary: summarize(fields),
  };
}

function summarize(fields: PostingFieldChange[]): string {
  if (!fields.length) return 'No change detected.';
  return fields
    .map((change) => {
      const before = change.before ?? '(empty)';
      const after = change.after ?? '(empty)';
      return `${change.field}: ${before} → ${after}`;
    })
    .join(' · ')
    .slice(0, 1_000);
}
