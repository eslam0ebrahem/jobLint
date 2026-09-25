import { describe, expect, it, vi } from 'vitest';
import { detectLinkedIn } from '@/src/lib/detectors/linkedin';
import { detectIndeed } from '@/src/lib/detectors/indeed';
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
});
