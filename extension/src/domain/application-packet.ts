import type {
  ApplicationPacket,
  PacketClaimCoverage,
  PacketClaimReference,
  PacketEvidence,
  PacketJobSnapshot,
  PacketProfileSnapshot,
} from '@/src/types/packet';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job, Profile } from '@/src/types/job';
import { buildRequirementEvidence, groundedSkills, summarizeClaims } from './claims';

function clean(value: string | undefined, max = 4_000): string | undefined {
  const result = value?.trim();
  return result ? result.slice(0, max) : undefined;
}

function snapshotJob(job: Job): PacketJobSnapshot {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: clean(job.location, 1_000),
    jobUrl: job.jobUrl,
    applyUrl: job.applyUrl,
    descriptionExcerpt: clean(job.description),
    deadline: job.facts?.deadline,
    facts: job.facts,
  };
}

function snapshotProfile(profile: Profile): PacketProfileSnapshot {
  return {
    roles: clean(profile.roles, 1_000),
    skills: clean(profile.skills, 2_000),
    location: clean(profile.location, 1_000),
    summary: clean(profile.summary, 4_000),
  };
}

function evidenceFor(job: Job, profile: Profile, claims: CandidateClaim[]): PacketEvidence[] {
  const evidence: PacketEvidence[] = [];
  for (const item of job.evaluation?.evidence || []) {
    evidence.push({
      id: `evaluation-${item.id}`,
      source: 'evaluation',
      label: item.label,
      value: item.value,
      detail: item.detail,
      confidence: item.confidence,
    });
  }
  if (profile.skills) evidence.push({ id: 'profile-skills', source: 'profile', label: 'Profile skills', value: profile.skills, confidence: 1 });
  if (profile.roles) evidence.push({ id: 'profile-roles', source: 'profile', label: 'Target roles', value: profile.roles, confidence: 1 });
  if (job.facts?.employmentType && job.facts.employmentType !== 'other') evidence.push({ id: 'job-employment-type', source: 'job', label: 'Employment type', value: job.facts.employmentType, confidence: 0.8 });
  if (job.facts?.workMode && job.facts.workMode !== 'unknown') evidence.push({ id: 'job-work-mode', source: 'job', label: 'Work mode', value: job.facts.workMode, confidence: 0.8 });
  if (job.facts?.deadline) evidence.push({ id: 'job-deadline', source: 'job', label: 'Application deadline', value: job.facts.deadline.date, detail: job.facts.deadline.raw, confidence: job.facts.deadline.confidence });
  for (const skill of groundedSkills(job, claims)) {
    evidence.push({
      id: `claim-${skill.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      source: 'claim',
      label: `Claim ledger: ${skill.skill}`,
      value: skill.status === 'covered' ? 'Verified claim' : 'Asserted claim',
      detail: 'Backed by your local candidate claims.',
      confidence: skill.status === 'covered' ? 0.9 : 0.6,
      claimIds: skill.claimIds,
    });
  }
  return evidence;
}

function claimReferences(claims: CandidateClaim[], cited: Set<string>): PacketClaimReference[] {
  return claims
    .filter((claim) => cited.has(claim.id))
    .map((claim) => ({
      claimId: claim.id,
      label: claim.label,
      kind: claim.kind,
      status: claim.status,
      reference: claim.reference,
    }));
}

export function buildApplicationPacket(
  job: Job,
  profile: Profile,
  generatedAt = new Date().toISOString(),
  ledger: CandidateClaim[] = [],
): ApplicationPacket {
  const evaluation = job.evaluation;
  const matchedSkills = evaluation?.matchedSkills || [];
  const missingSkills = evaluation?.missingSkills || [];
  const grounded = groundedSkills(job, ledger);
  const groundedBySkill = new Map(grounded.map((item) => [item.skill, item]));
  const requirements = buildRequirementEvidence(job, ledger);
  const unsupportedClaims = ledger.length ? matchedSkills.filter((skill) => !groundedBySkill.has(skill)) : [];
  const cited = new Set(grounded.flatMap((item) => item.claimIds));
  const claimCoverage: PacketClaimCoverage = !ledger.length
    ? 'not-configured'
    : unsupportedClaims.length === 0
      ? 'full'
      : grounded.length
        ? 'partial'
        : 'none';
  const claimsById = new Map(summarizeClaims(ledger).claims.map((claim) => [claim.id, claim]));

  const talkingPoints = [
    profile.roles ? `Connect your target role (${profile.roles}) to the responsibilities in this posting.` : 'Add a target role to your profile before using this point.',
    ...matchedSkills.slice(0, 6).map((skill) => {
      const support = groundedBySkill.get(skill);
      if (!support) {
        return `Prepare one concrete résumé example demonstrating ${skill}; do not claim experience beyond your profile because no claim in your ledger covers it.`;
      }
      const labels = support.claimIds
        .map((id) => claimsById.get(id)?.label)
        .filter((label): label is string => Boolean(label))
        .join(', ');
      const provenance = support.status === 'covered'
        ? `backed by your verified claim ${labels}`
        : `asserted by ${labels} but not yet verified, so confirm it before you say it`;
      return `Prepare one concrete résumé example demonstrating ${skill}; it is ${provenance}. Do not claim experience beyond your profile.`;
    }),
    job.facts?.workMode === 'remote' ? 'Confirm that remote collaboration and written communication are examples you can discuss.' : job.facts?.workMode === 'hybrid' ? 'Prepare an example of working across on-site and remote teammates.' : 'Prepare an example of collaborating with an on-site team.',
  ];
  const questions = [
    ...(missingSkills.length ? [`Which of these capabilities are essential for the first 90 days: ${missingSkills.slice(0, 5).join(', ')}?`] : []),
    job.facts?.deadline ? `What is the expected review timeline relative to the stated deadline of ${job.facts.deadline.date}?` : 'What is the expected review timeline?',
    'Which part of the role has the greatest impact in the first six months?',
    'What would success in this role look like at 30, 60, and 90 days?',
  ];
  const checklist = [
    'Verify the posting URL and application deadline against the original source.',
    ...(ledger.length
      ? ['Re-verify any claim marked asserted before you rely on it in an interview.']
      : ['Add your verifiable claims to the claim ledger so every skill you name has a source.']),
    ...(profile.skills ? ['Select evidence for each claimed skill from your résumé.'] : ['Complete Profile → Skills before making skill claims.']),
    ...(profile.summary ? ['Tailor the packet summary to the role without adding unsupported claims.'] : ['Add a concise, truthful profile summary.']),
    'Prepare two questions and a follow-up contact method.',
    'Record the outcome locally after applying so calibration can learn from real results.',
  ];
  return {
    version: 2,
    localOnly: true,
    generatedAt,
    job: snapshotJob(job),
    profile: snapshotProfile(profile),
    alignment: {
      score: evaluation?.score ?? null,
      verdict: evaluation?.verdict ?? null,
      confidence: evaluation?.confidence ?? null,
      matchedSkills: [...matchedSkills],
      missingSkills: [...missingSkills],
      missingData: [...(evaluation?.missingData || [])],
    },
    claims: claimReferences(ledger, cited),
    claimCoverage,
    requirements,
    unsupportedClaims,
    talkingPoints,
    questions,
    checklist,
    evidence: evidenceFor(job, profile, ledger),
    disclosure: 'Generated locally in your browser from the captured job, your saved profile, your claim ledger, and the deterministic local evaluation. No application text was sent to a server.',
  };
}

export function applicationPacketToMarkdown(packet: ApplicationPacket): string {
  const lines = [
    `# Application packet: ${packet.job.title}`,
    `${packet.job.company}${packet.job.location ? ` · ${packet.job.location}` : ''}`,
    '',
    `> ${packet.disclosure}`,
    '',
    '## Evidence-grounded alignment',
    `- Local score: ${packet.alignment.score ?? 'Not evaluated'} / 5`,
    `- Verdict: ${packet.alignment.verdict || 'Not evaluated'}`,
    `- Matched skills: ${packet.alignment.matchedSkills.join(', ') || 'None identified'}`,
    `- Skill gaps to verify: ${packet.alignment.missingSkills.join(', ') || 'None identified'}`,
    '',
    '## Profile evidence',
    `- Target roles: ${packet.profile.roles || 'Not provided'}`,
    `- Skills: ${packet.profile.skills || 'Not provided'}`,
    `- Location: ${packet.profile.location || 'Not provided'}`,
    `- Claim coverage: ${packet.claimCoverage}`,
    ...packet.claims.map((claim) => `- Claim: ${claim.label} (${claim.kind}, ${claim.status})${claim.reference ? ` — ${claim.reference}` : ''}`),
    ...(packet.unsupportedClaims.length ? [`- No claim covers: ${packet.unsupportedClaims.join(', ')}`] : []),
    '',
    '## Talking points',
    ...packet.talkingPoints.map((point) => `- ${point}`),
    '',
    '## Questions to ask',
    ...packet.questions.map((question) => `- ${question}`),
    '',
    '## Application checklist',
    ...packet.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Evidence index',
    ...packet.evidence.map((item) => `- **${item.label}** (${item.source}, confidence ${Math.round(item.confidence * 100)}%): ${item.value || ''}${item.detail ? ` — ${item.detail}` : ''}${item.claimIds?.length ? ` [claims: ${item.claimIds.join(', ')}]` : ''}`),
  ];
  return lines.join('\n');
}
