import type { ReminderService } from '@/src/application/reminder-service';
import type { ApplicationEvent, FollowUp, FollowUpKind, FollowUpStatus, Job, UserPreferences } from '@/src/types/job';
import { cleanString } from '@/src/domain/shared';

export interface FollowUpRepository {
  getAll(jobId?: string): Promise<FollowUp[]>;
  getById(id: string): Promise<FollowUp | undefined>;
  save(record: FollowUp): Promise<FollowUp>;
  delete(id: string): Promise<void>;
}

export interface FollowUpJobGateway {
  get(id: string): Promise<Job | undefined>;
  addActivity(jobId: string, type: Extract<ApplicationEvent['type'], `follow_up_${string}`>, metadata?: ApplicationEvent['metadata']): Promise<void>;
}

const KINDS: FollowUpKind[] = ['follow-up', 'application', 'interview', 'custom'];
const STATUSES: FollowUpStatus[] = ['open', 'completed', 'dismissed'];

function validDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function kindValue(value: unknown): FollowUpKind {
  return typeof value === 'string' && KINDS.includes(value as FollowUpKind) ? value as FollowUpKind : 'follow-up';
}

function statusValue(value: unknown): FollowUpStatus {
  return typeof value === 'string' && STATUSES.includes(value as FollowUpStatus) ? value as FollowUpStatus : 'open';
}

export interface CreateFollowUpInput {
  jobId: string;
  title: string;
  dueAt: string;
  kind?: FollowUpKind;
  notes?: string;
  reminderAt?: string;
}

export interface UpdateFollowUpInput {
  title?: string;
  dueAt?: string;
  kind?: FollowUpKind;
  notes?: string;
  status?: FollowUpStatus;
  reminderAt?: string;
}

export class FollowUpService {
  constructor(
    private readonly repository: FollowUpRepository,
    private readonly jobs: FollowUpJobGateway,
    private readonly reminders: ReminderService,
    private readonly settings: { getPreferences(): Promise<UserPreferences> },
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: () => string = () => `follow-up-${crypto.randomUUID()}`,
  ) {}

  list(jobId?: string): Promise<FollowUp[]> {
    return this.repository.getAll(jobId);
  }

  async create(input: CreateFollowUpInput): Promise<FollowUp> {
    const title = cleanString(input.title, 240);
    const dueAt = validDate(input.dueAt);
    if (!title) throw new Error('Follow-up title is required.');
    if (!dueAt) throw new Error('Follow-up due date is invalid.');
    if (!await this.jobs.get(input.jobId)) throw new Error('Job not found.');
    const preferences = await this.settings.getPreferences();
    const fallbackReminder = new Date(Date.parse(dueAt) - (preferences.reminderLeadDays ?? 3) * 86_400_000).toISOString();
    const timestamp = this.now();
    const record: FollowUp = {
      id: this.createId(),
      jobId: input.jobId,
      kind: kindValue(input.kind),
      title,
      dueAt,
      notes: cleanString(input.notes, 4_000),
      status: 'open',
      reminderAt: validDate(input.reminderAt) || fallbackReminder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.repository.save(record);
    await this.reminders.syncFollowUp(saved);
    await this.jobs.addActivity(input.jobId, 'follow_up_created', { followUpId: saved.id, kind: saved.kind });
    return saved;
  }

  async update(id: string, input: UpdateFollowUpInput): Promise<FollowUp> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error('Follow-up not found.');
    const title = input.title === undefined ? existing.title : cleanString(input.title, 240);
    if (!title) throw new Error('Follow-up title is required.');
    const dueAt = input.dueAt === undefined ? existing.dueAt : validDate(input.dueAt);
    if (!dueAt) throw new Error('Follow-up due date is invalid.');
    const status = statusValue(input.status ?? existing.status);
    const updated: FollowUp = {
      ...existing,
      title,
      dueAt,
      kind: input.kind === undefined ? existing.kind : kindValue(input.kind),
      notes: input.notes === undefined ? existing.notes : cleanString(input.notes, 4_000),
      status,
      reminderAt: input.reminderAt === undefined ? existing.reminderAt : validDate(input.reminderAt),
      completedAt: status === 'completed' ? existing.completedAt || this.now() : undefined,
      updatedAt: this.now(),
    };
    const saved = await this.repository.save(updated);
    await this.reminders.syncFollowUp(saved);
    await this.jobs.addActivity(existing.jobId, 'follow_up_updated', { followUpId: id, status });
    return saved;
  }

  async complete(id: string): Promise<FollowUp> {
    return this.update(id, { status: 'completed' });
  }

  async remove(id: string): Promise<true> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error('Follow-up not found.');
    await this.repository.delete(id);
    await this.reminders.removeFollowUp(id);
    await this.jobs.addActivity(existing.jobId, 'follow_up_deleted', { followUpId: id });
    return true;
  }

  async removeForJob(jobId: string): Promise<void> {
    const records = await this.repository.getAll(jobId);
    for (const record of records) {
      await this.repository.delete(record.id);
      await this.reminders.removeFollowUp(record.id);
    }
  }
}
