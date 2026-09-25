import type {
  ApplicationOutcome,
  Column,
  Job,
  JobInsightSummary,
  NewJob,
} from '@/src/types/job';
import { COLUMNS } from '@/src/types/job';
import { normalizeEvaluation } from '@/src/lib/evaluation/normalize';
import { createJobIdentity, sanitizeExternalUrl } from './identity';
import { isApplicationOutcome, isColumn, isJobSource } from './shared';

export interface NormalizeJobOptions {
  existing?: Job;
  preserveTimestamps?: boolean;
  overwriteWorkflow?: boolean;
  timestamp: string;
  createId: (prefix: string) => string;
}

export function normalizeJob(input: NewJob | Job, options: NormalizeJobOptions): Job {
  const { existing, preserveTimestamps = false, overwriteWorkflow = false, timestamp, createId } = options;
  const source = isJobSource(input.source) ? input.source : 'other';
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Untitled job';
  const company = typeof input.company === 'string' && input.company.trim() ? input.company.trim() : 'Unknown company';
  const identity = createJobIdentity({ source, jobId: input.jobId, jobUrl: input.jobUrl, title, company });
  const id = existing?.id || input.id || (identity.sourceJobId ? `${identity.source}-${identity.sourceJobId}` : createId('job'));
  const merged = {
    ...existing,
    ...input,
    id,
    identity,
    source,
    title,
    company,
    column: overwriteWorkflow ? input.column || existing?.column || 'to_apply' : existing?.column || input.column || 'to_apply',
    status: overwriteWorkflow ? input.status || existing?.status || 'active' : existing?.status || input.status || 'active',
    clippedAt: existing?.clippedAt || ('clippedAt' in input ? input.clippedAt : undefined) || timestamp,
    createdAt: existing?.createdAt || ('createdAt' in input ? input.createdAt : undefined) || timestamp,
    updatedAt: preserveTimestamps ? ('updatedAt' in input ? input.updatedAt : undefined) || timestamp : timestamp,
  } as Job;
  if (merged.evaluation) merged.evaluation = normalizeEvaluation(merged.evaluation) || undefined;
  merged.jobUrl = sanitizeExternalUrl(merged.jobUrl);
  merged.applyUrl = sanitizeExternalUrl(merged.applyUrl);
  if (!isColumn(merged.column)) merged.column = 'to_apply';
  if (merged.status !== 'discarded') merged.status = 'active';
  if (merged.outcome && !isApplicationOutcome(merged.outcome)) delete merged.outcome;
  return merged;
}

export function calculateJobInsights(jobs: Job[]): JobInsightSummary {
  const stageCounts = Object.fromEntries(COLUMNS.map((column) => [column, 0])) as Record<Column, number>;
  const outcomeCounts: Partial<Record<ApplicationOutcome, number>> = {};
  const sourceCounts: JobInsightSummary['sourceCounts'] = {};
  const gapCounts = new Map<string, number>();
  const flagCounts = new Map<string, number>();
  let fitTotal = 0;
  let opportunityTotal = 0;
  let safetyTotal = 0;
  let evaluatedJobs = 0;

  for (const job of jobs) {
    stageCounts[job.column] = (stageCounts[job.column] || 0) + 1;
    if (job.outcome) outcomeCounts[job.outcome] = (outcomeCounts[job.outcome] || 0) + 1;
    sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
    if (job.evaluation) {
      fitTotal += job.evaluation.fitScore;
      opportunityTotal += job.evaluation.opportunityScore;
      safetyTotal += job.evaluation.safetyScore;
      evaluatedJobs += 1;
      for (const gap of job.evaluation.missingSkills) gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
      for (const flag of job.evaluation.redFlags) flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }

  const top = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value]) => value);
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    totalJobs: jobs.length,
    activeJobs: jobs.length,
    evaluatedJobs,
    stageCounts,
    outcomeCounts,
    averageFit: evaluatedJobs ? round(fitTotal / evaluatedJobs) : null,
    averageOpportunity: evaluatedJobs ? round(opportunityTotal / evaluatedJobs) : null,
    averageSafety: evaluatedJobs ? round(safetyTotal / evaluatedJobs) : null,
    topGaps: top(gapCounts),
    topFlags: top(flagCounts),
    sourceCounts,
  };
}
