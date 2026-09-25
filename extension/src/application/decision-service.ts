import type { DecisionInbox, DecisionInboxItem, DecisionState, JobComparison, JobDecision } from '@/src/types/decisions';
import type { CandidateClaim } from '@/src/types/claims';
import type { ApplicationEvent, Job } from '@/src/types/job';
import type { PolicyConstraints, StoredPolicyOverride } from '@/src/types/policy';
import { compareJobs, isDecisionState, MAX_COMPARISON_ROWS, normalizeDecision } from '@/src/domain/decisions';
import { evaluatePolicy } from '@/src/domain/policy';

export interface DecisionRepository {
  getAll(state?: DecisionState): Promise<JobDecision[]>;
  getByJobId(jobId: string): Promise<JobDecision | undefined>;
  save(input: unknown): Promise<JobDecision | undefined>;
  delete(jobId: string): Promise<boolean>;
}

export interface DecisionJobReader {
  get(id: string): Promise<Job | undefined>;
  list(includeDiscarded?: boolean): Promise<Job[]>;
}

export interface DecisionClaimReader {
  getAll(): Promise<CandidateClaim[]>;
}

export interface DecisionPolicyReader {
  getAll(jobId?: string): Promise<StoredPolicyOverride[]>;
  getConstraints(): Promise<PolicyConstraints>;
}

export interface DecisionEvents {
  changed(jobId: string): void;
}

/** Appends the decision to the job's transition ledger. */
export interface DecisionEventRecorder {
  recordEvent(jobId: string, type: ApplicationEvent['type'], metadata?: ApplicationEvent['metadata']): Promise<ApplicationEvent>;
}

/**
 * Explicit intent on top of the kanban. A decision never changes the score and
 * never moves a column; it records why and what happens next.
 */
export class DecisionService {
  constructor(
    private readonly jobs: DecisionJobReader,
    private readonly repository: DecisionRepository,
    private readonly claims: DecisionClaimReader,
    private readonly policies: DecisionPolicyReader,
    private readonly ledger?: DecisionEventRecorder,
    private readonly events: DecisionEvents = { changed: () => undefined },
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async inbox(): Promise<DecisionInbox> {
    const timestamp = this.now();
    const [jobs, decisions, constraints, overrides] = await Promise.all([
      this.jobs.list(false),
      this.repository.getAll(),
      this.policies.getConstraints(),
      this.policies.getAll(),
    ]);
    const decisionByJob = new Map(decisions.map((decision) => [decision.jobId, decision]));
    const overrideMap = new Map<string, StoredPolicyOverride>(overrides.map((item) => [`${item.jobId}::${item.code}`, item]));
    const items: DecisionInboxItem[] = jobs
      .map((job) => {
        const decision = decisionByJob.get(job.id);
        const report = evaluatePolicy(job, {
          constraints,
          now: timestamp,
          overrides: (_id, code) => overrideMap.get(`${job.id}::${code}`),
        });
        return {
          jobId: job.id,
          title: job.title,
          company: job.company,
          state: decision?.state || 'new',
          score: job.evaluation?.score ?? null,
          policyLevel: report.level,
          policyBlocked: report.blocked,
          decision,
          updatedAt: decision?.updatedAt || job.updatedAt,
        };
      })
      .filter((item) => item.state === 'new' || item.state === 'shortlisted' || item.state === 'revisit' || item.decision);
    const counts = { new: 0, shortlisted: 0, deferred: 0, applied: 0, passed: 0, revisit: 0 } as Record<DecisionState, number>;
    for (const item of items) counts[item.state] += 1;
    return {
      version: 1,
      generatedAt: timestamp,
      items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      counts,
    };
  }

  async set(jobId: string, input: { state?: unknown; rationale?: unknown; nextAction?: unknown }): Promise<JobDecision> {
    if (!(await this.jobs.get(jobId))) throw new Error('Job not found.');
    if (input.state !== undefined && !isDecisionState(input.state)) throw new Error('Unknown decision state.');
    const existing = await this.repository.getByJobId(jobId);
    const decision = normalizeDecision(
      {
        ...existing,
        jobId,
        state: input.state,
        rationale: typeof input.rationale === 'string' ? input.rationale : existing?.rationale,
        nextAction: typeof input.nextAction === 'string' ? input.nextAction : existing?.nextAction,
      },
      { existing, timestamp: this.now() },
    );
    if (!decision) throw new Error('Could not save the decision.');
    const saved = await this.repository.save(decision);
    if (!saved) throw new Error('Could not save the decision.');
    await this.record(jobId, saved.state);
    this.events.changed(jobId);
    return saved;
  }

  private async record(jobId: string, state: DecisionState): Promise<void> {
    try {
      await this.ledger?.recordEvent(jobId, 'decision_recorded', { decision: state });
    } catch {
      // The decision is already persisted; the ledger entry is advisory.
    }
  }

  async clear(jobId: string): Promise<true> {
    const removed = await this.repository.delete(jobId);
    if (!removed) throw new Error('No decision recorded for this job.');
    this.events.changed(jobId);
    return true;
  }

  /** Side-by-side comparison of 2-5 chosen jobs. */
  async compare(jobIds: string[]): Promise<JobComparison> {
    const unique = [...new Set(jobIds.filter(Boolean))].slice(0, MAX_COMPARISON_ROWS);
    if (unique.length < 2) throw new Error('Pick at least two jobs to compare.');
    const timestamp = this.now();
    const [claims, constraints, overrides, decisions] = await Promise.all([
      this.claims.getAll(),
      this.policies.getConstraints(),
      this.policies.getAll(),
      this.repository.getAll(),
    ]);
    const overrideMap = new Map<string, StoredPolicyOverride>(overrides.map((item) => [`${item.jobId}::${item.code}`, item]));
    const decisionMap = new Map(decisions.map((decision) => [decision.jobId, decision]));
    const jobs = (await Promise.all(unique.map((id) => this.jobs.get(id)))).filter(
      (job): job is NonNullable<typeof job> => Boolean(job),
    );
    if (jobs.length < 2) throw new Error('Pick at least two saved jobs to compare.');
    const policies = new Map(
      jobs.map((job) => [
        job.id,
        evaluatePolicy(job, {
          constraints,
          now: timestamp,
          overrides: (_id, code) => overrideMap.get(`${job.id}::${code}`),
        }),
      ]),
    );
    return compareJobs(jobs, { claims, policies, decisions: decisionMap, now: timestamp });
  }
}
