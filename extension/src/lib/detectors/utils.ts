export function getText(
  selector: string,
  parent: ParentNode = document,
): string | undefined {
  const el =
    parent.querySelector(selector) ||
    (parent !== document ? document.querySelector(selector) : null);
  const text = (el as HTMLElement)?.innerText || el?.textContent;
  return text && text.trim() ? text.trim().replace(/\s+/g, ' ') : undefined;
}

export function getDescription(
  selectors: string[],
  parent: ParentNode = document,
): string | undefined {
  for (const sel of selectors) {
    const el =
      parent.querySelector(sel) ||
      (parent !== document ? document.querySelector(sel) : null);
    if (!el) continue;

    const raw = (el as HTMLElement).innerText || el.textContent || '';
    const cleaned = cleanDescription(raw);
    if (cleaned && cleaned.length > 25) {
      return cleaned;
    }
  }
  return undefined;
}

function cleanDescription(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

