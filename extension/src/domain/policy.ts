import type { Job } from '@/src/types/job';
import {
  POLICY_LEVEL_RANK,
  type PolicyCode,
  type PolicyConstraints,
  type PolicyDecision,
  type PolicyGateDefinition,
  type PolicyLevel,
  type PolicyOverride,
  type PolicyReport,
} from '@/src/types/policy';
import { DEFAULT_POLICY_CONSTRAINTS } from '@/src/types/policy';
import { cleanString, isRecord } from './shared';

const GATE_DEFINITIONS: Readonly<Record<PolicyCode, PolicyGateDefinition>> = {
  do_not_apply_company: {
    code: 'do_not_apply_company',
    title: 'Excluded company',
    description: 'You marked this company as one you never apply to.',
    overridable: true,
  },
  do_not_apply_domain: {
    code: 'do_not_apply_domain',
    title: 'Excluded posting domain',
    description: 'The posting or apply link is on a domain you blocked.',
    overridable: true,
  },
  work_authorization: {
    code: 'work_authorization',
    title: 'Work authorization',
    description: 'The posting location may fall outside where you are authorized to work.',
    overridable: true,
  },
  untrusted_source: {
    code: 'untrusted_source',
    title: 'Unrecognized posting source',
    description: 'Neither the posting nor the apply link is on a known job board or ATS host.',
    overridable: true,
  },
  apply_url_mismatch: {
    code: 'apply_url_mismatch',
    title: 'Apply link leaves the posting host',
    description: 'The apply link points at a different host that is not a known ATS.',
    overridable: true,
  },
  posting_freshness_unknown: {
    code: 'posting_freshness_unknown',
    title: 'Posting age unknown',
    description: 'The posting has no captured publish date, so staleness cannot be judged.',
    overridable: true,
  },
  stale_posting: {
    code: 'stale_posting',
    title: 'Stale posting',
    description: 'The posting is older than your staleness threshold.',
    overridable: true,
  },
  deadline_passed: {
    code: 'deadline_passed',
    title: 'Deadline passed',
    description: 'The captured deadline is already in the past.',
    overridable: true,
  },
  compensation_below_floor: {
    code: 'compensation_below_floor',
    title: 'Below compensation floor',
    description: 'The captured compensation range tops out below your stated minimum.',
    overridable: true,
  },
  low_evaluation_confidence: {
    code: 'low_evaluation_confidence',
    title: 'Low evaluation confidence',
    description: 'Too little captured data to trust the score; verify the posting first.',
    overridable: true,
  },
};

export function isPolicyCode(value: unknown): value is PolicyCode {
  return typeof value === 'string' && value in GATE_DEFINITIONS;
}

export function isPolicyLevel(value: unknown): value is PolicyLevel {
  return typeof value === 'string' && (['pass', 'caution', 'block', 'unknown'] as const).includes(value as PolicyLevel);
}

export { GATE_DEFINITIONS as POLICY_GATES };

function stringList(value: unknown, maxItems = 50): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value.slice(0, 200)) {
    const text = cleanString(item, 200);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizePolicyConstraints(value: unknown): PolicyConstraints {
  if (!isRecord(value)) return { ...DEFAULT_POLICY_CONSTRAINTS };
  const compensation = Number(value.minimumCompensation);
  return {
    doNotApplyCompanies: stringList(value.doNotApplyCompanies),
    doNotApplyDomains: stringList(value.doNotApplyDomains),
    authorizedRegions: stringList(value.authorizedRegions),
    minimumCompensation: Number.isFinite(compensation) && compensation > 0 ? Math.min(10_000_000, compensation) : null,
    stalePostingDays: bounded(value.stalePostingDays, DEFAULT_POLICY_CONSTRAINTS.stalePostingDays, 1, 365),
    minEvaluationConfidence: bounded(
      value.minEvaluationConfidence,
      DEFAULT_POLICY_CONSTRAINTS.minEvaluationConfidence,
      0,
      1,
    ),
  };
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** `a.b.example.com` matches an exclusion of `example.com` or `b.example.com`. */
export function hostMatches(host: string | undefined, pattern: string): boolean {
  if (!host) return false;
  const target = pattern.toLowerCase().replace(/^www\./, '').replace(/^\*\./, '').replace(/\/.*$/, '');
  if (!target) return false;
  return host === target || host.endsWith(`.${target}`);
}

/** Small heuristic list of recruiting hosts; presence is a signal, not proof. */
const KNOWN_POSTING_HOST_PATTERNS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'wellfound.com',
  'otta.com',
  'ycombinator.com',
  'dice.com',
  'monster.com',
  'ziprecruiter.com',
  'glassdoor.co.uk',
];

const KNOWN_ATS_HOST_PATTERNS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'workable.com',
  'bamboohr.com',
  'jobvite.com',
  'recruitee.com',
  'personio.de',
  'teamtailor.com',
  'oraclecloud.com',
  'icims.com',
  'taleo.net',
];

export function isKnownPostingHost(host: string | undefined): boolean {
  return KNOWN_POSTING_HOST_PATTERNS.some((pattern) => hostMatches(host, pattern));
}

export function isKnownAtsHost(host: string | undefined): boolean {
  return KNOWN_ATS_HOST_PATTERNS.some((pattern) => hostMatches(host, pattern));
}

function normalizeCompany(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function daysBetween(from: string, to: string): number | undefined {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.floor((end - start) / 86_400_000);
}

export type PolicyOverrideLookup = (jobId: string, code: PolicyCode) => PolicyOverride | undefined;

export interface EvaluatePolicyOptions {
  constraints?: PolicyConstraints;
  overrides?: PolicyOverrideLookup;
  /** Injected clock so the engine stays deterministic in tests. */
  now?: string;
}

interface GateResult {
  level: PolicyLevel;
  reason: string;
  evidenceIds: string[];
}

function decide(
  job: Job,
  constraints: PolicyConstraints,
  now: string,
): { code: PolicyCode; result: GateResult }[] {
  const results: { code: PolicyCode; result: GateResult }[] = [];
  const add = (code: PolicyCode, level: PolicyLevel, reason: string, evidenceIds: string[] = []) =>
    results.push({ code, result: { level, reason, evidenceIds } });

  const companyKey = normalizeCompany(job.company);
  const excludedCompany = constraints.doNotApplyCompanies.find((entry) => normalizeCompany(entry) === companyKey);
  add(
    'do_not_apply_company',
    excludedCompany ? 'block' : 'pass',
    excludedCompany ? `You excluded ${excludedCompany}.` : 'No excluded company matched.',
    ['job-company'],
  );

  const jobHost = hostOf(job.jobUrl);
  const applyHost = hostOf(job.applyUrl);
  const excludedDomain = constraints.doNotApplyDomains.find(
    (entry) => hostMatches(jobHost, entry) || hostMatches(applyHost, entry),
  );
  add('do_not_apply_domain', excludedDomain ? 'block' : 'pass', excludedDomain ? `You excluded the domain ${excludedDomain}.` : 'No excluded domain matched.');

  if (!constraints.authorizedRegions.length) {
    add('work_authorization', 'unknown', 'Add the regions you are authorized to work in to check this posting.', ['job-location']);
  } else {
    const location = (job.location || '').toLowerCase();
    const remote = job.facts?.workMode === 'remote';
    const matches = remote || constraints.authorizedRegions.some((region) => location.includes(region.toLowerCase()));
    add(
      'work_authorization',
      matches ? 'pass' : 'caution',
      matches
        ? 'The posting location is inside your authorized regions.'
        : `The posting location "${job.location || 'unknown'}" is not in your authorized regions.`,
      ['job-location', 'facts-work-mode'],
    );
  }

  const trusted = isKnownPostingHost(jobHost) || isKnownAtsHost(jobHost);
  add(
    'untrusted_source',
    jobHost && !trusted ? 'caution' : 'pass',
    jobHost && !trusted
      ? `The posting is hosted on ${jobHost}, which JobLint does not recognize.`
      : 'The posting host is recognized.',
    ['job-url'],
  );

  add(
    'apply_url_mismatch',
    applyHost && jobHost && applyHost !== jobHost && !isKnownAtsHost(applyHost) ? 'caution' : 'pass',
    applyHost && jobHost && applyHost !== jobHost && !isKnownAtsHost(applyHost)
      ? `The apply link leaves ${jobHost} for ${applyHost}.`
      : 'The apply link stays on a known host.',
    ['apply-url'],
  );

  const postedAt = job.facts?.postedAt;
  const age = postedAt ? daysBetween(postedAt, now) : undefined;
  if (age === undefined) {
    add('posting_freshness_unknown', 'unknown', 'No publish date was captured, so the posting age is unknown.', ['facts-posted-at']);
  } else if (age > constraints.stalePostingDays) {
    add('stale_posting', 'caution', `The posting was captured ${age} days ago (threshold ${constraints.stalePostingDays}).`, ['facts-posted-at']);
  } else {
    add('stale_posting', 'pass', `The posting is ${Math.max(age, 0)} days old.`, ['facts-posted-at']);
  }

  const deadline = job.facts?.deadline;
  if (deadline && deadline.kind !== 'unknown') {
    const remaining = daysBetween(now, deadline.date);
    add(
      'deadline_passed',
      remaining !== undefined && remaining < 0 ? 'block' : 'pass',
      remaining !== undefined && remaining < 0
        ? `The captured deadline ${deadline.date} has passed.`
        : `The captured deadline is ${remaining ?? 'unknown'} days away.`,
      ['facts-deadline'],
    );
  }

  const compensation = job.facts?.compensation;
  if (constraints.minimumCompensation !== null && compensation?.max !== undefined) {
    const below = compensation.max < constraints.minimumCompensation;
    add(
      'compensation_below_floor',
      below ? 'caution' : 'pass',
      below
        ? `The captured range tops out at ${compensation.max}${compensation.currency ? ` ${compensation.currency}` : ''}, below your minimum of ${constraints.minimumCompensation}.`
        : 'The captured range reaches your minimum.',
      ['facts-compensation'],
    );
  }

  const confidence = job.evaluation?.confidence;
  add(
    'low_evaluation_confidence',
    confidence !== undefined && confidence < constraints.minEvaluationConfidence ? 'caution' : 'pass',
    confidence !== undefined
      ? `Evaluation confidence is ${Math.round(confidence * 100)}%.`
      : 'This posting has not been evaluated yet.',
    ['evaluation-confidence'],
  );

  return results;
}

export function effectiveLevel(decision: PolicyDecision): PolicyLevel {
  return decision.override?.level ?? decision.level;
}

export function reducePolicyLevel(levels: PolicyLevel[]): PolicyLevel {
  return levels.reduce<PolicyLevel>(
    (worst, level) => (POLICY_LEVEL_RANK[level] > POLICY_LEVEL_RANK[worst] ? level : worst),
    'pass',
  );
}

/**
 * Headline level. A gate the user never configured reports `unknown` and must
 * not drag a clean posting down; `unknown` only wins when nothing else ran.
 */
export function reduceActionableLevel(levels: PolicyLevel[]): PolicyLevel {
  const actionable = levels.filter((level) => level !== 'unknown');
  return actionable.length ? reducePolicyLevel(actionable) : 'unknown';
}

/**
 * Pure, offline gate evaluation. Overrides are applied last and always lower
 * or equal the blocked level, so a user can deliberately proceed but never
 * accidentally escalate a caution into a silent pass.
 */
export function evaluatePolicy(job: Job, options: EvaluatePolicyOptions = {}): PolicyReport {
  const constraints = options.constraints ? normalizePolicyConstraints(options.constraints) : { ...DEFAULT_POLICY_CONSTRAINTS };
  const now = options.now ?? new Date().toISOString();
  const decisions: PolicyDecision[] = decide(job, constraints, now).map(({ code, result }) => {
    const definition = GATE_DEFINITIONS[code];
    const override = options.overrides?.(job.id, code);
    const decision: PolicyDecision = {
      code,
      level: result.level,
      title: definition.title,
      reason: result.reason,
      evidenceIds: result.evidenceIds,
      overridable: definition.overridable,
    };
    if (override) decision.override = override;
    return decision;
  });
  const levels = decisions.map(effectiveLevel);
  return {
    version: 1,
    jobId: job.id,
    level: reduceActionableLevel(levels),
    decisions,
    blocked: levels.includes('block'),
    unresolved: decisions.filter((decision) => !decision.override && decision.level === 'unknown').length,
    overridden: decisions.filter((decision) => decision.override).length,
    generatedAt: now,
  };
}
