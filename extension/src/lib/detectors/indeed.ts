import type { DetectedJob } from '@/src/types/job';
import { getText, parseJsonLd } from './utils';

function getIndeedJobId(): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('vjk') || urlParams.get('jk');
  if (paramId) return paramId;

  const canonical = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href');
  const canonicalMatch = canonical?.match(
    /(?:[?&]jk=|\/viewjob\?jk=)([a-zA-Z0-9]+)/,
  );
  if (canonicalMatch?.[1]) return canonicalMatch[1];

  return (
    document
      .querySelector(
        '#jobsearch-ViewJobPaneWrapper [data-jk], [data-testid="viewJob-pane"] [data-jk], [data-jk].selected, [data-jk]',
      )
      ?.getAttribute('data-jk') ||
    document
      .querySelector('#indeedApplyButton, [data-testid="indeedApplyButton"]')
      ?.getAttribute('data-jobsearch-apply-jobkey') ||
    undefined
  );
}

export function detectIndeed(): DetectedJob | null {
  const urlParams = new URLSearchParams(window.location.search);
  const isIndeedJob =
    urlParams.has('vjk') ||
    urlParams.has('jk') ||
    window.location.pathname.includes('/viewjob') ||
    window.location.pathname.includes('/rc/clk');

  const jsonLd = parseJsonLd();
  const jobId = getIndeedJobId() || jsonLd.jobId;
  if (!jobId || !isIndeedJob) return null;

  const root =
    document.querySelector(
      '#jobsearch-ViewJobPaneWrapper, #viewJobSSRRoot, .jobsearch-ViewJob, .jobsearch-JobComponent, .jobsearch-RightPane, [data-testid="viewJob-pane"], main',
    ) || document;

  const title =
    jsonLd.title ||
    getText(
      '[data-testid="jobsearch-JobInfoHeader-title"], [data-testid*="jobTitle"], [data-testid*="JobInfoHeader-title"], h2.jobTitle, h1',
      root,
    )?.replace(/\s*-\s*job post$/i, '');
  const company =
    jsonLd.company ||
    getText(
      '[data-testid="inlineHeader-companyName"], [data-testid="company-name"], [class*="companyName"]',
      root,
    );
  if (!title || !company) return null;

  const jobUrl = `${window.location.origin}/viewjob?jk=${jobId}`;

  const applyButton = (root.querySelector(
    '#indeedApplyButton, [data-testid="indeedApplyButton"], a[href*="/apply/"], a[class*="indeedApply"], a[data-testid="viewJob-applyButton"]',
  ) ||
    document.querySelector(
      '#indeedApplyButton, [data-testid="indeedApplyButton"], a[href*="/apply/"], a[class*="indeedApply"], a[data-testid="viewJob-applyButton"]',
    )) as HTMLAnchorElement | null;

  const requirements =
    getText(
      '#qualificationsSection, [data-testid="qualifications-section"], [data-testid="jobsearch-ReqList"], .jobsearch-ReqList',
      root,
    ) || undefined;

  return {
    source: 'indeed',
    jobId,
    title,
    company,
    location:
      jsonLd.location ||
      getText(
        '[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"], #jobLocationText',
        root,
      ),
    salary:
      jsonLd.salary ||
      getText(
        '#salaryInfoAndJobType, [data-testid="jobsearch-JobInfoHeader-salary"], [data-testid="attribute_snippets_test_salary"], [class*="salaryText"]',
        root,
      ),
    requirements,
    description:
      jsonLd.description ||
      getText(
        '#jobDescriptionText, .jobsearch-JobComponent-description, .jobsearch-jobDescriptionText',
        root,
      ),
    applyUrl: applyButton?.href || jobUrl,
    jobUrl,
  };
}
