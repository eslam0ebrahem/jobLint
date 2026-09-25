import type { JobEvaluation, RiskLevel, Verdict } from '@/src/types/job';

export function detectRedFlags(text: string, seniority: string, targets = ''): string[] {
  const value = text.toLowerCase();
  const flags: string[] = [];
  if (/unpaid|sin remunerar|volunteer|commission\s*only|unpaid internship/.test(value)) flags.push('Unpaid / commission role');
  if (/5\s*\+\s*years?/.test(value) && /junior|entry|intern/.test(value)) flags.push('5+ years required for junior role');
  if (seniority === 'Lead / Staff' && /junior|entry|mid/.test(targets.toLowerCase())) flags.push('Staff/Lead role vs target level');
  if (/must provide own equipment|unpaid trial|buy your own/.test(value)) flags.push('Unpaid trial or equipment cost');
  return [...new Set(flags)];
}

export function detectLocationScore(jobLocation = '', candidateLocation = ''): number {
  const job = jobLocation.toLowerCase().trim();
  const candidate = candidateLocation.toLowerCase().trim();
  if (!job) return 3;
  if (/remote|remoto|distributed/.test(job)) return 5;
  if (!candidate) return 3;
  const parts = candidate.split(/[,/]+/).map((part) => part.trim()).filter((part) => part.length > 2);
  if (parts.some((part) => job.includes(part))) return 5;
  if (/emea|europe|eu\b|united kingdom|uk\b/.test(job)) return 3;
  return 2;
}

export function detectLegitimacy(redFlags: string[]): JobEvaluation['legitimacy'] {
  if (redFlags.some((flag) => /unpaid|commission|suspicious|equipment/i.test(flag))) return 'Suspicious';
  if (redFlags.length) return 'Proceed with Caution';
  return 'High Confidence';
}

export function riskLevel(redFlags: string[], legitimacy: JobEvaluation['legitimacy']): RiskLevel {
  if (legitimacy === 'Suspicious') return 'high';
  if (redFlags.length || legitimacy === 'Proceed with Caution') return 'medium';
  return 'low';
}

export function calculateGlobalScore(matchScore: number, locationScore: number, roleScore: number, redFlags: string[]): number {
  const score = matchScore * 0.5 + locationScore * 0.25 + roleScore * 0.25 - redFlags.length * 0.8;
  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
}

export function calculateDimensionScores(input: {
  skillScore: number;
  roleScore: number;
  locationScore: number;
  workMode: 'Remote' | 'Hybrid' | 'On-site';
  hasSalary: boolean;
  seniority: string;
  redFlags: string[];
}): { fit: number; opportunity: number; safety: number; overall: number } {
  const fit = clamp(input.skillScore * 0.55 + input.roleScore * 0.3 + input.locationScore * 0.15);
  const opportunity = clamp(
    input.workMode === 'Remote' ? 4.8 : input.workMode === 'Hybrid' ? 4.1 : 3.4,
  ) + (input.hasSalary ? 0.2 : 0);
  const safety = clamp(5 - input.redFlags.length * 1.25);
  const overall = clamp(fit * 0.6 + opportunity * 0.25 + safety * 0.15);
  return { fit, opportunity: clamp(opportunity), safety, overall };
}

export function getVerdict(score: number): { verdict: Verdict; verdictLabel: string } {
  const verdict: Verdict = score >= 4 ? 'Apply' : score >= 3.5 ? 'Caution' : 'Skip';
  return {
    verdict,
    verdictLabel: verdict === 'Apply' ? '🟢 Apply' : verdict === 'Caution' ? '🟡 Apply with caution' : '🔴 Skip',
  };
}

export function generateRankReason(
  score: number,
  archetype: string,
  matched: string[],
  gaps: string[],
  flags: string[],
  roleMatch: boolean,
): string {
  if (flags.length) return `Caution: ${flags[0]}. ${matched.slice(0, 2).join(', ') || 'Some skills'} found.`.slice(0, 180);
  if (!roleMatch) return `Role differs from your target roles, though ${matched.slice(0, 2).join(', ') || 'your stack'} matched.`.slice(0, 180);
  return score >= 4
    ? `Strong ${archetype} match (${matched.slice(0, 3).join(', ') || 'core stack'}) with good profile alignment.`.slice(0, 180)
    : `Good ${archetype} fit, but missing ${gaps.slice(0, 2).join(', ') || 'more detail'}.`.slice(0, 180);
}

function clamp(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value * 10) / 10));
}
