import type { JobSource } from '@/src/types/job';

export interface PlatformDefinition {
  source: JobSource;
  label: string;
  hosts: string[];
  matches: string[];
}

export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  {
    source: 'linkedin',
    label: 'LinkedIn',
    hosts: ['linkedin.com'],
    matches: ['*://*.linkedin.com/*'],
  },
  {
    source: 'indeed',
    label: 'Indeed',
    hosts: ['indeed.com', 'indeed.co.uk', 'indeed.ca', 'indeed.es', 'indeed.fr', 'indeed.de', 'indeed.it', 'indeed.nl', 'indeed.com.mx'],
    matches: [
      '*://*.indeed.com/*', '*://*.indeed.co.uk/*', '*://*.indeed.ca/*', '*://*.indeed.es/*',
      '*://*.indeed.fr/*', '*://*.indeed.de/*', '*://*.indeed.it/*', '*://*.indeed.nl/*', '*://*.indeed.com.mx/*',
    ],
  },
];

export const SUPPORTED_MATCH_PATTERNS = PLATFORM_DEFINITIONS.flatMap((platform) => platform.matches);
export const SUPPORTED_HOST_PERMISSIONS = [...new Set(PLATFORM_DEFINITIONS.flatMap((platform) => platform.hosts.map((host) => `*://*.${host}/*`)))];

export function getPlatformForHost(hostname: string): PlatformDefinition | undefined {
  const host = hostname.toLowerCase();
  return PLATFORM_DEFINITIONS.find((platform) => platform.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)));
}
