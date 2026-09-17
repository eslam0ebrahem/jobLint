import type { DetectedJob } from '@/src/types/job';
import { getText } from './utils';

export function detectIndeed(): DetectedJob | null {
  const root =
    document.querySelector(
      '#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane, #viewJobSSRRoot',
    ) || document;
  const params = new URLSearchParams(location.search);
  const jobId =
    params.get('vjk') ||
    params.get('jk') ||
    root.querySelector('[data-jk]')?.getAttribute('data-jk');

  if (!jobId) return null;

  const title =
    getText(
      'h1, [data-testid="jobsearch-JobInfoHeader-title"], [data-testid="vj-job-title"]',
      root,
    )?.replace(/\s*-\s*job post$/i, '') || document.title.split(' - ')[0]?.trim();

  const meta = (
    root.querySelector('[data-testid="company-info-metadata"]') as HTMLElement
  )?.innerText
    ?.split('\n')
    .filter(Boolean);

  const company =
    getText(
      '[data-testid="inlineHeader-companyName"], [data-testid="company-name"]',
      root,
    ) || meta?.[0]?.trim();

  if (!title || !company) return null;

  const jobUrl = `https://${location.hostname}/viewjob?jk=${jobId}`;
  return {
    source: 'indeed',
    jobId,
    title,
    company,
    location:
      getText(
        '[data-testid="inlineHeader-companyLocation"], [data-testid="text-location"]',
        root,
      ) || meta?.at(-1)?.trim(),
    salary: getText(
      '#salaryInfoAndJobType, [data-testid="jobsearch-JobDescriptionSection-salary"]',
      root,
    ),
    description: getText(
      '#jobDescriptionText, .simple-job-description-html, .react-native-html-content',
      root,
    ),
    applyUrl:
      root.querySelector<HTMLAnchorElement>(
        '#indeedApplyButton, a[href*="/apply/"]',
      )?.href || jobUrl,
    jobUrl,
  };
}
