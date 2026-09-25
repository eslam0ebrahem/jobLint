import type { ApplicationEvent, Profile, UserPreferences } from '@/src/types/job';
import {
  parseBackupPayload,
  type BackupConflictStrategy,
  type BackupImportResult,
  type BackupPayload,
  type BackupPreview,
  type ParsedBackup,
} from '@/src/domain/backup';
import type { JobRepository } from './job-service';
import type { SaveSettingsOptions } from './settings-service';

export interface BackupSettings {
  getProfile(): Promise<Profile>;
  getPreferences(): Promise<UserPreferences>;
  saveProfile(profile: Profile, options?: SaveSettingsOptions): Promise<Profile>;
  savePreferences(preferences: UserPreferences, options?: SaveSettingsOptions): Promise<UserPreferences>;
}

export interface BackupEvents {
  jobsChanged(reason: string): void;
  metadataChanged(): void;
}

export class BackupService {
  constructor(
    private readonly jobs: JobRepository,
    private readonly settings: BackupSettings,
    private readonly events: BackupEvents,
    private readonly parse: (payload: unknown) => ParsedBackup = parseBackupPayload,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async preview(payload: unknown): Promise<BackupPreview> {
    const parsed = this.parse(payload);
    let conflictCount = 0;
    for (const item of parsed.jobs) {
      if (await this.jobs.findJobByIdentity(item.input)) conflictCount += 1;
    }
    return {
      valid: parsed.jobs.length > 0 || parsed.events.length > 0 || Boolean(parsed.profile || parsed.preferences),
      schemaVersion: parsed.schemaVersion,
      jobCount: parsed.jobs.length,
      eventCount: parsed.events.length,
      conflictCount,
      hasProfile: Boolean(parsed.profile),
      hasPreferences: Boolean(parsed.preferences),
      issues: parsed.issues,
    };
  }

  async export(): Promise<BackupPayload> {
    const [jobs, events, profile, preferences] = await Promise.all([
      this.jobs.getAllJobs(),
      this.jobs.getEvents(),
      this.settings.getProfile(),
      this.settings.getPreferences(),
    ]);
    return {
      schemaVersion: 2,
      exportedAt: this.now(),
      jobs,
      events,
      profile,
      preferences,
    };
  }

  async import(payload: unknown, conflictStrategy: BackupConflictStrategy = 'skip'): Promise<BackupImportResult> {
    const parsed = this.parse(payload);
    const issues = [...parsed.issues];
    const idMap = new Map<string, string>();
    let imported = 0;
    let replaced = 0;
    let skipped = 0;

    for (const item of parsed.jobs) {
      const existing = await this.jobs.findJobByIdentity(item.input);
      if (existing && conflictStrategy === 'skip') {
        skipped += 1;
        issues.push({ index: parsed.jobs.indexOf(item), reason: `Skipped duplicate of ${existing.title} at ${existing.company}.` });
        if (item.sourceId) idMap.set(item.sourceId, existing.id);
        continue;
      }
      const result = await this.jobs.saveJob(item.input, {
        creationEventType: 'imported',
        eventType: existing ? 'imported' : undefined,
        overwriteWorkflow: Boolean(existing),
      });
      if (item.sourceId) idMap.set(item.sourceId, result.id);
      if (result.isNew) imported += 1;
      else replaced += 1;
    }

    const remappedEvents: ApplicationEvent[] = [];
    for (const event of parsed.events) {
      const jobId = idMap.get(event.jobId) || event.jobId;
      if (await this.jobs.getJob(jobId)) remappedEvents.push({ ...event, jobId });
    }
    if (remappedEvents.length) await this.jobs.saveEvents(remappedEvents);

    let metadataImported = false;
    if (parsed.profile) {
      await this.settings.saveProfile(parsed.profile, { notify: false });
      metadataImported = true;
    }
    if (parsed.preferences) {
      await this.settings.savePreferences(parsed.preferences, { notify: false });
      metadataImported = true;
    }
    this.events.jobsChanged('backup-imported');
    if (metadataImported) this.events.metadataChanged();
    return {
      imported,
      replaced,
      skipped,
      eventsImported: remappedEvents.length,
      metadataImported,
      issues,
    };
  }
}
