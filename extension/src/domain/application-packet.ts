import type { ApplicationPacket, PacketEvidence, PacketJobSnapshot, PacketProfileSnapshot } from '@/src/types/packet';
import type { Job, Profile } from '@/src/types/job';

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

function evidenceFor(job: Job, profile: Profile): PacketEvidence[] {
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
  return evidence;
}

export function buildApplicationPacket(job: Job, profile: Profile, generatedAt = new Date().toISOString()): ApplicationPacket {
  const evaluation = job.evaluation;
  const matchedSkills = evaluation?.matchedSkills || [];
  const missingSkills = evaluation?.missingSkills || [];
  const talkingPoints = [
    profile.roles ? `Connect your target role (${profile.roles}) to the responsibilities in this posting.` : 'Add a target role to your profile before using this point.',
    ...matchedSkills.slice(0, 6).map((skill) => `Prepare one concrete résumé example demonstrating ${skill}; do not claim experience beyond your profile.`),
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
    ...(profile.skills ? ['Select evidence for each claimed skill from your résumé.'] : ['Complete Profile → Skills before making skill claims.']),
    ...(profile.summary ? ['Tailor the packet summary to the role without adding unsupported claims.'] : ['Add a concise, truthful profile summary.']),
    'Prepare two questions and a follow-up contact method.',
    'Record the outcome locally after applying so calibration can learn from real results.',
  ];
  return {
    version: 1,
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
    talkingPoints,
    questions,
    checklist,
    evidence: evidenceFor(job, profile),
    disclosure: 'Generated locally in your browser from the captured job, your saved profile, and the deterministic local evaluation. No application text was sent to a server.',
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
    ...packet.evidence.map((item) => `- **${item.label}** (${item.source}, confidence ${Math.round(item.confidence * 100)}%): ${item.value || ''}${item.detail ? ` — ${item.detail}` : ''}`),
  ];
  return lines.join('\n');
}
