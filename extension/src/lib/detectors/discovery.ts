import type { DetectedJob } from '@/src/types/job';
import { getPlatformForHost } from './registry';

function cardText(root: ParentNode, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const value = (element as HTMLElement | null)?.innerText || element?.textContent;
    const clean = value?.replace(/\s+/g, ' ').trim();
    if (clean) return clean.slice(0, 500);
  }
  return undefined;
}

function collectCards(selectorGroups: string[][]): Element[] {
  for (const selectors of selectorGroups) {
    const cards = [...document.querySelectorAll(selectors.join(','))];
    if (cards.length) return cards;
  }
  return [];
}

function isDetectedJob(job: DetectedJob | null): job is DetectedJob {
  return job !== null;
}

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function linkedInJobId(card: Element, url: string | undefined): string | undefined {
  return card.getAttribute('data-occludable-job-id')
    || card.getAttribute('data-job-id')
    || card.getAttribute('data-entity-urn')?.match(/jobPosting:(\d+)/)?.[1]
    || url?.match(/\/jobs\/view\/(?:[^/]+-)?(\d+)/)?.[1];
}

export function scanLinkedInDiscoveryCards(): DetectedJob[] {
  const detectedAt = new Date().toISOString();
  return collectCards([
    ['li[data-occludable-job-id]', '.jobs-search-results__list-item', '.job-card-container'],
    ['[data-job-id]'],
  ]).map((card): DetectedJob | null => {
    const link = card.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
    const jobUrl = safeHttpUrl(link?.href);
    const jobId = linkedInJobId(card, jobUrl);
    const title = cardText(card, [
      '.job-card-list__title',
      '.artdeco-entity-lockup__title',
      'a[data-control-name*="job"] h3',
      '.base-search-card__title',
      'h3',
    ]);
    const company = cardText(card, [
      '.artdeco-entity-lockup__subtitle',
      '.job-card-container__primary-description',
      'a[data-tracking-control-name*="public-profile"]',
      'a[href*="/company/"]',
    ]);
    if (!title || !company) return null;
    const location = cardText(card, [
      '.job-search__location',
      '.job-search__location-list',
      '.artdeco-entity-lockup__metadata',
    ]);
    const salary = cardText(card, ['.job-search__salary-info', '.base-search-card__metadata']);
    const canonicalUrl = jobUrl || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : undefined);
    if (!canonicalUrl) return null;
    return {
      source: 'linkedin',
      jobId,
      title,
      company,
      location,
      salary,
      jobUrl: canonicalUrl,
      applyUrl: canonicalUrl,
      detection: {
        confidence: jobId ? 0.72 : 0.55,
        warnings: ['Search-card evidence only; open the posting to verify full details.'],
        strategy: 'linkedin-search-card',
        state: 'partial',
        detectedAt,
      },
    } satisfies DetectedJob;
  }).filter(isDetectedJob).slice(0, 100);
}

function indeedJobId(card: Element, url: string | undefined): string | undefined {
  return card.getAttribute('data-jk')
    || card.querySelector('[data-jk]')?.getAttribute('data-jk')
    || url?.match(/[?&](?:jk|vjk)=([^&]+)/)?.[1];
}

export function scanIndeedDiscoveryCards(): DetectedJob[] {
  const detectedAt = new Date().toISOString();
  return collectCards([
    ['.job_seen_beacon', '.cardOutline', '[data-testid="organic_list"] > li'],
    ['[data-jk]'],
    ['a[data-jk]'],
  ]).map((card): DetectedJob | null => {
    const scope = card.matches('a[data-jk]')
      ? card.closest('.job_seen_beacon, .cardOutline, [data-testid="organic_list"] > li') || card
      : card;
    const link = scope.matches('a[href]') ? scope as HTMLAnchorElement : scope.querySelector<HTMLAnchorElement>('a[href*="/viewjob"], a[data-jk], a.jcs-JobTitle');
    const jobUrl = safeHttpUrl(link?.href);
    const jobId = indeedJobId(scope, jobUrl);
    const title = cardText(scope, [
      '[data-testid="jobTitle"]',
      'a.jcs-JobTitle',
      'h2.jobTitle',
      '.jobTitle',
      'h2',
    ])?.replace(/\s*-\s*job post$/i, '');
    const company = cardText(scope, [
      '[data-testid="company-name"]',
      '[data-testid="companyName"]',
      '.companyName',
      '[data-testid="metaInfo"] span',
    ]);
    if (!title || !company || !jobId) return null;
    const canonicalUrl = jobUrl || `https://${location.hostname}/viewjob?jk=${encodeURIComponent(jobId)}`;
    return {
      source: 'indeed',
      jobId,
      title,
      company,
      location: cardText(scope, [
        '[data-testid="text-location"]',
        '.companyLocation',
        '[data-testid="metaInfo"]',
      ]),
      salary: cardText(scope, [
        '[data-testid="attribute_snippet_testid"]',
        '.salary-snippet-container',
        '.estimated-salary',
      ]),
      jobUrl: canonicalUrl,
      applyUrl: canonicalUrl,
      detection: {
        confidence: 0.7,
        warnings: ['Search-card evidence only; open the posting to verify full details.'],
        strategy: 'indeed-search-card',
        state: 'partial',
        detectedAt,
      },
    } satisfies DetectedJob;
  }).filter(isDetectedJob).slice(0, 100);
}

export function scanDiscoveryCards(): DetectedJob[] {
  const platform = getPlatformForHost(location.hostname);
  if (platform?.source === 'linkedin') return scanLinkedInDiscoveryCards();
  if (platform?.source === 'indeed') return scanIndeedDiscoveryCards();
  return [];
}
