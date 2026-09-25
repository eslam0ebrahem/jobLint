import type { DiscoveryInboxSnapshot, DiscoveryRecord, DiscoveryStatus } from '@/src/types/discovery';
import type { DetectedJob, JobEvaluation } from '@/src/types/job';
import { canonicalizeUrl, createJobIdentity, sanitizeExternalUrl } from './identity';
import { cleanString, isRecord } from './shared';

export interface DiscoveryCandidate {
  id: string;
  identity: ReturnType<typeof createJobIdentity>;
  job: DetectedJob;
  revisitUrl: string;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function boundedNumber(value: unknown, fallback: number, maximum = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, value))
    : fallback;
}

function normalizeDetection(value: unknown, timestamp: string): DetectedJob['detection'] {
  const input = isRecord(value) ? value : {};
  const state = input.state === 'detected' ? 'detected' : 'partial';
  const warnings = Array.isArray(input.warnings)
    ? input.warnings.filter((warning): warning is string => typeof warning === 'string').map((warning) => warning.trim()).filter(Boolean).slice(0, 10)
    : [];
  if (!warnings.includes('Search-card evidence only; open the posting to verify full details.')) {
    warnings.push('Search-card evidence only; open the posting to verify full details.');
  }
  return {
    confidence: boundedNumber(input.confidence, state === 'detected' ? 0.72 : 0.55),
    warnings,
    strategy: cleanString(input.strategy, 100) || 'search-card-scan',
    state,
    detectedAt: cleanString(input.detectedAt, 100) || timestamp,
  };
}

/** Runtime-safe normalization for jobs crossing from a content script into the background. */
export function normalizeDiscoveryCandidate(value: unknown, timestamp: string): DiscoveryCandidate | undefined {
  if (!isRecord(value) || (value.source !== 'linkedin' && value.source !== 'indeed')) return undefined;
  const title = cleanString(value.title, 500);
  const company = cleanString(value.company, 500);
  if (!title || !company) return undefined;
  const jobUrl = canonicalizeUrl(cleanString(value.jobUrl, 4_000))
    || canonicalizeUrl(cleanString(value.applyUrl, 4_000));
  if (!jobUrl) return undefined;
  const job: DetectedJob = {
    source: value.source,
    jobId: cleanString(value.jobId, 500),
    title,
    company,
    location: cleanString(value.location, 1_000),
    salary: cleanString(value.salary, 1_000),
    requirements: cleanString(value.requirements),
    description: cleanString(value.description),
    applyUrl: sanitizeExternalUrl(cleanString(value.applyUrl, 4_000)) || jobUrl,
    jobUrl,
    detection: normalizeDetection(value.detection, timestamp),
  };
  const identity = createJobIdentity(job);
  return {
    id: `discovery-${hashText(identity.key)}`,
    identity,
    job,
    revisitUrl: jobUrl,
  };
}

export function buildDiscoveryRecord(
  candidate: DiscoveryCandidate,
  evaluation: JobEvaluation,
  existing: DiscoveryRecord | undefined,
  timestamp: string,
): DiscoveryRecord {
  return {
    id: candidate.id,
    identity: candidate.identity,
    job: candidate.job,
    evaluation,
    status: existing?.status || 'new',
    capturedAt: existing?.capturedAt || timestamp,
    updatedAt: timestamp,
    savedJobId: existing?.savedJobId,
  };
}

function byInboxOrder(a: DiscoveryRecord, b: DiscoveryRecord): number {
  const statusOrder: Record<DiscoveryStatus, number> = { new: 0, saved: 1, dismissed: 2 };
  return statusOrder[a.status] - statusOrder[b.status] || b.updatedAt.localeCompare(a.updatedAt);
}

export function createDiscoveryInbox(
  records: DiscoveryRecord[],
  scan?: { scannedAt: string; detectedCount: number; addedCount: number; refreshedCount: number },
): DiscoveryInboxSnapshot {
  const items = [...records].sort(byInboxOrder);
  return {
    items,
    newCount: items.filter((item) => item.status === 'new').length,
    savedCount: items.filter((item) => item.status === 'saved').length,
    dismissedCount: items.filter((item) => item.status === 'dismissed').length,
    scannedAt: scan?.scannedAt,
    detectedCount: scan?.detectedCount || 0,
    addedCount: scan?.addedCount || 0,
    refreshedCount: scan?.refreshedCount || 0,
  };
}
