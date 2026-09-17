import type { DetectedJob } from '@/src/types/job';
import { getText, parseJsonLd } from './utils';

function getLinkedInJobId(
  root: ParentNode = document,
  topCard: ParentNode = document,
  jsonLdJobId?: string,
): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('currentJobId') || urlParams.get('jobId');
  if (paramId && /^\d+$/.test(paramId)) return paramId;

  const pathMatch = window.location.pathname.match(
    /\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/,
  );
  if (pathMatch?.[1]) return pathMatch[1];

  const linkMatch = (
    topCard.querySelector('a[href*="/jobs/view/"]') ||
    root.querySelector('a[href*="/jobs/view/"]')
  )
    ?.getAttribute('href')
    ?.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/);
  if (linkMatch?.[1]) return linkMatch[1];

  const dataJobId =
    (topCard as HTMLElement).getAttribute?.('data-job-id') ||
    topCard.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
    root.querySelector('[data-job-id]')?.getAttribute('data-job-id');
  if (dataJobId && /^\d+$/.test(dataJobId)) return dataJobId;

  const urnMatch = (
    topCard.querySelector('[data-entity-urn]') ||
    root.querySelector('[data-entity-urn]')
  )
    ?.getAttribute('data-entity-urn')
    ?.match(/(?:jobPosting|job):(\d+)/);
  if (urnMatch?.[1]) return urnMatch[1];

  if (jsonLdJobId && /^\d+$/.test(jsonLdJobId)) return jsonLdJobId;

  return undefined;
}

export function detectLinkedIn(): DetectedJob | null {
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const isLinkedInJob =
    pathname.includes('/jobs/view/') ||
    pathname.includes('/jobs/') ||
    searchParams.has('currentJobId') ||
    searchParams.has('jobId');

  if (!isLinkedInJob) return null;

  const root =
    document.querySelector(
      '.jobs-search__job-details--container, .jobs-details__main-content, .job-view-layout, .details, main',
    ) || document;
  const topCard =
    root.querySelector(
      '.job-details-jobs-unified-top-card, .jobs-unified-top-card, .top-card-layout, .topcard',
    ) || root;
  const jsonLd = parseJsonLd();

  const jobId = getLinkedInJobId(root, topCard, jsonLd.jobId);
  if (!jobId) return null;

  const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;

  const title =
    jsonLd.title ||
    getText(
      '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .top-card-layout__title, h1.t-24, h1',
      root,
    );
  const company =
    jsonLd.company ||
    getText(
      '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__flavor--black-link, a[data-tracking-control-name*="company_name"]',
      root,
    );
  if (!title || !company) return null;

  const workplaceType = getText(
    '.job-details-jobs-unified-top-card__workplace-type, .jobs-unified-top-card__workplace-type',
    root,
  );
  const locationText = Array.from(
    root
      .querySelector(
        '.job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor-row',
      )
      ?.querySelectorAll(
        'span, .jobs-unified-top-card__bullet, .topcard__flavor--bullet',
      ) || [],
  )
    .map((element) => element.textContent?.trim())
    .find((text) => text && text !== '·' && !/ago|applicant/i.test(text));
  const jobLocation =
    jsonLd.location ||
    (locationText
      ? workplaceType && !locationText.includes(workplaceType)
        ? `${locationText} (${workplaceType})`
        : locationText
      : workplaceType);

  const salaryElement = Array.from(
    topCard.querySelectorAll(
      '.job-details-jobs-unified-top-card__job-insight, .topcard__flavor, .salary-main-rail__header',
    ),
  ).find(
    (element) =>
      !element.closest(
        '.main-job-card, [data-tracking-control-name*="similar-jobs"], .base-card',
      ) &&
      /[\$€£¥₹\d]/.test(element.textContent || '') &&
      (/[\/\-]/i.test(element.textContent || '') ||
        /year|hour|month/i.test(element.textContent || '')),
  );
  const salary =
    jsonLd.salary ||
    salaryElement?.textContent?.split('·')[0]?.replace(/\s+/g, ' ').trim();

  const requirements =
    Array.from(
      root.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight, .description__job-criteria-item',
      ),
    )
      .filter(
        (element) =>
          !element.closest(
            '.main-job-card, [data-tracking-control-name*="similar-jobs"], .base-card',
          ),
      )
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | ') || undefined;

  const description =
    jsonLd.description ||
    getText(
      '#job-details, .jobs-description__content, .jobs-description-content__text, .show-more-less-html__markup',
      root,
    );
  const applyButton = root.querySelector(
    'a.jobs-apply-button, a[data-tracking-control-name*="apply"]',
  ) as HTMLAnchorElement | null;

  return {
    source: 'linkedin',
    jobId,
    title,
    company,
    location: jobLocation,
    salary,
    requirements,
    description,
    applyUrl: applyButton?.href || jobUrl,
    jobUrl,
  };
}
