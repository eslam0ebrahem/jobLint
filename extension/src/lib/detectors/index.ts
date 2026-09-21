import type { DetectedJob } from '@/src/types/job';
import { detectIndeed } from './indeed';
import { detectLinkedIn } from './linkedin';

export function detectJob(): DetectedJob | null {
  const host = location.hostname;
  return host.includes('linkedin.com')
    ? detectLinkedIn()
    : host.includes('indeed.')
      ? detectIndeed()
      : null;
}
