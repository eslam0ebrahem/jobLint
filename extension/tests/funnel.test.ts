import { describe, expect, it } from 'vitest';
import { calculateFunnelAnalytics, MINIMUM_FUNNEL_SAMPLES } from '@/src/domain/funnel-analytics';
import type { ApplicationEvent, Column, FollowUp, Job, JobSource } from '@/src/types/job';

const NOW = '2026-09-25T12:00:00.000Z';

function job(id: string, column: Column, source: JobSource = 'linkedin', clippedDaysAgo = 10): Job {
  const clipped = new Date(Date.parse(NOW) - clippedDaysAgo * 86_400_000).toISOString();
  return {
    id,
    source,
    title: `Role ${id}`,
    company: 'Acme',
    column,
    status: 'active',
    clippedAt: clipped,
    createdAt: clipped,
    updatedAt: NOW,
  };
}

function event(id: string, jobId: string, to: Column, daysAfterClip: number): ApplicationEvent {
  const clipped = job(jobId, 'to_apply').clippedAt;
  return {
    id,
    jobId,
    type: 'stage_changed',
    at: new Date(Date.parse(clipped) + daysAfterClip * 86_400_000).toISOString(),
    to,
  };
}

function followUp(id: string, jobId: string, status: FollowUp['status'] = 'completed'): FollowUp {
  return {
    id,
    jobId,
    kind: 'follow-up',
    title: 'Send thank-you',
    dueAt: NOW,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('funnel analytics', () => {
  it('stays descriptive below the sample floor', () => {
    const jobs = [job('a', 'interviewing'), job('b', 'rejected')];
    const funnel = calculateFunnelAnalytics({ jobs, events: [event('e1', 'a', 'applied', 2), event('e2', 'a', 'interviewing', 6)] }, NOW);
    expect(funnel).toMatchObject({ version: 1, status: 'insufficient-data', sampleSize: 2, minimumSampleSize: MINIMUM_FUNNEL_SAMPLES });
    expect(funnel.timing).toMatchObject({ samples: 1, medianDaysToApply: null, medianDaysToResponse: null, p90DaysToApply: null });
    expect(funnel.channels.every((channel) => channel.responseRate === null)).toBe(true);
    expect(funnel.message).toContain(`at least ${MINIMUM_FUNNEL_SAMPLES} decided applications`);
  });

  it('excludes in-flight applications from every rate', () => {
    const jobs = [
      ...Array.from({ length: MINIMUM_FUNNEL_SAMPLES }, (_, index) => job(`decided-${index}`, index % 2 ? 'rejected' : 'offer')),
      job('pending', 'applied', 'manual'),
    ];
    const funnel = calculateFunnelAnalytics({ jobs }, NOW);
    expect(funnel.sampleSize).toBe(MINIMUM_FUNNEL_SAMPLES);
    expect(funnel.inFlight).toBe(1);
    expect(funnel.inFlightNote).toContain('1 application still in flight');
    expect(funnel.inFlightNote).toContain('excluded');
    const pending = funnel.channels.find((channel) => channel.channel === 'manual');
    expect(pending).toMatchObject({ clipped: 1, inFlight: 1, responseCount: 0, offerCount: 0 });
    expect(pending?.offerRate).toBeNull();
    const linkedin = funnel.channels.find((channel) => channel.channel === 'linkedin');
    expect(linkedin?.offerRate).toBe(0.5);
  });

  it('computes channel yield and timing once the floor is met', () => {
    const jobs = Array.from({ length: MINIMUM_FUNNEL_SAMPLES }, (_, index) =>
      job(`id-${index}`, index % 2 ? 'rejected' : 'interviewing', 'indeed'),
    );
    const events = jobs.flatMap((item, index) => [
      event(`a-${index}`, item.id, 'applied', 2 + index),
      event(`b-${index}`, item.id, index % 2 ? 'rejected' : 'interviewing', 8 + index),
    ]);
    const first = jobs[0];
    if (!first) throw new Error('Expected at least one job.');
    const funnel = calculateFunnelAnalytics({ jobs, events, followUps: [followUp('f1', first.id)] }, NOW);
    expect(funnel.status).toBe('ready');
    const indeed = funnel.channels.find((channel) => channel.channel === 'indeed');
    expect(indeed).toMatchObject({ clipped: MINIMUM_FUNNEL_SAMPLES, rejectedCount: 5, interviewCount: 5 });
    expect(indeed?.interviewRate).toBe(0.5);
    expect(indeed?.offerRate).toBe(0);
    expect(funnel.timing.medianDaysToApply).toBe(6.5);
    // Only the five interviewing jobs ever recorded a response milestone.
    expect(funnel.timing.medianDaysToResponse).toBe(12);
    // Nearest-rank p90 over the ten 2..11 day values.
    expect(funnel.timing.p90DaysToApply).toBe(10);
    expect(funnel.stages.find((stage) => stage.id === 'rejected')?.count).toBe(5);
    expect(funnel.followUps).toMatchObject({ total: 1, open: 0, completed: 1, followedUpAndAdvanced: 1, advancedRate: null });
  });

  it('drops a milestone event that predates the clip instead of reporting a negative time', () => {
    const jobs = Array.from({ length: MINIMUM_FUNNEL_SAMPLES }, (_, index) => job(`x-${index}`, 'rejected'));
    const backdated = calculateFunnelAnalytics({ jobs, events: [{ ...event('bad', 'x-0', 'applied', 5), at: '1999-01-01T00:00:00.000Z' }] }, NOW);
    expect(backdated.timing.samples).toBe(0);
    expect(backdated.timing.medianDaysToApply).toBeNull();
    const healthy = calculateFunnelAnalytics({ jobs, events: [event('good', 'x-0', 'applied', 4)] }, NOW);
    expect(healthy.timing.samples).toBe(1);
    expect(healthy.timing.medianDaysToApply).toBe(4);
    expect(calculateFunnelAnalytics({ jobs }, NOW)).toEqual(calculateFunnelAnalytics({ jobs }, NOW));
  });

  it('handles an empty tracker without dividing by zero', () => {
    const funnel = calculateFunnelAnalytics({ jobs: [] }, NOW);
    expect(funnel).toMatchObject({ status: 'insufficient-data', sampleSize: 0, inFlight: 0 });
    expect(funnel.timing.medianDaysToOffer).toBeNull();
    expect(funnel.followUps.advancedRate).toBeNull();
    expect(funnel.inFlightNote).toBe('No applications are in flight.');
  });
});
