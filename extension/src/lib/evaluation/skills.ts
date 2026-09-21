const SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Golang', 'Rust', 'PHP', 'C\\+\\+', 'C#', '\\.NET', 'SQL',
  'React Native', 'React', 'Angular', 'Vue\\.?js', 'Svelte', 'Next\\.?js', 'Django', 'FastAPI', 'Spring',
  'Node\\.?js', 'Express\\.?js', 'Express', 'Tailwind', 'MongoDB', 'PostgreSQL', 'Postgres', 'Redis',
  'GraphQL', 'REST(?:ful)?', 'Kafka', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'k8s', 'CI/CD',
];
const SKILL_RE = new RegExp(`(?<!\\w)(?:${SKILLS.join('|')})(?!\\w)`, 'gi');

const ALIASES: Record<string, string> = {
  k8s: 'Kubernetes', golang: 'Go', postgres: 'PostgreSQL', postgresql: 'PostgreSQL',
  nodejs: 'Node.js', 'node.js': 'Node.js', vuejs: 'Vue.js', nextjs: 'Next.js',
  reactjs: 'React', expressjs: 'Express', aws: 'AWS', gcp: 'GCP', 'c++': 'C++',
  'c#': 'C#', '.net': '.NET', 'ci/cd': 'CI/CD', rest: 'REST APIs', restful: 'REST APIs',
};

export const DEFAULT_SKILLS: string[] = [];

export const cleanSkill = (s: string) => ALIASES[s.toLowerCase().trim()] || s.trim();

export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(SKILL_RE)) found.add(cleanSkill(m[0]));
  if (/(?<!\w)Go(?![\w-])/.test(text)) found.add('Go');
  return [...found];
}

export function classifySkillGaps(text: string, candidateSkills: string[]) {
  const jdSkills = extractSkills(text);
  const candSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  const matched = jdSkills.filter((s) => candSet.has(s.toLowerCase()));
  const gaps = jdSkills.filter((s) => !candSet.has(s.toLowerCase()));

  for (const s of candidateSkills) {
    if (new RegExp(`(?<!\\w)${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, 'i').test(text)) {
      const c = cleanSkill(s);
      if (!matched.includes(c)) matched.push(c);
      const idx = gaps.indexOf(c);
      if (idx !== -1) gaps.splice(idx, 1);
    }
  }

  const total = matched.length + gaps.length;
  const matchScore = total === 0 ? 3 : Math.min(5, Math.max(1, Math.round(1 + (matched.length / total) * 4)));
  return { matchedSkills: matched, missingSkills: gaps, matchScore };
}
