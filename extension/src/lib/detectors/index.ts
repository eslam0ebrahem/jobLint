import type { DetectionResult } from '@/src/types/job';
import { detectIndeed } from './indeed';
import { detectLinkedIn } from './linkedin';

export function detectJob(): DetectionResult | null {
  const host = location.hostname;
  const job = host.includes('linkedin.com')
    ? detectLinkedIn()
    : host.includes('indeed.')
      ? detectIndeed()
      : null;

  return job ? { job } : null;
}
