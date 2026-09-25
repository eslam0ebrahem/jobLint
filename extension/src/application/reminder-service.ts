import type { FollowUp, Job, UserPreferences } from '@/src/types/job';

export interface ReminderMessage {
  id: string;
  title: string;
  body: string;
}

export interface ReminderScheduler {
  schedule(id: string, when: string, kind: 'follow-up' | 'deadline'): Promise<void>;
  cancel(id: string): Promise<void>;
  notify(message: ReminderMessage): Promise<void>;
  onAlarm(listener: (alarm: { name: string }) => void): () => void;
}

export interface ReminderRepository {
  getAll(): Promise<FollowUp[]>;
}

export interface ReminderJobReader {
  getAll(): Promise<Job[]>;
}

function alarmName(kind: 'follow-up' | 'deadline', id: string): string {
  return `joblint:${kind}:${id}`;
}

function parseAlarm(alarm: { name: string }): { kind: 'follow-up' | 'deadline'; id: string } | undefined {
  const match = alarm.name.match(/^joblint:(follow-up|deadline):(.+)$/);
  return match?.[1] && match[2] ? { kind: match[1] as 'follow-up' | 'deadline', id: match[2] } : undefined;
}

function reminderTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function deadlineReminderTime(job: Job, preferences: UserPreferences): string | undefined {
  const date = job.facts?.deadline?.date;
  if (!date) return undefined;
  const due = Date.parse(`${date}T09:00:00.000Z`);
  if (!Number.isFinite(due)) return undefined;
  const lead = Math.max(0, Math.min(30, preferences.reminderLeadDays ?? 3));
  return new Date(due - lead * 86_400_000).toISOString();
}

export class ReminderService {
  constructor(
    private readonly followUps: ReminderRepository,
    private readonly jobs: ReminderJobReader,
    private readonly settings: { getPreferences(): Promise<UserPreferences> },
    private readonly scheduler: ReminderScheduler,
  ) {}

  async syncFollowUp(followUp: FollowUp): Promise<void> {
    const preferences = await this.settings.getPreferences();
    const id = alarmName('follow-up', followUp.id);
    if (!preferences.remindersEnabled || followUp.status !== 'open') {
      await this.scheduler.cancel(id);
      return;
    }
    const when = reminderTime(followUp.reminderAt || followUp.dueAt);
    if (when && Date.parse(when) > Date.now()) await this.scheduler.schedule(id, when, 'follow-up');
    else await this.scheduler.cancel(id);
  }

  async removeFollowUp(id: string): Promise<void> {
    await this.scheduler.cancel(alarmName('follow-up', id));
  }

  async syncJob(job: Job): Promise<void> {
  const preferences = await this.settings.getPreferences();
  const id = alarmName('deadline', job.id);
    if (!preferences.remindersEnabled || job.status !== 'active' || !job.facts?.deadline) {
      await this.scheduler.cancel(id);
      return;
    }
    const when = deadlineReminderTime(job, preferences);
    if (when && Date.parse(when) > Date.now()) await this.scheduler.schedule(id, when, 'deadline');
    else await this.scheduler.cancel(id);
  }

  async syncAll(): Promise<void> {
    const preferences = await this.settings.getPreferences();
    const [followUps, jobs] = await Promise.all([this.followUps.getAll(), this.jobs.getAll()]);
    for (const followUp of followUps) await this.syncFollowUp(followUp);
    for (const job of jobs) await this.syncJob(job);
    if (!preferences.remindersEnabled) {
      // syncFollowUp and syncJob cancel all known records; this explicit pass also
      // protects against records that were removed while preferences were disabled.
      return;
    }
  }

  async handleAlarm(alarm: { name: string }): Promise<boolean> {
    const parsed = parseAlarm(alarm);
    if (!parsed) return false;
    const preferences = await this.settings.getPreferences();
    if (!preferences.remindersEnabled) return true;
    if (parsed.kind === 'follow-up') {
      const followUp = (await this.followUps.getAll()).find((item) => item.id === parsed.id);
      if (!followUp || followUp.status !== 'open') return true;
      const job = (await this.jobs.getAll()).find((item) => item.id === followUp.jobId);
      await this.scheduler.notify({
        id: alarm.name,
        title: 'JobLint follow-up',
        body: `${followUp.title}${job ? ` · ${job.company}` : ''}`,
      });
      return true;
    }
    const job = (await this.jobs.getAll()).find((item) => item.id === parsed.id);
    if (!job || job.status !== 'active' || !job.facts?.deadline) return true;
    await this.scheduler.notify({
      id: alarm.name,
      title: 'JobLint application deadline',
      body: `${job.title} · ${job.company} · deadline ${job.facts.deadline.date}`,
    });
    return true;
  }
}
