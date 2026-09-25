import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectJob } from '@/src/lib/detectors';
import { scanDiscoveryCards } from '@/src/lib/detectors/discovery';

const fixtureRoot = resolve(process.cwd(), 'tests/fixtures/detectors');

function loadBrowserFixture(name: string): void {
  const source = readFileSync(resolve(fixtureRoot, name), 'utf8');
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const fixtureUrl = parsed.querySelector<HTMLMetaElement>('meta[name="fixture-url"]')?.content;
  if (!fixtureUrl) throw new Error(`${name} is missing its fixture-url metadata.`);

  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.title = parsed.title;

  const url = new URL(fixtureUrl);
  vi.stubGlobal('location', {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
  });
}

const linkedInDetailFixtures = [
  {
    name: 'unified top-card detail',
    fixture: 'linkedin-unified-detail.html',
    expected: {
      source: 'linkedin',
      jobId: '4231045678',
      title: 'Staff Frontend Engineer',
      company: 'Aurora Systems',
      location: 'London, England · Hybrid',
      salary: '£85,000 – £105,000',
      jobUrl: 'https://www.linkedin.com/jobs/view/4231045678/',
      applyUrl: 'https://www.linkedin.com/apply/aurora-staff-frontend?trk=public_jobs_apply-link-offsite_sign-up-modal',
      description: expect.stringContaining('accessibility specialists'),
    },
  },
  {
    name: 'legacy split-pane detail',
    fixture: 'linkedin-legacy-split-pane.html',
    expected: {
      source: 'linkedin',
      jobId: '3901122334',
      title: 'Principal Data Engineer',
      company: 'Harbor Analytics',
      location: 'Manchester, England · Remote',
      jobUrl: 'https://www.linkedin.com/jobs/view/3901122334/',
      applyUrl: 'https://www.linkedin.com/apply/harbor-data-engineer',
      description: expect.stringContaining('data platform'),
    },
  },
] as const;

const linkedInSearchFixtures = [
  {
    name: 'guest search cards',
    fixture: 'linkedin-guest-search.html',
    expected: [
      {
        source: 'linkedin',
        jobId: '4258119001',
        title: 'Staff Product Designer',
        company: 'Mosaic Studio',
        location: 'Remote · Europe',
        salary: '€90,000–€115,000',
      },
      {
        source: 'linkedin',
        jobId: '4258119002',
        title: 'Senior Data Analyst',
        company: 'Signal & Co',
        location: 'Dublin, Ireland',
      },
    ],
  },
] as const;

const indeedDetailFixtures = [
  {
    name: 'SSR detail',
    fixture: 'indeed-ssr-detail.html',
    expected: {
      source: 'indeed',
      jobId: 'ssr-847201',
      title: 'Senior Site Reliability Engineer',
      company: 'Cloudline Systems',
      location: 'Toronto, ON',
      salary: '$120,000–$150,000 yearly',
      jobUrl: 'https://www.indeed.com/viewjob?jk=ssr-847201',
      applyUrl: 'https://www.indeed.com/apply/apply?jk=ssr-847201',
      description: expect.stringContaining('multi-region resilience'),
    },
  },
  {
    name: 'legacy detail',
    fixture: 'indeed-legacy-detail.html',
    expected: {
      source: 'indeed',
      jobId: 'legacy-55291',
      title: 'Data Engineer',
      company: 'Northwind Analytics',
      location: 'Manchester',
      salary: '£60,000 – £75,000 per year',
      jobUrl: 'https://www.indeed.co.uk/viewjob?jk=legacy-55291',
      applyUrl: 'https://www.indeed.co.uk/apply/apply?jk=legacy-55291',
      description: expect.stringContaining('streaming pipelines'),
    },
  },
] as const;

const indeedSearchFixtures = [
  {
    name: 'organic search cards',
    fixture: 'indeed-organic-search.html',
    expected: [
      {
        source: 'indeed',
        jobId: 'modern-3301',
        title: 'Full-stack Developer',
        company: 'Northwind Labs',
        location: 'Remote',
        salary: '$95,000 – $120,000 yearly',
      },
      {
        source: 'indeed',
        jobId: 'modern-3302',
        title: 'Frontend Platform Engineer',
        company: 'Maple Health',
        location: 'Toronto, ON',
      },
    ],
  },
] as const;

const blockedFixtures = [
  { platform: 'LinkedIn', name: 'consent wall', fixture: 'linkedin-consent-wall.html' },
  { platform: 'Indeed', name: 'sign-in wall', fixture: 'indeed-sign-in-wall.html' },
  { platform: 'LinkedIn', name: 'expired posting', fixture: 'linkedin-expired-job.html' },
  { platform: 'Indeed', name: 'missing company', fixture: 'indeed-missing-company.html' },
] as const;

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('browser DOM fixtures', () => {
  it.each(linkedInDetailFixtures)('detects the LinkedIn $name page', ({ fixture, expected }) => {
    loadBrowserFixture(fixture);
    expect(detectJob()).toMatchObject(expected);
  });

  it.each(linkedInSearchFixtures)('discovers LinkedIn $name without crossing card boundaries', ({ fixture, expected }) => {
    loadBrowserFixture(fixture);
    expect(detectJob()).toBeNull();
    expect(scanDiscoveryCards()).toEqual(expected.map((job) => expect.objectContaining(job)));
  });

  it.each(indeedDetailFixtures)('detects the Indeed $name page', ({ fixture, expected }) => {
    loadBrowserFixture(fixture);
    expect(detectJob()).toMatchObject(expected);
  });

  it.each(indeedSearchFixtures)('discovers Indeed $name without crossing card boundaries', ({ fixture, expected }) => {
    loadBrowserFixture(fixture);
    expect(detectJob()).toBeNull();
    expect(scanDiscoveryCards()).toEqual(expected.map((job) => expect.objectContaining(job)));
  });

  it.each(blockedFixtures)('rejects the $platform $name fixture', ({ fixture }) => {
    loadBrowserFixture(fixture);
    expect(detectJob()).toBeNull();
    expect(scanDiscoveryCards()).toEqual([]);
  });
});
