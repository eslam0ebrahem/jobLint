export interface SkillMatch {
  skill: string;
  matched: boolean;
  source: 'job' | 'profile';
}

const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  reactjs: 'React',
  react: 'React',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  golang: 'Go',
  go: 'Go',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  gcp: 'GCP',
  aws: 'AWS',
  restful: 'REST APIs',
  rest: 'REST APIs',
  'rest apis': 'REST APIs',
  ci: 'CI/CD',
  'ci/cd': 'CI/CD',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
  dotnet: '.NET',
  '.net': '.NET',
};

const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'C++', 'C#', '.NET', 'SQL',
  'React Native', 'React', 'Angular', 'Vue.js', 'Svelte', 'Next.js', 'Django', 'FastAPI', 'Spring',
  'Node.js', 'Express', 'Tailwind', 'MongoDB', 'PostgreSQL', 'Redis', 'GraphQL', 'REST APIs', 'Kafka',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Figma', 'Swift', 'Kotlin', 'Flutter',
];

export const DEFAULT_SKILLS: string[] = [];

export function cleanSkill(value: string): string {
  const trimmed = value.trim();
  return SKILL_ALIASES[trimmed.toLowerCase()] || trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    const expression = new RegExp(`(?<![\\w-])${escapeRegExp(skill)}(?![\\w-])`, 'i');
    if (expression.test(text)) found.add(skill);
  }
  // Catch common aliases not represented in the curated list.
  const aliasExpression = new RegExp(
    `(?<![\\w-])(?:${Object.keys(SKILL_ALIASES).sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?![\\w-])`,
    'gi',
  );
  for (const match of text.matchAll(aliasExpression)) found.add(cleanSkill(match[0]));
  return [...found];
}

export function parseProfileSkills(value: string | undefined): string[] {
  return [...new Set((value || '').split(/[,;\n|]+/).map(cleanSkill).filter(Boolean))];
}

export function classifySkillGaps(text: string, candidateSkills: string[]) {
  const jobSkills = extractSkills(text);
  const normalizedCandidates = new Set(candidateSkills.map((skill) => cleanSkill(skill).toLowerCase()));
  const matchedSkills = jobSkills.filter((skill) => normalizedCandidates.has(skill.toLowerCase()));
  const missingSkills = jobSkills.filter((skill) => !normalizedCandidates.has(skill.toLowerCase()));
  const total = matchedSkills.length + missingSkills.length;
  const matchScore = total === 0
    ? 3
    : Math.min(5, Math.max(1, Math.round(1 + (matchedSkills.length / total) * 4) * 10) / 10);
  return {
    matchedSkills,
    missingSkills,
    matchScore,
    jobSkills,
    confidence: total === 0 ? 0.25 : Math.min(1, 0.45 + total * 0.08),
  };
}

export function skillEvidence(text: string, candidateSkills: string[]) {
  return classifySkillGaps(text, candidateSkills);
}
