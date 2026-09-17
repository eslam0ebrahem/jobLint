import type { DetectionResult } from '@/src/types/job';
import { detectLinkedIn } from './linkedin';

export * from './linkedin';

export function detectJob(): DetectionResult | null {
  const hostname = window.location.hostname;
  let job = null;

  if (hostname.includes('linkedin.com')) {
    job = detectLinkedIn();
  }
  return job ? { job } : null;
}
