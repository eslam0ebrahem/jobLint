import { describe, expect, it, vi } from 'vitest';
import { detectLinkedIn } from '@/src/lib/detectors/linkedin';
import { detectIndeed } from '@/src/lib/detectors/indeed';
import { scanIndeedDiscoveryCards, scanLinkedInDiscoveryCards } from '@/src/lib/detectors/discovery';
import { extractStructuredJob, getCanonicalUrl } from '@/src/lib/detectors/structured';
import { getPlatformForHost, SUPPORTED_HOST_PERMISSIONS } from '@/src/lib/detectors/registry';

const posting = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Senior React Engineer',
  hiringOrganization: { name: 'Northstar Labs' },
  jobLocation: { address: { addressLocality: 'London', addressCountry: 'UK' } },
  description: '<p>Build accessible React and TypeScript products.</p>',
  url: 'https://www.linkedin.com/jobs/view/9876/',
  baseSalary: { currency: 'GBP', value: { minValue: 80000, maxValue: 100000, unitText: 'YEAR' } },
};

function setFixture(body: string, url = 'https://www.linkedin.com/jobs/view/9876/'): void {
  document.head.innerHTML = `<link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify(posting)}</script>`;
  document.body.innerHTML = body;
  history.replaceState({}, '', url);
}

describe('detectors', () => {
  it('keeps supported hosts explicit and restricted', () => {
    expect(getPlatformForHost('www.linkedin.com')?.source).toBe('linkedin');
    expect(getPlatformForHost('www.indeed.co.uk')?.source).toBe('indeed');
    expect(getPlatformForHost('example.com')).toBeUndefined();
    expect(SUPPORTED_HOST_PERMISSIONS.every((permission) => permission.includes('linkedin.com') || permission.includes('indeed.'))).toBe(true);
  });

  it('extracts a JobPosting JSON-LD object and canonical URL', () => {
    setFixture('<main></main>');
    const extracted = extractStructuredJob('linkedin', getCanonicalUrl());
    expect(extracted).toMatchObject({ title: 'Senior React Engineer', company: 'Northstar Labs', location: 'London, UK', jobId: '9876' });
    expect(extracted?.description).toContain('accessible React');
    expect(extracted?.salary).toContain('GBP');
  });

  it('detects a LinkedIn fixture even when its DOM classes change', () => {
    setFixture('<main><div class="unknown-new-layout"><h1>DOM title</h1></div></main>');
    const result = detectLinkedIn();
    expect(result).toMatchObject({ source: 'linkedin', jobId: '9876', title: 'Senior React Engineer', company: 'Northstar Labs' });
  });

  it('detects an Indeed fixture with the shared structured data path', () => {
    document.head.innerHTML = '<script type="application/ld+json">' + JSON.stringify({ ...posting, url: 'https://www.indeed.com/viewjob?jk=indeed-42' }) + '</script>';
    document.body.innerHTML = '<div id="jobsearch-ViewjobPaneWrapper" data-jk="indeed-42"></div>';
    vi.stubGlobal('location', { hostname: 'www.indeed.com', href: 'https://www.indeed.com/viewjob?jk=indeed-42', search: '?jk=indeed-42', pathname: '/viewjob' });
    const result = detectIndeed();
    expect(result).toMatchObject({ source: 'indeed', jobId: 'indeed-42', title: 'Senior React Engineer', company: 'Northstar Labs' });
    vi.unstubAllGlobals();
  });

  it('scans LinkedIn result cards without falling back to document-wide text', () => {
    document.body.innerHTML = `
      <div class="job-card-container" data-occludable-job-id="li-101">
        <a href="/jobs/view/Senior-Engineer-101"><h3 class="job-card-list__title">Senior Engineeer</h3></a>
        <span class="artdeco-entity-lockup__subtitle">Northstar Labs</span>
        <span class="job-search__location">Remote</span>
      </div>
      <div class="job-card-container" data-occludable-job-id="li-102">
        <a href="/jobs/view/Product-Designer-102"><h3 class="job-card-list__title">Product Designer</h3></a>
        <span class="artdeco-entity-lockup__subtitle">Acme</span>
      </div>
      <h3>Unrelated page heading</h3>
    `;
    const result = scanLinkedInDiscoveryCards();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ source: 'linkedin', jobId: 'li-101', title: 'Senior Engineeer', company: 'Northstar Labs', location: 'Remote' });
    expect(result[0]?.detection?.strategy).toBe('linkedin-search-card');
  });

  it('scans Indeed cards and keeps the card boundary', () => {
    document.body.innerHTML = `
      <div class="job_seen_beacon" data-jk="indeed-77">
        <a class="jcs-JobTitle" href="/viewjob?jk=indeed-77"><h2 class="jobTitle">Backend Engineer</h2></a>
        <span class="companyName">Acme Labs</span>
        <span class="companyLocation">Berlin</span>
      </div>
      <h2>Unrelated Indeed heading</h2>
    `;
    vi.stubGlobal('location', { hostname: 'www.indeed.de', href: 'https://www.indeed.de/jobs', search: '', pathname: '/jobs' });
    const result = scanIndeedDiscoveryCards();
    expect(result).toEqual([expect.objectContaining({ source: 'indeed', jobId: 'indeed-77', title: 'Backend Engineer', company: 'Acme Labs', location: 'Berlin' })]);
    vi.unstubAllGlobals();
  });
});
