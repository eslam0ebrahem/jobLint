import type { DetectedJob } from '@/src/types/job';
import { getText } from './utils';

export function detectLinkedIn(): DetectedJob | null {
  const root =
    document.querySelector(
      '.jobs-search__job-details--container, .jobs-details__main-content, .job-view-layout, main',
    ) || document;

  const urlParams = new URLSearchParams(window.location.search);
  const jobId =
    urlParams.get('currentJobId') ||
    urlParams.get('jobId') ||
    window.location.pathname.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/)?.[1] ||
    root.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
    document
      .querySelector(
        '.jobs-search-results-list__list-item--active, .job-card-container--active',
      )
      ?.getAttribute('data-job-id');

  if (!jobId) return null;

  const title = getText(
    '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1',
    root,
  );

  const company = getText(
    '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a[href*="/company/"]',
    root,
  );

  if (!title || !company) return null;

  const location = getText(
    '.job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor-row',
    root,
  );

  const salary = getText(
    '.job-details-jobs-unified-top-card__job-insight, .salary-main-rail__header',
    root,
  );

  const descEl = root.querySelector('#job-details, .jobs-description__content');
  const description =
    ((descEl as HTMLElement)?.innerText || descEl?.textContent)?.trim() || undefined;

  const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
  const applyBtn = root.querySelector<HTMLAnchorElement>(
    'a.jobs-apply-button, a[data-tracking-control-name*="apply"]',
  );

  return {
    source: 'linkedin',
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
