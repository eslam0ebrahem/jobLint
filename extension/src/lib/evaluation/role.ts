export type Archetype = 'Frontend' | 'Full Stack' | 'Backend' | 'DevOps' | 'AI / Data' | 'Mobile' | 'Product' | 'Other';
export type Seniority = 'Junior' | 'Mid' | 'Senior' | 'Lead / Staff';

const LEVEL_MAP: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

export function extractLevel(title: string): string | undefined {
  const match = /(?:level|lvl|grade)?\s*(i{1,3}|iv|vi?|[1-6])(?=$|[\s,)\/-])/i.exec(title);
  if (!match?.[1]) return undefined;
  const value = match[1].toLowerCase();
  return `Level ${LEVEL_MAP[value] || value}`;
}

export function detectArchetype(text: string): Archetype {
  const value = text.toLowerCase();
  if (/full\s*stack|fullstack/.test(value)) return 'Full Stack';
  if (/frontend|front-end/.test(value)) return 'Frontend';
  if (/devops|infra|cloud|sre|platform engineer/.test(value)) return 'DevOps';
  if (/data|ai\b|artificial intelligence|machine learning|mlops/.test(value)) return 'AI / Data';
  if (/mobile|ios|android|flutter/.test(value)) return 'Mobile';
  if (/product manager|product management/.test(value)) return 'Product';
  if (/backend|back-end|server|api/.test(value)) return 'Backend';
  return 'Other';
}

export function detectSeniority(text: string): Seniority {
  const value = text.toLowerCase();
  if (/\b(lead|principal|staff|head|architect|director)\b/.test(value)) return 'Lead / Staff';
  if (/\b(senior|sr\.)\b|5\s*\+\s*years?/.test(value)) return 'Senior';
  if (/\b(junior|jr\.)\b|0\s*-\s*2\s*years?/.test(value)) return 'Junior';
  if (/\b(mid|intermediate)\b|2\s*-\s*5\s*years?/.test(value)) return 'Mid';
  return 'Mid';
}

export function detectRemote(text: string): 'Remote' | 'Hybrid' | 'On-site' {
  const value = text.toLowerCase();
  if (/remote|remoto|distributed/.test(value)) return 'Remote';
  if (/hybrid|híbrido/.test(value)) return 'Hybrid';
  return 'On-site';
}

export function matchRoleTarget(title: string, targetRoles = '') {
  const normalizedTitle = title.toLowerCase();
  const targets = targetRoles.toLowerCase().split(/[,;\n|]+/).map((role) => role.trim()).filter(Boolean);
  if (!targets.length) return { match: true, score: 3, confidence: 0.35 };
  if (targets.some((role) => role.length > 2 && normalizedTitle.includes(role))) {
    return { match: true, score: 5, confidence: 0.95 };
  }
  const disciplines = ['backend', 'frontend', 'full stack', 'fullstack', 'devops', 'sre', 'ai', 'data', 'mobile'];
  const matches = disciplines.filter((discipline) =>
    targets.some((target) => target.includes(discipline)) && normalizedTitle.includes(discipline),
  );
  return matches.length
    ? { match: true, score: 4.2, confidence: 0.75 }
    : { match: false, score: 2, confidence: 0.65 };
}
