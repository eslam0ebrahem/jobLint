import type { DetectionResult } from '@/src/types/job';
import { detectIndeed } from './indeed';
import { detectLinkedIn } from './linkedin';

export * from './indeed';
export * from './linkedin';

export function detectJob(): DetectionResult | null {
  const { hostname } = window.location;
  const job = hostname.includes('linkedin.com')
    ? detectLinkedIn()
    : hostname.includes('indeed.com')
      ? detectIndeed()
      : null;

  return job ? { job } : null;
}
