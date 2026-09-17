import type { DetectedJob } from '@/src/types/job';
import { getText } from './utils';

export function detectIndeed(): DetectedJob | null {
  const root =
    document.querySelector(
      '#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane, #viewJobSSRRoot',
    ) || document;

  const urlParams = new URLSearchParams(window.location.search);
  const jobId =
    urlParams.get('vjk') ||
    urlParams.get('jk') ||
    root.querySelector('[data-jk]')?.getAttribute('data-jk') ||
    document.querySelector('[data-jk]')?.getAttribute('data-jk');

  if (!jobId) return null;

  const title =
    getText(
      'h1, [data-testid="jobsearch-JobInfoHeader-title"], [data-testid="vj-job-title"]',
      root,
    )?.replace(/\s*-\s*job post$/i, '') ||
    document.title.split(' - ')[0]?.trim();

  const metaText = (
    root.querySelector('[data-testid="company-info-metadata"]') as HTMLElement
  )?.innerText
    ?.split('\n')
    .filter(Boolean);

  const company =
    getText(
      '[data-testid="inlineHeader-companyName"], [data-testid="company-name"], .jobsearch-CompanyInfoContainer',
      root,
    ) || metaText?.[0]?.trim();

  if (!title || !company) return null;

  const location =
    getText(
      '[data-testid="inlineHeader-companyLocation"], [data-testid="text-location"]',
      root,
    ) || (metaText && metaText.length > 1 ? metaText[metaText.length - 1]?.trim() : undefined);

  const salary = getText(
    '#salaryInfoAndJobType, [data-testid="jobsearch-JobDescriptionSection-salary"], [data-testid="vj-job-salary"]',
    root,
  );

  const descEl = root.querySelector(
    '#jobDescriptionText, .simple-job-description-html, .react-native-html-content',
  );
  const description =
    ((descEl as HTMLElement)?.innerText || descEl?.textContent)?.trim() || undefined;

  const jobUrl = `https://${window.location.hostname}/viewjob?jk=${jobId}`;
  const applyBtn = root.querySelector<HTMLAnchorElement>(
    '#indeedApplyButton, [data-testid="indeedApplyButton"], a[href*="/apply/"]',
  );

  return {
    source: 'indeed',
    jobId,
    title,
    company,
    location,
    salary,
    description,
    applyUrl: applyBtn?.href || jobUrl,
    jobUrl,
  };
}
