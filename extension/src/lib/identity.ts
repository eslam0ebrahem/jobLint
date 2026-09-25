import type { DetectedJob, JobIdentity, JobSource } from '@/src/types/job';

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gh_src',
  'trk',
  'trkInfo',
  'lipi',
  'licu',
  'originalSubdomain',
];

export function sanitizeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function canonicalizeUrl(value: string | undefined): string | undefined {
  const safe = sanitizeExternalUrl(value);
  if (!safe) return undefined;
  try {
    const url = new URL(safe);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
    const uniqueParams = new URLSearchParams();
    for (const key of [...new Set(url.searchParams.keys())].sort()) {
      const value = url.searchParams.get(key);
      if (value !== null) uniqueParams.append(key, value);
    }
    url.search = uniqueParams.toString();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return undefined;
  }
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeIdentityText(value: string | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createJobIdentity(
  job: Pick<DetectedJob, 'source' | 'jobId' | 'jobUrl' | 'title' | 'company'>,
): JobIdentity {
  const sourceJobId = job.jobId?.trim() || undefined;
  const canonicalUrl = canonicalizeUrl(job.jobUrl);
  const fingerprint = hashText(
    [job.source, sourceJobId, canonicalUrl, normalizeIdentityText(job.title), normalizeIdentityText(job.company)].join('|'),
  );
  const key = sourceJobId
    ? `${job.source}:${sourceJobId}`
    : canonicalUrl
      ? `${job.source}:url:${hashText(canonicalUrl)}`
      : `${job.source}:fingerprint:${fingerprint}`;

  return {
    key,
    source: job.source,
    sourceJobId,
    canonicalUrl,
    fingerprint,
  };
}

export function identityMatches(
  identity: JobIdentity | undefined,
  candidate: JobIdentity,
): boolean {
  if (!identity) return false;
  return identity.key === candidate.key || identity.fingerprint === candidate.fingerprint;
}

export function sourceLabel(source: JobSource): string {
  return source === 'linkedin' ? 'LinkedIn' : source === 'indeed' ? 'Indeed' : source === 'manual' ? 'Manual' : 'Other';
}
