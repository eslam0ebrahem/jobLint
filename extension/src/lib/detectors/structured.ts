import type { DetectedJob, JobSource } from '@/src/types/job';

type JsonRecord = Record<string, unknown>;

export interface StructuredJobPosting {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
  requirements?: string;
  jobUrl?: string;
  applyUrl?: string;
  jobId?: string;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  const record = asRecord(value);
  return record ? text(record.name || record.value || record.addressLocality) : undefined;
}

function cleanDescription(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    const content = parsed.body.textContent || '';
    if (content.trim()) return cleanText(content);
  }
  return cleanText(raw.replace(/<[^>]+>/g, ' '));
}

function cleanText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map((line) => line.trim()).join('\n').trim();
}

function findPosting(value: unknown, seen = new Set<unknown>()): JsonRecord | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPosting(item, seen);
      if (found) return found;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record || seen.has(record)) return undefined;
  seen.add(record);
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (types.some((type) => typeof type === 'string' && type.toLowerCase() === 'jobposting')) return record;
  for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
    const found = findPosting(record[key], seen);
    if (found) return found;
  }
  return undefined;
}

function address(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return text(value);
  const nested = asRecord(record.address) || record;
  const parts = [nested.addressLocality, nested.addressRegion, nested.addressCountry]
    .map((part) => text(part))
    .filter((part): part is string => Boolean(part));
  return parts.join(', ') || text(nested.name) || text(record.name) || text(value);
}

function salary(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return text(value);
  const currency = text(record.currency) || '';
  const raw = asRecord(record.value) || record;
  const min = raw.minValue ?? raw.min;
  const max = raw.maxValue ?? raw.max;
  const unit = text(raw.unitText) || '';
  if (min === undefined && max === undefined) return undefined;
  const range = [min, max].filter((part) => part !== undefined).join('–');
  return [currency, range, unit].filter(Boolean).join(' ').trim() || undefined;
}

function jobIdFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.pathname.match(/\/(?:jobs\/view|viewjob)\/(?:[^/]+\/)?(\d+)/i)?.[1]
      || url.searchParams.get('jk')
      || url.searchParams.get('vjk')
      || undefined;
  } catch {
    return undefined;
  }
}

export function getCanonicalUrl(): string | undefined {
  const value = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (!value) return undefined;
  try {
    const url = new URL(value, location.href);
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function extractStructuredJob(source: JobSource, canonicalUrl?: string): StructuredJobPosting | undefined {
  void source;
  const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')];
  let posting: JsonRecord | undefined;
  for (const script of scripts) {
    try {
      posting = findPosting(JSON.parse(script.textContent || ''));
    } catch {
      // Invalid third-party JSON-LD should not break DOM detection.
    }
    if (posting) break;
  }
  if (!posting) return undefined;
  const organization = asRecord(posting.hiringOrganization);
  const locationValue = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
  const location = address(locationValue);
  const postingUrl = text(posting.url);
  const url = canonicalUrl || postingUrl;
  const identifier = asRecord(posting.identifier);
  const title = text(posting.title);
  const company = text(organization?.name) || text(posting.hiringOrganization);
  if (!title || !company) return undefined;
  const qualifications = asRecord(posting.qualifications);
  const responsibilities = asRecord(posting.responsibilities);
  return {
    title,
    company,
    location,
    salary: salary(posting.baseSalary) || salary(posting.estimatedSalary),
    description: cleanDescription(posting.description),
    requirements: [qualifications && cleanDescription(qualifications), responsibilities && cleanDescription(responsibilities)].filter(Boolean).join('\n\n') || undefined,
    jobUrl: url,
    applyUrl: postingUrl && postingUrl !== url ? postingUrl : undefined,
    jobId: text(identifier?.value) || text(identifier?.name) || jobIdFromUrl(postingUrl) || jobIdFromUrl(url),
  };
}

export function mergeStructuredJob(job: DetectedJob, structured: StructuredJobPosting | undefined, source: JobSource): DetectedJob {
  if (!structured) return job;
  return {
    ...job,
    source,
    jobId: job.jobId || structured.jobId,
    title: structured.title || job.title,
    company: structured.company || job.company,
    location: job.location || structured.location,
    salary: job.salary || structured.salary,
    description: job.description || structured.description,
    requirements: job.requirements || structured.requirements,
    jobUrl: job.jobUrl || structured.jobUrl,
    applyUrl: job.applyUrl || structured.applyUrl,
  };
}
