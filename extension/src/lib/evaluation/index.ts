/**
 * evaluation/index.ts — Unified evaluation orchestrator.
 */

import type { DetectedJob, JobEvaluation } from '@/src/types/job';
import { classifySkillGaps, DEFAULT_CANDIDATE_SKILLS } from './skills';
import { detectArchetype, detectSeniority, extractLevel, detectRemote, matchRoleTarget } from './role';
import {
  detectRedFlags,
  detectLegitimacy,
  detectLocationScore,
  calculateGlobalScore,
  getVerdict,
  generateRankReason,
} from './scoring';
import { evaluateWithLlm } from './llm';

export * from './skills';
export * from './role';
export * from './scoring';
export * from './llm';

export function evaluateJob(
  job: DetectedJob,
  profile?: Record<string, string>
): JobEvaluation {
  const fullText = `${job.title} ${job.company} ${job.location || ''} ${job.salary || ''} ${job.requirements || ''} ${job.description || ''}`;
  const userSkills = (profile?.skills ? profile.skills.split(/[,;\n]+/) : DEFAULT_CANDIDATE_SKILLS)
    .map((s) => s.trim())
    .filter(Boolean);

  const archetype = detectArchetype(fullText);
  const seniority = detectSeniority(fullText);
  const level = extractLevel(job.title);
  const remote = detectRemote(fullText);
  const locScore = detectLocationScore(job.location || fullText, profile?.location);
  const { match: roleMatch, score: roleScore } = matchRoleTarget(job.title, profile?.roles);

  const { matchedSkills, missingSkills, matchScore } = classifySkillGaps(fullText, userSkills);
  const redFlags = detectRedFlags(fullText, seniority, profile?.roles);
  const legitimacy = detectLegitimacy(fullText, redFlags);

  const score = calculateGlobalScore(matchScore, locScore, roleScore, redFlags);
  const { verdict, verdictLabel } = getVerdict(score);
  const reason = generateRankReason(score, archetype, matchedSkills, missingSkills, redFlags, roleMatch);

  return {
    score,
    verdict,
    verdictLabel,
    archetype,
    seniority,
    level,
    remote,
    legitimacy,
    reason,
    matchedSkills,
    missingSkills,
    redFlags,
    aiEnhanced: false,
  };
}

export async function evaluateJobWithAi(
  job: DetectedJob,
  profile?: Record<string, string>
): Promise<JobEvaluation> {
  const deterministic = evaluateJob(job, profile);
  const result = await evaluateWithLlm(job, deterministic, profile);
  return result.evaluation;
}
