import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, createJobIdentity, identityMatches } from '@/src/domain/identity';

describe('job identity', () => {
  it('removes tracking parameters and fragments', () => {
    expect(canonicalizeUrl('https://www.indeed.com/viewjob?jk=abc&utm_source=x&jk=abc#details')).toBe('https://www.indeed.com/viewjob?jk=abc');
  });

  it('matches the same source ID despite different URLs', () => {
    const first = createJobIdentity({ source: 'linkedin', jobId: '4215', jobUrl: 'https://www.linkedin.com/jobs/view/4215/?trk=x', title: 'Engineer', company: 'Acme' });
    const second = createJobIdentity({ source: 'linkedin', jobId: '4215', jobUrl: 'https://www.linkedin.com/jobs/view/4215/', title: 'Engineer', company: 'Acme' });
    expect(identityMatches(first, second)).toBe(true);
  });

  it('does not collapse different postings at the same company', () => {
    const first = createJobIdentity({ source: 'manual', jobUrl: 'https://example.com/jobs/one', title: 'Engineer', company: 'Acme' });
    const second = createJobIdentity({ source: 'manual', jobUrl: 'https://example.com/jobs/two', title: 'Engineer', company: 'Acme' });
    expect(identityMatches(first, second)).toBe(false);
  });
});
