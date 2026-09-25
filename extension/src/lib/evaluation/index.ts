import type { DetectedJob, EvaluationEvidence, JobEvaluation, Profile, UserPreferences, Verdict } from '@/src/types/job';
import { DEFAULT_PREFERENCES } from '@/src/types/job';
import { classifySkillGaps, DEFAULT_SKILLS, parseProfileSkills } from './skills';
import { detectArchetype, detectSeniority, detectRemote, extractLevel, matchRoleTarget } from './role';
import {
  calculateDimensionScores,
  detectLegitimacy,
  detectLocationScore,
  detectRedFlags,
  generateRankReason,
  getVerdict,
  riskLevel,
} from './scoring';

export * from './skills';
export * from './role';
export * from './scoring';
export * from './normalize';

function evidence(
  id: string,
  category: EvaluationEvidence['category'],
  label: string,
  value: string | undefined,
  confidence: number,
  detail?: string,
): EvaluationEvidence {
  return { id, category, label, value, confidence, detail };
}

function makeReport(
  job: DetectedJob,
  profile: Profile | undefined,
  preferences: UserPreferences,
  text: string,
): JobEvaluation {
  const userSkills = parseProfileSkills(profile?.skills);
  const skills = classifySkillGaps(text, userSkills.length ? userSkills : DEFAULT_SKILLS);
  const archetype = detectArchetype(text);
  const seniority = detectSeniority(text);
  const remote = detectRemote(text);
  const locationScore = detectLocationScore(job.location, profile?.location);
  const role = matchRoleTarget(job.title, profile?.roles);
  const redFlags = detectRedFlags(text, seniority, profile?.roles);
  const legitimacy = detectLegitimacy(redFlags);
  const level = extractLevel(job.title);
  const scores = calculateDimensionScores({
    skillScore: skills.matchScore,
    roleScore: role.score,
    locationScore,
    workMode: remote,
    hasSalary: Boolean(job.salary),
    seniority,
    redFlags,
  });
  const fit = scores.fit;
  const opportunity = scores.opportunity;
  const safety = scores.safety;
  const overall = scores.overall;
  const missingData: string[] = [];
  if (!profile?.skills?.trim()) missingData.push('Candidate skills');
  if (!profile?.roles?.trim()) missingData.push('Target roles');
  if (!job.description?.trim()) missingData.push('Job description');
  if (!job.location?.trim()) missingData.push('Job location');
  if (!job.salary?.trim()) missingData.push('Compensation');
  const confidence = Math.min(
    1,
    Math.max(0.2, (job.description ? 0.35 : 0.15) + (profile?.skills ? 0.25 : 0) + (profile?.roles ? 0.15 : 0) + (job.location ? 0.1 : 0) + (job.salary ? 0.1 : 0)),
  );
  const evidenceList: EvaluationEvidence[] = [
    evidence('skills', 'skill', 'Skill overlap', `${skills.matchedSkills.length}/${skills.jobSkills.length || 0} detected skills`, skills.confidence, skills.jobSkills.length ? `Missing: ${skills.missingSkills.join(', ') || 'none'}` : 'No known skills detected in the description.'),
    evidence('role', 'role', 'Role alignment', role.match ? 'Aligned' : 'Different role', role.confidence),
    evidence('location', 'location', 'Location compatibility', `${locationScore}/5`, job.location ? 0.8 : 0.25),
    evidence('work-mode', 'location', 'Work mode', remote, 0.8),
    evidence('compensation', 'compensation', 'Compensation', job.salary || 'Not provided', job.salary ? 0.85 : 0.2),
  ];
  for (const flag of redFlags) evidenceList.push(evidence(`risk-${flag}`, 'risk', 'Risk signal', flag, 0.9));
  const reason = generateRankReason(overall, archetype, skills.matchedSkills, skills.missingSkills, redFlags, role.match);
  const breakdown = { fit, opportunity, safety, overall };
  const risk = riskLevel(redFlags, legitimacy);
  const weights = preferences.prioritizeFit + preferences.prioritizeOpportunity;
  const preferenceAdjusted = weights > 0
    ? (fit * preferences.prioritizeFit + opportunity * preferences.prioritizeOpportunity) / weights * 0.85 + safety * 0.15
    : overall;
  const score = Math.min(5, Math.max(1, Math.round(preferenceAdjusted * 10) / 10));
  const verdict: Verdict = getVerdict(score).verdict;
  return {
    version: 2,
    evaluator: 'heuristic',
    createdAt: new Date().toISOString(),
    score,
    verdict,
    verdictLabel: getVerdict(score).verdictLabel,
    archetype,
    seniority,
    level,
    remote,
    legitimacy,
    reason,
    matchedSkills: skills.matchedSkills,
    missingSkills: skills.missingSkills,
    redFlags,
    fitScore: fit,
    opportunityScore: opportunity,
    safetyScore: safety,
    confidence,
    riskLevel: risk,
    missingData,
    evidence: evidenceList,
    scoreBreakdown: { ...breakdown, overall: score },
  };
}

export function evaluateJob(job: DetectedJob, profile?: Profile, preferences: UserPreferences = DEFAULT_PREFERENCES): JobEvaluation {
  const text = [job.title, job.company, job.location, job.salary, job.description, job.requirements]
    .filter(Boolean)
    .join(' ');
  return makeReport(job, profile, preferences, text);
}

export function isProfileFilled(profile?: Profile | null): boolean {
  return Boolean(profile?.roles?.trim() && profile?.skills?.trim());
}

export function getProfileMissingNotice(profile?: Profile | null): string | null {
  if (!profile || (!profile.roles?.trim() && !profile.skills?.trim())) {
    return 'Please complete your Profile (Target Roles & Skills) before evaluating jobs.';
  }
  if (!profile.roles?.trim()) return 'Please set your Target Roles in Profile before evaluating jobs.';
  if (!profile.skills?.trim()) return 'Please set your Skills & Tech Stack in Profile before evaluating jobs.';
  return null;
}
