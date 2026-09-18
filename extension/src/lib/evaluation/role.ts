const LEVEL_MAP: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

export function extractLevel(title: string) {
  const m = /(?:level|lvl|grade)?\s*(i{1,3}|iv|vi?|[1-6])(?=$|[\s,)\/\-])/i.exec(title);
  if (!m?.[1]) return undefined;
  const v = m[1].toLowerCase();
  return `Level ${LEVEL_MAP[v] || v}`;
}

export function detectArchetype(t: string) {
  const s = t.toLowerCase();
  if (s.includes('frontend')) return 'Frontend';
  if (/full\s*stack|fullstack/.test(s)) return 'Full Stack';
  if (/devops|infra|cloud|sre/.test(s)) return 'DevOps';
  if (/data|ai\b|machine learning|mlops/.test(s)) return 'AI / Data';
  if (/mobile|ios|android/.test(s)) return 'Mobile';
  if (/product/.test(s)) return 'Product';
  return 'Backend';
}

export function detectSeniority(t: string) {
  const s = t.toLowerCase();
  if (/\b(lead|principal|staff|head|architect)\b/.test(s)) return 'Lead / Staff';
  if (/\b(senior|sr\.)\b|5\+\s*years?/.test(s)) return 'Senior';
  if (/\b(junior|jr\.|associate|entry|intern)\b/.test(s)) return 'Junior';
  return 'Mid';
}

export const detectRemote = (t: string) =>
  /remote|remoto/.test(t.toLowerCase()) ? 'Remote' : /hybrid|híbrido/.test(t.toLowerCase()) ? 'Hybrid' : 'On-site';

export function matchRoleTarget(title: string, targetRoles = '') {
  if (!targetRoles.trim()) return { match: true, score: 4 };
  const s = title.toLowerCase(), targets = targetRoles.toLowerCase().split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  if (targets.some((r) => s.includes(r))) return { match: true, score: 5 };
  const disc = ['backend', 'frontend', 'fullstack', 'devops', 'sre', 'ai', 'data', 'mobile'].filter((k) => targets.some((t) => t.includes(k)) && s.includes(k));
  return disc.length ? { match: true, score: 4.2 } : { match: false, score: 2 };
}
