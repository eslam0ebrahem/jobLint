import type { ApplicationEvent, FollowUp, Profile, UserPreferences } from '@/src/types/job';
import type { CandidateClaim } from '@/src/types/claims';
import type { ApplicationDossier } from '@/src/types/dossier';
import type { JobDecision } from '@/src/types/decisions';
import type { StoredPolicyOverride } from '@/src/types/policy';
import {
  claimDedupeKey,
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
  getPolicyConstraints?(): Promise<unknown>;
  savePolicyConstraints?(constraints: unknown, options?: SaveSettingsOptions): Promise<unknown>;
}

export interface BackupEvents {
  jobsChanged(reason: string): void;
  metadataChanged(): void;
  evidenceChanged?(): void;
}

export interface BackupFollowUpRepository {
  getAll(): Promise<FollowUp[]>;
  save(record: FollowUp): Promise<FollowUp>;
}

export type BackupClaimSummary = Pick<CandidateClaim, 'id' | 'kind' | 'label'>;

export interface BackupEvidenceData {
  listClaims(): Promise<{ claims: BackupClaimSummary[] }>;
  listDossiers(jobId?: string): Promise<ApplicationDossier[]>;
  listDecisions(): Promise<JobDecision[]>;
  listPolicyOverrides(): Promise<StoredPolicyOverride[]>;
  saveClaim(input: unknown): Promise<BackupClaimSummary | undefined>;
  saveDossier(input: unknown): Promise<ApplicationDossier | undefined>;
  saveDecision(input: unknown): Promise<JobDecision | undefined>;
  savePolicyOverride(input: unknown): Promise<StoredPolicyOverride | undefined>;
}

export class BackupService {
  constructor(
    private readonly jobs: JobRepository,
    private readonly settings: BackupSettings,
    private readonly events: BackupEvents,
    private readonly parse: (payload: unknown) => ParsedBackup = parseBackupPayload,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly followUps?: BackupFollowUpRepository,
    private readonly evidence?: BackupEvidenceData,
  ) {}

  async preview(payload: unknown): Promise<BackupPreview> {
    const parsed = this.parse(payload);
    let conflictCount = 0;
    for (const item of parsed.jobs) {
      if (await this.jobs.findJobByIdentity(item.input)) conflictCount += 1;
    }
    return {
      valid:
        parsed.jobs.length > 0 ||
        parsed.events.length > 0 ||
        parsed.followUps.length > 0 ||
        parsed.claims.length > 0 ||
        parsed.dossiers.length > 0 ||
        parsed.decisions.length > 0 ||
        Boolean(parsed.profile || parsed.preferences || parsed.policyConstraints),
      schemaVersion: parsed.schemaVersion,
      jobCount: parsed.jobs.length,
      eventCount: parsed.events.length,
      followUpCount: parsed.followUps.length,
      claimCount: parsed.claims.length,
      dossierCount: parsed.dossiers.length,
      decisionCount: parsed.decisions.length,
      policyOverrideCount: parsed.policyOverrides.length,
      conflictCount,
      hasProfile: Boolean(parsed.profile),
      hasPreferences: Boolean(parsed.preferences),
      hasPolicyConstraints: Boolean(parsed.policyConstraints),
      issues: parsed.issues,
    };
  }

  async export(): Promise<BackupPayload> {
    const [jobs, events, profile, preferences, storedFollowUps, claims, dossiers, decisions, policyOverrides, policyConstraints] =
      await Promise.all([
        this.jobs.getAllJobs(),
        this.jobs.getEvents(),
        this.settings.getProfile(),
        this.settings.getPreferences(),
        this.followUps?.getAll(),
        this.evidence?.listClaims(),
        this.evidence?.listDossiers(),
        this.evidence?.listDecisions(),
        this.evidence?.listPolicyOverrides(),
        this.settings.getPolicyConstraints?.(),
      ]);
    const followUps = this.followUps ? await storedFollowUps : undefined;
    return {
      schemaVersion: 3,
      exportedAt: this.now(),
      jobs,
      events,
      ...(followUps ? { followUps } : {}),
      ...(claims ? { claims: claims.claims as CandidateClaim[] } : {}),
      ...(dossiers ? { dossiers } : {}),
      ...(decisions ? { decisions } : {}),
      ...(policyOverrides ? { policyOverrides } : {}),
      ...(policyConstraints ? { policyConstraints: policyConstraints as BackupPayload['policyConstraints'] } : {}),
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

    // Claims are merged by kind+label so a second import never duplicates the ledger.
    const claimIdMap = new Map<string, string>();
    let claimsImported = 0;
    if (this.evidence) {
      const existingClaims = await this.evidence.listClaims();
      const byKey = new Map(existingClaims.claims.map((claim) => [claimDedupeKey(claim), claim]));
      for (const claim of parsed.claims) {
        const key = claimDedupeKey(claim);
        const existing = byKey.get(key);
        if (existing) {
          claimIdMap.set(claim.id, existing.id);
          continue;
        }
        const saved = await this.evidence.saveClaim(claim);
        if (saved) {
          byKey.set(key, saved);
          claimIdMap.set(claim.id, saved.id);
          claimsImported += 1;
        }
      }
    }

    const remapClaimIds = (ids: string[] | undefined) =>
      (ids || []).map((id) => claimIdMap.get(id) || id).filter((id, index, all) => all.indexOf(id) === index);

    const remappedFollowUps: FollowUp[] = [];
    for (const followUp of parsed.followUps) {
      const jobId = idMap.get(followUp.jobId) || followUp.jobId;
      if (await this.jobs.getJob(jobId)) {
        const remapped = { ...followUp, jobId };
        if (this.followUps) await this.followUps.save(remapped);
        remappedFollowUps.push(remapped);
      }
    }

    let dossiersImported = 0;
    for (const dossier of parsed.dossiers) {
      const jobId = idMap.get(dossier.jobId) || dossier.jobId;
      if (!(await this.jobs.getJob(jobId))) continue;
      if (this.evidence) {
        const saved = await this.evidence.saveDossier({
          ...dossier,
          jobId,
          answers: dossier.answers.map((answer) => ({ ...answer, claimIds: remapClaimIds(answer.claimIds) })),
          artifacts: dossier.artifacts.map((artifact) => ({ ...artifact, claimIds: remapClaimIds(artifact.claimIds) })),
          packet: { ...dossier.packet, claimIds: remapClaimIds(dossier.packet.claimIds) },
        });
        if (saved) dossiersImported += 1;
      }
    }

    let decisionsImported = 0;
    for (const decision of parsed.decisions) {
      const jobId = idMap.get(decision.jobId) || decision.jobId;
      if (!(await this.jobs.getJob(jobId))) continue;
      if (this.evidence) {
        const saved = await this.evidence.saveDecision({ ...decision, id: jobId, jobId });
        if (saved) decisionsImported += 1;
      }
    }

    let policyOverridesImported = 0;
    for (const override of parsed.policyOverrides) {
      const jobId = idMap.get(override.jobId) || override.jobId;
      if (!(await this.jobs.getJob(jobId))) continue;
      if (this.evidence) {
        const saved = await this.evidence.savePolicyOverride({ ...override, jobId });
        if (saved) policyOverridesImported += 1;
      }
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
    if (parsed.policyConstraints && this.settings.savePolicyConstraints) {
      await this.settings.savePolicyConstraints(parsed.policyConstraints, { notify: false });
      metadataImported = true;
    }
    this.events.jobsChanged('backup-imported');
    if (metadataImported) this.events.metadataChanged();
    if (claimsImported || dossiersImported || decisionsImported || policyOverridesImported) {
      this.events.evidenceChanged?.();
    }
    return {
      imported,
      replaced,
      skipped,
      eventsImported: remappedEvents.length,
      followUpsImported: remappedFollowUps.length,
      claimsImported,
      dossiersImported,
      decisionsImported,
      policyOverridesImported,
      metadataImported,
      issues,
    };
  }
}
