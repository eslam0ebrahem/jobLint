export function detectRedFlags(t: string, seniority: string, targets = '') {
  const s = t.toLowerCase(), flags: string[] = [];
  if (/unpaid|sin remunerar|volunteer|commission\s*only/.test(s)) flags.push('Unpaid / Commission role');
  if (/5\+\s*years?/.test(s) && /junior|entry/.test(s)) flags.push('5+ years required for junior role');
  if (seniority === 'Lead / Staff' && /junior|entry|mid/.test(targets.toLowerCase())) flags.push('Staff/Lead role vs Junior target');
  return flags;
}

export const detectLocationScore = (jobLoc = '', candidateLoc = '') => {
  const j = jobLoc.toLowerCase(), c = candidateLoc.toLowerCase().split(',')[0]?.trim() || '';
  if (!j || /remote|remoto/.test(j)) return 5;
  if (c && j.includes(c)) return 5;
  if (/spain|españa/.test(j) && /spain|españa/.test(c)) return 5;
  return /emea|europe|eu/.test(j) ? 4 : 3;
};

export const detectLegitimacy = (redFlags: string[]) =>
  (redFlags.some((f) => /unpaid|commission/i.test(f))
    ? 'Suspicious'
    : redFlags.length
      ? 'Proceed with Caution'
      : 'High Confidence') as 'High Confidence' | 'Proceed with Caution' | 'Suspicious';

export function calculateGlobalScore(matchScore: number, locScore: number, roleScore: number, redFlags: string[]) {
  let score = matchScore * 0.5 + locScore * 0.25 + roleScore * 0.25 - (redFlags.length ? 0.8 * redFlags.length : 0);
  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
}

export const getVerdict = (score: number) => ({
  verdict: (score >= 4 ? 'Apply' : score >= 3.5 ? 'Caution' : 'Skip') as 'Apply' | 'Caution' | 'Skip',
  verdictLabel: score >= 4 ? '🟢 Apply' : score >= 3.5 ? '🟡 Apply with caution' : '🔴 Skip',
});

export function generateRankReason(score: number, archetype: string, matched: string[], gaps: string[], flags: string[], roleMatch: boolean) {
  if (flags.length) return `Caution: ${flags[0]}. ${matched.slice(0, 2).join(', ')} found.`.slice(0, 140);
  if (!roleMatch) return `Role mismatch for target roles, though ${matched.slice(0, 2).join(', ')} matched.`.slice(0, 140);
  return score >= 4
    ? `Strong ${archetype} match (${matched.slice(0, 3).join(', ') || 'core stack'}) with high profile alignment.`.slice(0, 140)
    : `Good ${archetype} fit, but missing ${gaps.slice(0, 2).join(', ') || 'requirements'}.`.slice(0, 140);
}
