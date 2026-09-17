import type { DetectionResult } from '@/src/types/job';
import { detectIndeed } from './indeed';
import { detectLinkedIn } from './linkedin';

export * from './indeed';
export * from './linkedin';

export function detectJob(): DetectionResult | null {
  const hostname = window.location.hostname;
  let job = null;

  if (hostname.includes('linkedin.com')) {
    job = detectLinkedIn();
  } else if (hostname.includes('indeed.com')) {
    job = detectIndeed();
  }
  console.log(job);

  return job ? { job } : null;
}
