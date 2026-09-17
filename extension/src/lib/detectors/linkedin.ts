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

  const jobLink =
    topCard.querySelector('a[href*="/jobs/view/"]') ||
    root.querySelector('a[href*="/jobs/view/"]');
  const linkMatch = jobLink
    ?.getAttribute('href')
    ?.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/);
  if (linkMatch?.[1]) return linkMatch[1];

  const dataJobId =
    (topCard as HTMLElement).getAttribute?.('data-job-id') ||
    (root as HTMLElement).getAttribute?.('data-job-id') ||
    topCard.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
    root.querySelector('[data-job-id]')?.getAttribute('data-job-id');
  if (dataJobId && /^\d+$/.test(dataJobId)) return dataJobId;

  const urnEl = (topCard as HTMLElement).getAttribute?.('data-entity-urn')
    ? topCard
    : topCard.querySelector(
        '[data-entity-urn*="jobPosting"], [data-entity-urn*="job:"]',
      ) ||
      root.querySelector(
        '[data-entity-urn*="jobPosting"], [data-entity-urn*="job:"]',
      );
  const urn = (urnEl as HTMLElement)?.getAttribute?.('data-entity-urn');
  const urnMatch = urn?.match(/(?:jobPosting|job):(\d+)/);
  if (urnMatch?.[1]) return urnMatch[1];

  const activeCard = document.querySelector(
    '.jobs-search-results-list__list-item--active, .job-card-container--active, [data-occludable-job-id].active',
  );
  const activeCardId =
    activeCard?.getAttribute('data-job-id') ||
    activeCard?.getAttribute('data-occludable-job-id') ||
    activeCard?.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
    activeCard
      ?.querySelector('a[href*="/jobs/view/"]')
      ?.getAttribute('href')
      ?.match(/\/jobs\/view\/(?:[^\s/?#]+-)?(\d+)/)?.[1];
  if (activeCardId && /^\d+$/.test(activeCardId)) return activeCardId;

  if (jsonLdJobId && /^\d+$/.test(jsonLdJobId)) return jsonLdJobId;

  const globalJobId =
    document
      .querySelector('[data-current-job-id]')
      ?.getAttribute('data-current-job-id') ||
    document.querySelector('[data-job-id]')?.getAttribute('data-job-id');
  if (globalJobId && /^\d+$/.test(globalJobId)) return globalJobId;

  return undefined;
}

export function detectLinkedIn(): DetectedJob | null {
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
  const jobUrl = jobId
    ? `https://www.linkedin.com/jobs/view/${jobId}/`
    : window.location.href.split('?')[0];

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
