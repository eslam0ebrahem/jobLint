/**
 * scoring.ts — Red flags, legitimacy, location scoring, global score, verdict, and rank reasoning.
 * Inspired by career-ops/evaluate-jobs.mjs, rank-pipeline.mjs, and batch-evaluate-gemini.mjs
 */

export function detectRedFlags(
  text: string,
  seniority: string,
  targetRoles?: string
): string[] {
  const flags: string[] = [];
  const t = text.toLowerCase();

  if (/unpaid|sin remunerar|volunteer|no salary/i.test(t)) {
    flags.push('Unpaid or volunteer role');
  }
  if (/5\+\s*years?/i.test(t) && /junior|entry/i.test(t)) {
    flags.push('5+ years required for junior role');
  }
  if (seniority === 'Lead / Staff' && targetRoles && /junior|entry|mid/i.test(targetRoles)) {
    flags.push('High seniority (Staff/Lead vs Junior/Mid target)');
  }
  if (/commission\s*only/i.test(t)) {
    flags.push('Commission only compensation');
  }

  return flags;
}

export function detectLegitimacy(
  text: string,
  redFlags: string[]
): 'High Confidence' | 'Proceed with Caution' | 'Suspicious' {
  if (redFlags.some((f) => /unpaid|commission/i.test(f))) return 'Suspicious';
  if (redFlags.length > 0 || /reposted\s+30\+|over\s+200\s+applicants/i.test(text)) {
    return 'Proceed with Caution';
  }
  return 'High Confidence';
}

export function detectLocationScore(jobLoc?: string, candidateLoc?: string): number {
  if (!jobLoc) return 4;
  const j = jobLoc.toLowerCase();
  if (j.includes('remote') || j.includes('remoto')) return 5;
  if (candidateLoc) {
    const c = candidateLoc.toLowerCase();
    const city = c.split(',')[0]?.trim();
    if (city && j.includes(city)) return 5;
    if ((j.includes('spain') || j.includes('españa')) && (c.includes('spain') || c.includes('españa'))) return 5;
    if (j.includes('emea') || j.includes('europe') || j.includes('eu')) return 4;
  }
  return 3;
}

export function calculateGlobalScore(
  matchScore: number,
  locScore: number,
  roleScore: number,
  redFlags: string[]
): number {
  // Weighted blend: 50% skills, 25% location, 25% target role alignment
  let score = matchScore * 0.5 + locScore * 0.25 + roleScore * 0.25;
  if (redFlags.length > 0) {
    score = Math.max(1, score - 0.7 * redFlags.length);
  }
  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
}

export function getVerdict(score: number): { verdict: 'Apply' | 'Caution' | 'Skip'; verdictLabel: string } {
  if (score >= 4.0) return { verdict: 'Apply', verdictLabel: '🟢 Apply' };
  if (score >= 3.5) return { verdict: 'Caution', verdictLabel: '🟡 Apply with caution' };
  return { verdict: 'Skip', verdictLabel: '🔴 Skip' };
}

export function generateRankReason(
  score: number,
  archetype: string,
  matchedSkills: string[],
  missingSkills: string[],
  redFlags: string[],
  roleMatch: boolean
): string {
  if (redFlags.length > 0) {
    return `Caution: ${redFlags[0]}. ${matchedSkills.slice(0, 2).join(', ')} found.`.slice(0, 140);
  }
  if (!roleMatch) {
    return `Role mismatch for target roles, though ${matchedSkills.slice(0, 2).join(', ')} matched.`.slice(0, 140);
  }
  if (score >= 4.0) {
    const skillsText = matchedSkills.slice(0, 3).join(', ');
    return `Strong ${archetype} match (${skillsText || 'core stack'}) with high profile alignment.`.slice(0, 140);
  }
  if (score >= 3.5) {
    const missingText = missingSkills.slice(0, 2).join(', ');
    return `Good ${archetype} fit, but missing ${missingText || 'some stack requirements'}.`.slice(0, 140);
  }
  return `Weak alignment with profile; missing ${missingSkills.slice(0, 3).join(', ') || 'key requirements'}.`.slice(0, 140);
}
