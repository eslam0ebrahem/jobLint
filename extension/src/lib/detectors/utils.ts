export function getText(
  selector: string,
  parent: ParentNode = document,
): string | undefined {
  const el = parent.querySelector(selector);
  const text = (el as HTMLElement)?.innerText || el?.textContent;
  return text && text.trim() ? text.trim().replace(/\s+/g, ' ') : undefined;
}
