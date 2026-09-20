import type { DetectedJob } from '@/src/types/job';
import { getText, getDescription } from './utils';

const LINKEDIN_DESCRIPTION_SELECTORS = [
  '#job-details .show-more-less-html__markup',
  '#job-details',
  '.jobs-description__content .show-more-less-html__markup',
  '.jobs-description__content',
  '.jobs-description-content__text',
  '.show-more-less-html__markup',
  '.description__text',
  'article.jobs-description__container',
  '.jobs-box__html-content',
  '.jobs-description__details',
  '.jobs-description',
  'section.show-more-less-html',
  '[data-job-id] .jobs-description',
];

export function detectLinkedIn(): DetectedJob | null {
  // Target the right-hand detail pane or standalone/guest view
  const detailPane = document.querySelector(
    '.scaffold-layout__detail, .jobs-search__job-details, .job-view-layout, .jobs-details__main-content, .core-rail',
  );
  const root = detailPane || document;

  const params = new URLSearchParams(location.search);
  const jobId =
    params.get('currentJobId') ||
    params.get('jobId') ||
    location.pathname.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/)?.[1] ||
    root.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
    document
      .querySelector(
        '.jobs-search-results-list__list-item--active, .job-card-container--active',
      )
      ?.getAttribute('data-job-id') ||
    document.querySelector('[data-job-id]')?.getAttribute('data-job-id');

  if (!jobId) return null;

  const title =
    getText(
      '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .top-card-layout__title, h1',
      root,
    ) || getText('h1', document);

  const company =
    getText(
      '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__flavor, a[href*="/company/"]',
      root,
    ) || getText('.topcard__flavor, a[href*="/company/"]', document);

  if (!title || !company) return null;

  const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
  const description = getDescription(LINKEDIN_DESCRIPTION_SELECTORS, root);

  return {
    source: 'linkedin',
    jobId,
    title,
    company,
    location:
      getText(
        '.job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor-row, .topcard__flavor--bullet',
        root,
      ) || getText('.topcard__flavor-row', document),
    salary:
      getText(
        '.job-details-jobs-unified-top-card__job-insight, .salary-main-rail__header',
        root,
      ) || getText('.job-details-jobs-unified-top-card__job-insight', document),
    description,
    applyUrl:
      root.querySelector<HTMLAnchorElement>(
        'a.jobs-apply-button, a[data-tracking-control-name*="apply"]',
      )?.href ||
      document.querySelector<HTMLAnchorElement>(
        'a.jobs-apply-button, a[data-tracking-control-name*="apply"]',
      )?.href ||
      jobUrl,
    jobUrl,
  };
}
