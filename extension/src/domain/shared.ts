import {
  APPLICATION_OUTCOMES,
  COLUMNS,
  type ApplicationEvent,
  type ApplicationOutcome,
  type Column,
  type JobSource,
  type JobStatus,
} from '@/src/types/job';

export const JOB_SOURCES = ['linkedin', 'indeed', 'manual', 'other'] as const satisfies readonly JobSource[];
export const EVENT_TYPES = [
  'clipped',
  'stage_changed',
  'note_added',
  'evaluation_completed',
  're_evaluated',
  'outcome_recorded',
  'follow_up_created',
  'follow_up_updated',
  'follow_up_completed',
  'follow_up_deleted',
  'dossier_opened',
  'dossier_submitted',
  'dossier_closed',
  'answer_recorded',
  'artifact_attached',
  'decision_recorded',
  'policy_overridden',
  'repost_detected',
  'imported',
] as const satisfies readonly ApplicationEvent['type'][];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isJobSource(value: unknown): value is JobSource {
  return typeof value === 'string' && JOB_SOURCES.includes(value as JobSource);
}

export function isColumn(value: unknown): value is Column {
  return typeof value === 'string' && COLUMNS.includes(value as Column);
}

export function isApplicationOutcome(value: unknown): value is ApplicationOutcome {
  return typeof value === 'string' && APPLICATION_OUTCOMES.includes(value as ApplicationOutcome);
}

export function isApplicationEventType(value: unknown): value is ApplicationEvent['type'] {
  return typeof value === 'string' && EVENT_TYPES.includes(value as ApplicationEvent['type']);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return value === 'active' || value === 'discarded';
}

export function cleanString(value: unknown, maxLength = 20_000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}
