import type { DetectedJob } from '@/src/types/job';
import { extractStructuredJob, getCanonicalUrl } from './structured';
import { getText, getDescription } from './utils';

const LINKEDIN_DESCRIPTION_SELECTORS = [
  '.show-more-less-html__markup',
  '#job-details .show-more-less-html__markup',
  '#job-details',
  '.description__text',
  '.jobs-description__content .show-more-less-html__markup',
  '.jobs-description__content',
  '.jobs-description-content__text',
  'section.show-more-less-html',
  'article.jobs-description__container',
  '.jobs-box__html-content',
  '.jobs-description__details',
  '.jobs-description',
  '[data-job-id] .jobs-description',
];

export function detectLinkedIn(): DetectedJob | null {
  const structured = extractStructuredJob('linkedin', getCanonicalUrl());
  const structuredComplete = Boolean(structured?.title && structured.company);
  if (
    document.getElementById('error404') ||
    document.querySelector('.page-not-found, #error404, .error-container, [data-lang-error]') ||
    document.title?.toLowerCase().includes('page not found') ||
    document.title?.toLowerCase().startsWith('error')
  ) {
    return null;
  }

  const hasJobContainer = !!document.querySelector(
    '.scaffold-layout__detail, .jobs-search__job-details, .job-view-layout, .jobs-details__main-content, .core-rail, [data-view-name="job-details"]',
  );

  const isJobRoute =
    location.pathname.includes('/jobs/view/') ||
    location.pathname.includes('/jobs/search') ||
    location.pathname.includes('/jobs/collections') ||
    location.pathname.includes('/jobs/tracker');

  if (!isJobRoute && !hasJobContainer && !structuredComplete) {
    return null;
  }

  if (!structuredComplete && /\/jobs\/\d+\/?$/.test(location.pathname)) {
    return null;
  }

  const detailPane = document.querySelector(
    '.scaffold-layout__detail, .jobs-search__job-details, .job-view-layout, .jobs-details__main-content, .core-rail, [data-view-name="job-details"]',
  );
  const root = detailPane || document;

  const params = new URLSearchParams(location.search);

  let jobId: string | undefined | null =
    location.pathname.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/)?.[1] ||
    params.get('currentJobId') ||
    params.get('jobId');

  if (!jobId) {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const match = canonical?.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/);
    if (match?.[1]) jobId = match[1];
  }

  if (!jobId) {
    const lnkdMeta = document.querySelector<HTMLMetaElement>('meta[property="lnkd:url"]')?.content;
    const match = lnkdMeta?.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/);
    if (match?.[1]) jobId = match[1];
  }

  if (!jobId) {
    const activeViewLink = root.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
    const match = activeViewLink?.href.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/);
    if (match?.[1]) jobId = match[1];
  }

  if (!jobId) {
    const activeItem = document.querySelector(
      '.jobs-search-results-list__list-item--active, .job-card-container--active',
    );
    jobId =
      activeItem?.getAttribute('data-job-id') ||
      activeItem?.getAttribute('data-occludable-job-id') ||
      activeItem?.getAttribute('data-entity-urn')?.match(/jobPosting:(\d+)/)?.[1];
  }

  if (!jobId && !structuredComplete) return null;

  // 4. Resolve Job Title
  let title =
    structured?.title ||
    getText(
      '.top-card-layout__title, .topcard__title, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, [data-view-name="job-details"] h1, h1, h2.t-24',
      root,
    ) ||
    getText(
      '.jobs-search-results-list__list-item--active .job-card-list__title, .job-card-container--active .job-card-list__title, .jobs-search-results-list__list-item--active a[data-control-name*="job"]',
      document,
    ) ||
    getText('.top-card-layout__title, .topcard__title, h1', document);

  if (!title && document.title && document.title.includes('|')) {
    title = document.title.split('|')[0]?.split('—')[0]?.replace(/\bat\b.*$/i, '').trim();
  }

  if (
    !title ||
    title.toLowerCase().includes('page not found') ||
    title.toLowerCase() === 'linkedin' ||
    title.toLowerCase().includes('sign in')
  ) {
    return null;
  }

  let company =
    structured?.company ||
    getText(
      'a.topcard__org-name-link, .topcard__flavor a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, [data-view-name="job-details"] a[href*="/company/"], a[href*="/company/"]',
      root,
    ) ||
    getText(
      '.jobs-search-results-list__list-item--active .artdeco-entity-lockup__subtitle, .job-card-container--active .artdeco-entity-lockup__subtitle, .jobs-search-results-list__list-item--active .job-card-container__primary-description',
      document,
    ) ||
    getText('.topcard__flavor', document);

  if (!company && document.title && document.title.includes('|')) {
    company = document.title.split('|')[0]?.split('—')[0]?.split(/\bat\b/i)[1]?.trim();
  }

  if (!company || company.toLowerCase() === 'linkedin') return null;

  const jobUrl = structured?.jobUrl || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : location.href);

  const description =
    getDescription(LINKEDIN_DESCRIPTION_SELECTORS, root) ||
    getDescription(LINKEDIN_DESCRIPTION_SELECTORS, document) ||
    structured?.description;

  return {
    source: 'linkedin',
    jobId: jobId || structured?.jobId,
    title,
    company,
    location:
      structured?.location ||
      getText(
        '.topcard__flavor--bullet, .job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor-row',
        root,
      ) || getText('.topcard__flavor-row', document),
    salary:
      structured?.salary ||
      getText(
        '.job-details-jobs-unified-top-card__job-insight, .salary-main-rail__header',
        root,
      ) || getText('.job-details-jobs-unified-top-card__job-insight', document),
    description,
    requirements: structured?.requirements,
    applyUrl: structured?.applyUrl ||
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
