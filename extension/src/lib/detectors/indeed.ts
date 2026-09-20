import type { DetectedJob } from '@/src/types/job';
import { getText, getDescription } from './utils';

const INDEED_DESCRIPTION_SELECTORS = [
  '#jobDescriptionText',
  '[data-testid="jobDescriptionText"]',
  '#jobsearch-ViewjobPaneWrapper #jobDescriptionText',
  '.jobsearch-JobComponent-description',
  '.jobsearch-jobDescriptionText',
  '#jobDescriptionSection',
  '#viewJobSSRRoot #jobDescriptionText',
  '.simple-job-description-html',
  '.fast-apply-job-description',
  '.react-native-html-content',
];

export function detectIndeed(): DetectedJob | null {
  const root =
    document.querySelector(
      '#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane, #viewJobSSRRoot, [data-testid="jobsearch-ViewjobPaneWrapper"]',
    ) || document;
  const params = new URLSearchParams(location.search);
  const jobId =
    params.get('vjk') ||
    params.get('jk') ||
    root.querySelector('[data-jk]')?.getAttribute('data-jk') ||
    document.querySelector('[data-jk]')?.getAttribute('data-jk');

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
    ) ||
    meta?.[0]?.trim() ||
    getText('[data-testid="company-name"]', document);

  if (!title || !company) return null;

  const jobUrl = `https://${location.hostname}/viewjob?jk=${jobId}`;
  const description = getDescription(INDEED_DESCRIPTION_SELECTORS, root);

  return {
    source: 'indeed',
    jobId,
    title,
    company,
    location:
      getText(
        '[data-testid="inlineHeader-companyLocation"], [data-testid="text-location"]',
        root,
      ) ||
      meta?.at(-1)?.trim() ||
      getText('[data-testid="text-location"]', document),
    salary:
      getText(
        '#salaryInfoAndJobType, [data-testid="jobsearch-JobDescriptionSection-salary"]',
        root,
      ) ||
      getText('[data-testid="jobsearch-JobDescriptionSection-salary"]', document),
    description,
    applyUrl:
      root.querySelector<HTMLAnchorElement>(
        '#indeedApplyButton, a[href*="/apply/"]',
      )?.href ||
      document.querySelector<HTMLAnchorElement>(
        '#indeedApplyButton, a[href*="/apply/"]',
      )?.href ||
      jobUrl,
    jobUrl,
  };
}
