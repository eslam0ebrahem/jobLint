import type { DetectedJob, DetectorHealth } from '@/src/types/job';
import { getPlatformForHost } from './registry';
import { detectIndeed } from './indeed';
import { detectLinkedIn } from './linkedin';

function healthFor(job: DetectedJob | null, platform: ReturnType<typeof getPlatformForHost>): Omit<DetectorHealth, 'tabId' | 'url'> {
  const source = platform?.source || 'other';
  const label = platform?.label || 'This page';
  if (!job) {
    return {
      source,
      label,
      state: 'unrecognized',
      strategy: 'none',
      confidence: 0,
      warnings: ['No complete job posting was detected on this page.'],
    };
  }
  const warnings = [...(job.detection?.warnings || [])];
  const hasCoreFields = Boolean(job.title && job.company);
  return {
    source,
    label,
    state: hasCoreFields && job.description ? 'detected' : 'partial',
    strategy: job.detection?.strategy || `${source}-dom`,
    confidence: job.detection?.confidence || 0.5,
    warnings,
    jobId: job.jobId,
    title: job.title,
    company: job.company,
  };
}

export function detectJob(): DetectedJob | null {
  const platform = getPlatformForHost(location.hostname);
  if (!platform) return null;
  const job = platform.source === 'linkedin' ? detectLinkedIn() : detectIndeed();
  if (!job) return null;
  const warnings: string[] = [];
  if (!job.description) warnings.push('Job description was not found.');
  if (!job.location) warnings.push('Location was not found.');
  if (!job.salary) warnings.push('Salary was not found.');
  return {
    ...job,
    detection: {
      confidence: job.description ? 0.86 : 0.58,
      warnings,
      strategy: `${platform.source}-layered-dom`,
      state: job.description ? 'detected' : 'partial',
      detectedAt: new Date().toISOString(),
    },
  };
}

export function getDetectorHealth(tabId: number, url: string): DetectorHealth {
  let platform: ReturnType<typeof getPlatformForHost>;
  try {
    platform = getPlatformForHost(new URL(url).hostname);
  } catch {
    platform = undefined;
  }
  const job = platform?.source === 'linkedin' ? detectLinkedIn() : platform?.source === 'indeed' ? detectIndeed() : null;
  return { tabId, url, ...healthFor(job, platform) };
}
