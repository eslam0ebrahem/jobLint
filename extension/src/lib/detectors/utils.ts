export const getText = (
  selector: string,
  parent: ParentNode = document,
): string | undefined =>
  parent.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ||
  undefined;

export function parseJsonLd() {
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      const data = JSON.parse(script.textContent || '');
      const posting =
        data['@type'] === 'JobPosting'
          ? data
          : data['@graph']?.find(
              (entry: any) => entry['@type'] === 'JobPosting',
            );
      if (posting) {
        const address = posting.jobLocation?.address;
        const location = address
          ? [
              address.addressLocality,
              address.addressRegion,
              address.addressCountry,
            ]
              .filter(Boolean)
              .join(', ')
          : undefined;
        const salaryValue = posting.baseSalary?.value;
        const currency = posting.baseSalary?.currency || '$';
        const unit = posting.baseSalary?.unitText || 'yr';
        const salary = salaryValue
          ? typeof salaryValue === 'object'
            ? `${currency}${salaryValue.minValue ?? ''} - ${currency}${salaryValue.maxValue ?? ''} / ${unit}`
            : `${currency}${salaryValue} / ${unit}`
          : undefined;

        const rawUrl = posting.url || posting.sameAs;
        const jsonLdJobId =
          (typeof posting.identifier === 'object'
            ? posting.identifier?.value
            : posting.identifier) ||
          rawUrl?.match(/\/jobs\/view\/(?:.*?-)?(\d+)/)?.[1];

        return {
          jobId: jsonLdJobId ? String(jsonLdJobId) : undefined,
          title: posting.title as string | undefined,
          company: posting.hiringOrganization?.name as string | undefined,
          location,
          salary,
          description: posting.description as string | undefined,
        };
      }
    } catch {}
  }
  return {};
}
