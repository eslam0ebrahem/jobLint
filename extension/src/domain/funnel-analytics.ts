import type { AnalyticsStatus, ChannelYield, FollowUpAnalytics, FunnelAnalytics, FunnelStage, FunnelTiming } from '@/src/types/analytics';
import type { ApplicationEvent, Column, FollowUp, Job, JobSource } from '@/src/types/job';
import { JOB_SOURCES } from './shared';

/**
 * Below this many *decided* applications the funnel is descriptive only.
 * The same floor pattern as calibration keeps small samples from becoming
 * confident-sounding advice.
 */
export const MINIMUM_FUNNEL_SAMPLES = 10;

const STAGE_DEFINITIONS: FunnelStage[] = [
  { id: 'to_apply', label: 'To apply', columns: ['to_apply'], count: 0 },
  { id: 'applied', label: 'Applied', columns: ['applied', 'assessment'], count: 0 },
  { id: 'interviewing', label: 'Interviewing', columns: ['interviewing'], count: 0 },
  { id: 'offer', label: 'Offer', columns: ['offer'], count: 0 },
  { id: 'rejected', label: 'Rejected', columns: ['rejected'], count: 0 },
];

const RESPONSE_COLUMNS: Column[] = ['assessment', 'interviewing', 'offer'];
const POSITIVE_OUTCOMES = new Set(['interview', 'offer']);
const DECIDED_OUTCOMES = new Set(['interview', 'offer', 'rejected', 'withdrawn', 'not_interested']);

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rate(numerator: number, denominator: number, status: AnalyticsStatus): number | null {
  if (!denominator || status !== 'ready') return null;
  return round(numerator / denominator);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] || 0 : ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2;
  return round(value, 1);
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return round(sorted[index] ?? 0, 1);
}

function days(from: string, to: string): number | undefined {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return (end - start) / 86_400_000;
}

/** A job counts as applied once it leaves `to_apply` or an outcome is recorded. */
function isDecided(job: Job): boolean {
  if (job.outcome && DECIDED_OUTCOMES.has(job.outcome)) return true;
  return RESPONSE_COLUMNS.includes(job.column) || job.column === 'rejected';
}

function isInFlight(job: Job): boolean {
  return !isDecided(job) && job.column === 'applied';
}

function channelOf(job: Job): JobSource | 'unknown' {
  return JOB_SOURCES.includes(job.source) ? job.source : 'unknown';
}

/** Earliest timestamp at which a job reached each milestone, from its event log. */
function milestoneTimes(events: ApplicationEvent[]): {
  appliedAt?: string;
  responseAt?: string;
  offerAt?: string;
} {
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const result: { appliedAt?: string; responseAt?: string; offerAt?: string } = {};
  for (const event of ordered) {
    if (!result.appliedAt && event.to && event.to !== 'to_apply') result.appliedAt = event.at;
    if (!result.responseAt && event.to && RESPONSE_COLUMNS.includes(event.to)) result.responseAt = event.at;
    if (!result.offerAt && (event.to === 'offer' || event.outcome === 'offer')) result.offerAt = event.at;
  }
  return result;
}

export interface FunnelInput {
  jobs: Job[];
  events?: ApplicationEvent[];
  followUps?: FollowUp[];
}

export function calculateFunnelAnalytics(
  input: FunnelInput,
  generatedAt = new Date().toISOString(),
): FunnelAnalytics {
  const { jobs, events = [], followUps = [] } = input;
  const eventsByJob = new Map<string, ApplicationEvent[]>();
  for (const event of events) {
    const list = eventsByJob.get(event.jobId);
    if (list) list.push(event);
    else eventsByJob.set(event.jobId, [event]);
  }

  const active = jobs.filter((job) => job.status === 'active');
  const decided = active.filter(isDecided);
  const inFlight = active.filter(isInFlight);
  const sampleSize = decided.length;
  const status: AnalyticsStatus = sampleSize >= MINIMUM_FUNNEL_SAMPLES ? 'ready' : 'insufficient-data';

  const stages = STAGE_DEFINITIONS.map((stage) => ({
    ...stage,
    count: active.filter((job) => stage.columns.includes(job.column)).length,
  }));

  const channels = new Map<JobSource | 'unknown', ChannelYield>();
  const ensureChannel = (channel: JobSource | 'unknown'): ChannelYield => {
    const existing = channels.get(channel);
    if (existing) return existing;
    const created: ChannelYield = {
      channel,
      clipped: 0,
      applied: 0,
      responseCount: 0,
      interviewCount: 0,
      offerCount: 0,
      rejectedCount: 0,
      inFlight: 0,
      responseRate: null,
      interviewRate: null,
      offerRate: null,
    };
    channels.set(channel, created);
    return created;
  };

  const toApplyDays: number[] = [];
  const responseDays: number[] = [];
  const offerDays: number[] = [];

  for (const job of active) {
    const channel = ensureChannel(channelOf(job));
    channel.clipped += 1;
    const applied = job.column !== 'to_apply' || Boolean(job.outcome);
    if (applied) channel.applied += 1;
    if (RESPONSE_COLUMNS.includes(job.column) || POSITIVE_OUTCOMES.has(job.outcome || '')) channel.responseCount += 1;
    if (job.column === 'interviewing' || job.outcome === 'interview') channel.interviewCount += 1;
    if (job.column === 'offer' || job.outcome === 'offer') channel.offerCount += 1;
    if (job.column === 'rejected' || job.outcome === 'rejected') channel.rejectedCount += 1;
    if (isInFlight(job)) channel.inFlight += 1;

    if (isDecided(job)) {
      const milestones = milestoneTimes(eventsByJob.get(job.id) || []);
      const appliedAt = milestones.appliedAt;
      const responseAt = milestones.responseAt;
      const offerAt = milestones.offerAt;
      if (appliedAt) {
        const value = days(job.clippedAt, appliedAt);
        if (value !== undefined) toApplyDays.push(value);
      }
      if (responseAt) {
        const value = days(job.clippedAt, responseAt);
        if (value !== undefined) responseDays.push(value);
      }
      if (offerAt) {
        const value = days(job.clippedAt, offerAt);
        if (value !== undefined) offerDays.push(value);
      }
    }
  }

  const channelRows = [...channels.values()]
    .map((channel) => {
      const decidedCount = channel.responseCount + channel.rejectedCount;
      return {
        ...channel,
        responseRate: rate(channel.responseCount, decidedCount, status),
        interviewRate: rate(channel.interviewCount, decidedCount, status),
        offerRate: rate(channel.offerCount, decidedCount, status),
      };
    })
    .sort((a, b) => b.clipped - a.clipped);

  const timing: FunnelTiming = {
    samples: toApplyDays.length,
    medianDaysToApply: status === 'ready' ? median(toApplyDays) : null,
    medianDaysToResponse: status === 'ready' ? median(responseDays) : null,
    medianDaysToOffer: status === 'ready' ? median(offerDays) : null,
    p90DaysToApply: status === 'ready' ? percentile(toApplyDays, 0.9) : null,
  };

  const followedUpJobIds = new Set(followUps.map((followUp) => followUp.jobId));
  const followedUpDecided = decided.filter((job) => followedUpJobIds.has(job.id));
  const followUpStats: FollowUpAnalytics = {
    total: followUps.length,
    open: followUps.filter((item) => item.status === 'open').length,
    completed: followUps.filter((item) => item.status === 'completed').length,
    followedUpAndAdvanced: followedUpDecided.filter(
      (job) => job.column === 'interviewing' || job.column === 'offer' || job.column === 'rejected' || POSITIVE_OUTCOMES.has(job.outcome || ''),
    ).length,
    advancedRate: null,
  };
  if (followedUpDecided.length >= MINIMUM_FUNNEL_SAMPLES) {
    followUpStats.advancedRate = rate(followUpStats.followedUpAndAdvanced, followedUpDecided.length, 'ready');
  }

  return {
    version: 1,
    generatedAt,
    status,
    minimumSampleSize: MINIMUM_FUNNEL_SAMPLES,
    sampleSize,
    stages,
    channels: channelRows,
    timing,
    followUps: followUpStats,
    inFlight: inFlight.length,
    inFlightNote:
      inFlight.length > 0
        ? `${inFlight.length} application${inFlight.length === 1 ? '' : 's'} still in flight. They are excluded from every rate below so pending work never looks like a rejection.`
        : 'No applications are in flight.',
    message:
      status === 'insufficient-data'
        ? `Collect at least ${MINIMUM_FUNNEL_SAMPLES} decided applications before treating channel or timing comparisons as directional evidence.`
        : 'Funnel figures are computed from your locally recorded transitions. They are descriptive only and never retrain the evaluator.',
  };
}
