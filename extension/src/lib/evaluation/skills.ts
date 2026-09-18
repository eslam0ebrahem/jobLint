/**
 * skills.ts — Skill vocabulary, canonicalization, and gap analysis.
 * Inspired by career-ops/skill-extract.mjs and jd-skill-gap.mjs
 */

export const SKILL_TOKENS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Ruby', 'Java', 'Golang', 'Rust', 'PHP',
  'Kotlin', 'Swift', 'Scala', 'Elixir', 'C\\+\\+', 'C#', '\\.NET', 'SQL',
  // Frameworks & Libraries
  'React Native', 'React', 'Angular', 'Vue\\.?js', 'Vue', 'Svelte', 'Next\\.?js',
  'Django', 'Flask', 'FastAPI', 'Rails', 'Laravel', 'Symfony', 'Spring',
  'Node\\.?js', 'NodeJS', 'Express\\.?js', 'Express', 'Tailwind',
  // Databases & Stores
  'MongoDB', 'MySQL', 'PostgreSQL', 'Postgres', 'Redis', 'Elasticsearch',
  'Snowflake', 'BigQuery', 'DynamoDB', 'Cassandra', 'SQLite',
  // Cloud & DevOps
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'k8s', 'Terraform',
  'Ansible', 'Helm', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CI/CD', 'Linux',
  // APIs & Messaging
  'GraphQL', 'REST(?:ful)?(?:\\s*APIs?)?', 'gRPC', 'Kafka', 'RabbitMQ', 'Socket\\.IO', 'WebSockets',
  // AI, Data & ML
  'PyTorch', 'TensorFlow', 'scikit-learn', 'Pandas', 'NumPy', 'Spark',
  'Airflow', 'dbt', 'MLOps', 'LangChain', 'LlamaIndex', 'RAG', 'LLMs?',
];

const SKILL_REGEX = new RegExp('(?<!\\w)(?:' + SKILL_TOKENS.join('|') + ')(?!\\w)', 'gi');

export const CANONICAL_MAP: Record<string, string> = {
  k8s: 'Kubernetes', golang: 'Go', postgres: 'PostgreSQL', postgresql: 'PostgreSQL',
  nodejs: 'Node.js', 'node.js': 'Node.js', vuejs: 'Vue.js', 'vue.js': 'Vue.js',
  nextjs: 'Next.js', 'next.js': 'Next.js', reactjs: 'React', 'react.js': 'React',
  expressjs: 'Express', 'express.js': 'Express', llm: 'LLMs', llms: 'LLMs',
  aws: 'AWS', gcp: 'GCP', 'c++': 'C++', 'c#': 'C#', '.net': '.NET', 'ci/cd': 'CI/CD',
  'github actions': 'GitHub Actions', 'gitlab ci': 'GitLab CI',
};

export const DEFAULT_CANDIDATE_SKILLS = [
  'Node.js', 'Express', 'MongoDB', 'SQL', 'PostgreSQL', 'Redis',
  'TypeScript', 'React', 'Docker', 'Kubernetes', 'AWS', 'REST APIs',
];

export function canonicalizeSkill(token: string): string {
  const lower = token.toLowerCase().trim();
  if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];
  if (/^rest/i.test(token)) return 'REST APIs';
  return token.trim();
}

export function extractSkills(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(SKILL_REGEX)) {
    found.add(canonicalizeSkill(m[0]));
  }
  if (/(?<!\w)Go(?![\w-])/.test(text)) found.add('Go');
  return Array.from(found);
}

/**
 * Classifies skills extracted from text into matched vs gap categories
 * against the candidate profile skills.
 */
export function classifySkillGaps(
  jdText: string,
  candidateSkills: string[]
): { matchedSkills: string[]; missingSkills: string[]; matchScore: number } {
  const jdSkills = extractSkills(jdText);
  const candSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  const matched: string[] = [];
  const gaps: string[] = [];

  for (const s of jdSkills) {
    const canon = canonicalizeSkill(s);
    if (candSet.has(s.toLowerCase()) || candSet.has(canon.toLowerCase())) {
      matched.push(canon);
    } else {
      gaps.push(canon);
    }
  }

  // Also check if custom candidate skills are explicitly present in the JD text
  for (const s of candidateSkills) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i');
    if (re.test(jdText)) {
      const canon = canonicalizeSkill(s);
      if (!matched.includes(canon)) {
        matched.push(canon);
        const gIdx = gaps.indexOf(canon);
        if (gIdx !== -1) gaps.splice(gIdx, 1);
      }
    }
  }

  const total = matched.length + gaps.length;
  let matchScore = 3;
  if (total > 0) {
    const ratio = matched.length / total;
    if (ratio >= 0.65 || matched.length >= 5) matchScore = 5;
    else if (ratio >= 0.45 || matched.length >= 3) matchScore = 4;
    else if (ratio >= 0.25 || matched.length >= 2) matchScore = 3;
    else if (matched.length >= 1) matchScore = 2;
    else matchScore = 1;
  }

  return { matchedSkills: matched, missingSkills: gaps, matchScore };
}
