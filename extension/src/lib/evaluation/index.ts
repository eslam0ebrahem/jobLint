import type { DetectedJob, JobEvaluation } from '@/src/types/job';
import { classifySkillGaps, DEFAULT_SKILLS } from './skills';
import { detectArchetype, detectSeniority, extractLevel, detectRemote, matchRoleTarget } from './role';
import { detectRedFlags, detectLocationScore, calculateGlobalScore, getVerdict, generateRankReason, detectLegitimacy } from './scoring';
import { evaluateWithLlm } from './llm';

export * from './skills';
export * from './role';
export * from './scoring';
export * from './llm';

export function evaluateJob(job: DetectedJob, profile?: Record<string, string>): JobEvaluation {
  const text = `${job.title} ${job.company} ${job.location || ''} ${job.salary || ''} ${job.description || ''}`;
  const userSkills = (profile?.skills ? profile.skills.split(/[,;\n]+/) : DEFAULT_SKILLS).map((s) => s.trim()).filter(Boolean);

  const archetype = detectArchetype(text);
  const seniority = detectSeniority(text);
  const level = extractLevel(job.title);
  const remote = detectRemote(text);
  const locScore = detectLocationScore(job.location, profile?.location);
  const { match: roleMatch, score: roleScore } = matchRoleTarget(job.title, profile?.roles);

  const { matchedSkills, missingSkills, matchScore } = classifySkillGaps(text, userSkills);
  const redFlags = detectRedFlags(text, seniority, profile?.roles);
  const legitimacy = detectLegitimacy(redFlags);
  const score = calculateGlobalScore(matchScore, locScore, roleScore, redFlags);
  const { verdict, verdictLabel } = getVerdict(score);
  const reason = generateRankReason(score, archetype, matchedSkills, missingSkills, redFlags, roleMatch);

  return { score, verdict, verdictLabel, archetype, seniority, level, remote, legitimacy, reason, matchedSkills, missingSkills, redFlags, aiEnhanced: false };
}

export const evaluateJobWithAi = (job: DetectedJob, profile?: Record<string, string>) =>
  evaluateWithLlm(job, evaluateJob(job, profile), profile);
