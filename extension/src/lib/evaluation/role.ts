/**
 * role.ts — Archetype, seniority, level, remote, and target role matching.
 * Inspired by career-ops/role-matcher.mjs and evaluate-jobs.mjs
 */

const LEVEL_TOKENS = new Map<string, number>([
  ['i', 1], ['ii', 2], ['iii', 3], ['iv', 4], ['v', 5], ['vi', 6],
  ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6],
]);

const LEVEL_RE = /(?:^|[\s,(\/\-\u2013\u2014])(?:level|lvl|grade|tier)?\s*(i{1,3}|iv|vi?|[1-6])(?=$|[\s,)\/\-\u2013\u2014])/giu;

export function extractLevel(title: string): string | undefined {
  for (const m of title.matchAll(LEVEL_RE)) {
    const token = m[1]?.toLowerCase();
    if (token && LEVEL_TOKENS.has(token)) {
      return `Level ${LEVEL_TOKENS.get(token)}`;
    }
  }
  return undefined;
}

export function detectArchetype(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('full stack') || t.includes('fullstack')) return 'Full Stack';
  if (t.includes('backend') || t.includes('node') || t.includes('python') || t.includes('golang') || t.includes('java') || t.includes('spring')) return 'Backend';
  if (t.includes('frontend') || t.includes('react') || t.includes('vue') || t.includes('angular')) return 'Frontend';
  if (t.includes('mobile') || t.includes('react native') || t.includes('flutter') || t.includes('ios') || t.includes('android')) return 'Mobile';
  if (t.includes('infrastructure') || t.includes('infra') || t.includes('devops') || t.includes('sre') || t.includes('cloud') || t.includes('kubernetes')) return 'DevOps';
  if (t.includes('machine learning') || t.includes('ai ') || t.includes('data engineer') || t.includes('mlops')) return 'AI / Data';
  if (t.includes('product owner') || t.includes('product manager')) return 'Product';
  return 'Software Engineer';
}

export function detectSeniority(text: string): string {
  const t = text.toLowerCase();
  if (/\b(principal|staff|architect|head|chief|lead)\b/i.test(t)) return 'Lead / Staff';
  if (/\b(senior|sr\.)\b/i.test(t) || /5\+\s*years?/i.test(t)) return 'Senior';
  if (/\b(intern|internship|trainee)\b/i.test(t)) return 'Intern';
  if (/\b(junior|jr\.|associate|entry|graduate|grad)\b/i.test(t)) return 'Junior';
  if (/\b(mid|middle|intermediate|3\+\s*years?|2\+\s*years?)\b/i.test(t)) return 'Mid';
  return 'Not specified';
}

export function detectRemote(text: string): string {
  const t = text.toLowerCase();
  if (/100%\s*remote|fully\s*remote|\bremote\b|\bremoto\b/i.test(t)) return 'Remote';
  if (/\bhybrid\b|\bhíbrido\b/i.test(t)) return 'Hybrid';
  if (/\bonsite\b|on-site|\bin-office\b|\boffice\b|\bpresencial\b/i.test(t)) return 'On-site';
  return 'Not specified';
}

export function matchRoleTarget(
  jobTitle: string,
  targetRoles?: string
): { match: boolean; score: number } {
  if (!targetRoles?.trim()) return { match: true, score: 4 };
  const jTitle = jobTitle.toLowerCase();
  const targets = targetRoles.split(/[,;\n]+/).map((r) => r.trim().toLowerCase()).filter(Boolean);

  for (const target of targets) {
    if (jTitle.includes(target)) return { match: true, score: 5 };
    const words = target.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0 && words.every((w) => jTitle.includes(w))) {
      return { match: true, score: 4.8 };
    }
  }

  // Check discriminating role tokens (role-matcher.mjs)
  const roleKeywords = ['backend', 'frontend', 'fullstack', 'mobile', 'devops', 'sre', 'ai', 'data', 'engineer', 'developer'];
  const matched = roleKeywords.filter((k) => targets.some((t) => t.includes(k)) && jTitle.includes(k));
  if (matched.length > 0) return { match: true, score: 4.2 };

  return { match: false, score: 2 };
}
