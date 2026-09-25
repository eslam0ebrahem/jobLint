import { discoveryRepository } from '@/src/infrastructure/database/discovery-repository';
import { followUpRepository } from '@/src/infrastructure/database/follow-up-repository';
import { jobRepository } from '@/src/infrastructure/database/job-repository';
import { claimRepository } from '@/src/infrastructure/database/claim-repository';
import { dossierRepository } from '@/src/infrastructure/database/dossier-repository';
import { decisionRepository } from '@/src/infrastructure/database/decision-repository';
import { policyRepository } from '@/src/infrastructure/database/policy-repository';
import { browserSettingsRepository } from '@/src/infrastructure/settings/browser-settings-repository';
import { browserAiConfigRepository } from '@/src/infrastructure/ai/config-repository';
import { AiHttpTransport } from '@/src/infrastructure/ai/transport';
import { getDetectorHealth } from '@/src/infrastructure/detectors/health';
import { browserDiagnosticsAdapter } from '@/src/infrastructure/diagnostics';
import { browserReminderScheduler } from '@/src/infrastructure/reminders';
import { getPlatformForHost, PLATFORM_DEFINITIONS, SUPPORTED_MATCH_PATTERNS } from '@/src/lib/detectors/registry';
import { evaluateJob } from '@/src/lib/evaluation';
import { AiReviewService } from '@/src/application/ai-review';
import { ApplicationPacketService } from '@/src/application/packet-service';
import { OutcomeAnalyticsService } from '@/src/application/analytics-service';
import { AiSettingsService } from '@/src/application/ai-settings-service';
import { BackupService } from '@/src/application/backup-service';
import { ClaimService } from '@/src/application/claim-service';
import { createBackupEvidenceAdapter } from '@/src/application/backup-evidence';
import { DecisionService } from '@/src/application/decision-service';
import { DiagnosticsService } from '@/src/application/diagnostics-service';
import { DiscoveryService } from '@/src/application/discovery-service';
import { DossierService } from '@/src/application/dossier-service';
import { FollowUpService } from '@/src/application/follow-up-service';
import { JobService } from '@/src/application/job-service';
import { PolicyService } from '@/src/application/policy-service';
import { ReminderService } from '@/src/application/reminder-service';
import { SettingsService } from '@/src/application/settings-service';
import type { ClaimKind, ClaimStatus } from '@/src/types/claims';
import type { DossierAnswerInput, DossierArtifactInput, DossierStatus } from '@/src/types/dossier';
import type { DecisionState } from '@/src/types/decisions';
import type { PolicyCode, PolicyLevel } from '@/src/types/policy';
import type { DetectedJob, Job } from '@/src/types/job';
import type {
  GatewayEvent,
  GatewayRequest,
  GatewayResponse,
} from '@/src/lib/messages';
import { isGatewayRequest } from '@/src/lib/messages';

function emit(event: GatewayEvent): void {
  void browser.runtime.sendMessage({ event }).catch(() => undefined);
}

const settings = new SettingsService(browserSettingsRepository, {
  onProfileChanged: () => emit({ type: 'profile-changed' }),
  onPreferencesChanged: () => emit({ type: 'preferences-changed' }),
  onPolicyConstraintsChanged: () => emit({ type: 'policy-changed' }),
});
const reminderService = new ReminderService(
  followUpRepository,
  { getAll: () => jobRepository.getAllJobs() },
  settings,
  browserReminderScheduler,
);

function jobChanged(reason: string, job?: Job): void {
  if (job) {
    emit({ type: 'job-updated', job });
    void reminderService.syncJob(job);
  } else {
    emit({ type: 'jobs-changed', reason });
  }
}

const aiTransport = new AiHttpTransport();
const aiSettings = new AiSettingsService(browserAiConfigRepository, aiTransport, {
  onConfigChanged: () => emit({ type: 'ai-config-changed' }),
});
const aiReviewer = new AiReviewService(
  { getConfig: () => aiSettings.getConfig() },
  aiTransport,
);
const claims = new ClaimService(claimRepository, {
  changed: (reason) => emit({ type: 'claims-changed', reason }),
});
const jobs = new JobService(
  jobRepository,
  settings,
  { getConfig: () => aiSettings.getConfig() },
  evaluateJob,
  aiReviewer,
  { changed: jobChanged },
  claims,
);
const followUps = new FollowUpService(
  followUpRepository,
  jobs,
  reminderService,
  settings,
);
const policy = new PolicyService(
  jobs,
  settings,
  policyRepository,
  jobs,
  { changed: (jobId) => emit({ type: 'policy-changed', jobId }) },
);
const dossiers = new DossierService(
  jobs,
  dossierRepository,
  claims,
  jobs,
  { changed: (jobId) => emit({ type: 'dossiers-changed', jobId }) },
);
const packets = new ApplicationPacketService(jobs, settings, claims);
const analytics = new OutcomeAnalyticsService(jobRepository, undefined, followUpRepository);
const decisions = new DecisionService(
  jobs,
  decisionRepository,
  claims,
  { getAll: policyRepository.getAll, getConstraints: () => settings.getPolicyConstraints() },
  jobs,
  { changed: (jobId) => emit({ type: 'decisions-changed', jobId }) },
);
const backups = new BackupService(jobRepository, settings, {
  jobsChanged: (reason) => jobChanged(reason),
  metadataChanged: () => emit({ type: 'profile-changed' }),
  evidenceChanged: () => emit({ type: 'claims-changed', reason: 'backup-imported' }),
}, undefined, undefined, followUpRepository, createBackupEvidenceAdapter({
  claims: claimRepository,
  dossiers: dossierRepository,
  decisions: decisionRepository,
  policies: policyRepository,
}));
const diagnostics = new DiagnosticsService(
  jobRepository,
  browserDiagnosticsAdapter,
  { getConfig: () => aiSettings.getConfig() },
  PLATFORM_DEFINITIONS.map(({ source, label, hosts }) => ({ source, label, domains: [...hosts] })),
);
const discovery = new DiscoveryService(
  discoveryRepository,
  settings,
  jobs,
  evaluateJob,
  { changed: (reason) => emit({ type: 'discovery-changed', reason }) },
);

async function scanActiveDiscoveryJobs() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url) throw new Error('Open a LinkedIn or Indeed search page before scanning.');
  let platform: ReturnType<typeof getPlatformForHost>;
  try {
    platform = getPlatformForHost(new URL(tab.url).hostname);
  } catch {
    platform = undefined;
  }
  if (platform?.source !== 'linkedin' && platform?.source !== 'indeed') {
    throw new Error('Discovery scanning is limited to LinkedIn and Indeed search pages.');
  }

  let values: unknown;
  try {
    values = await browser.tabs.sendMessage(tab.id, { action: 'scan-discovery-cards' });
  } catch {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
    values = await browser.tabs.sendMessage(tab.id, { action: 'scan-discovery-cards' });
  }
  if (!Array.isArray(values)) throw new Error('The page scanner returned an invalid response.');
  return discovery.ingest(values);
}

async function handle(request: GatewayRequest): Promise<unknown> {
  switch (request.action) {
    case 'list-jobs':
      return jobs.list(request.includeDiscarded);
    case 'get-job':
      return jobs.get(request.id);
    case 'check-job-saved':
      return jobs.checkSaved(request.job);
    case 'clip-job':
      return jobs.clip(request.job);
    case 'save-job':
      return jobs.save(request.job);
    case 'move-job':
      return jobs.move(request.id, request.column);
    case 'update-notes':
      return jobs.updateNotes(request.id, request.notes);
    case 'delete-job':
      await followUps.removeForJob(request.id);
      return jobs.delete(request.id);
    case 'record-outcome':
      return jobs.recordOutcome(request.id, request.outcome);
    case 'evaluate-job':
      return jobs.evaluateJob(request.id, request.job, request.enhanceAi === true);
    case 'get-events':
      return jobs.getEvents(request.jobId);
    case 'get-insights':
      return jobs.getInsights();
    case 'get-detector-health':
      return getDetectorHealth();
    case 'get-extension-diagnostics':
      return diagnostics.getSnapshot();
    case 'scan-discovery-jobs':
      return scanActiveDiscoveryJobs();
    case 'list-discovery':
      return discovery.list();
    case 'save-discovery':
      return discovery.save(request.id);
    case 'dismiss-discovery':
      return discovery.dismiss(request.id);
    case 'revisit-discovery':
      await browser.tabs.create({ url: await discovery.revisit(request.id) });
      return true;
    case 'list-follow-ups':
      return followUps.list(request.jobId);
    case 'create-follow-up': {
      const followUp = await followUps.create(request);
      emit({ type: 'follow-ups-changed', reason: 'follow-up-created' });
      return followUp;
    }
    case 'update-follow-up': {
      const followUp = await followUps.update(request.id, request);
      emit({ type: 'follow-ups-changed', reason: 'follow-up-updated' });
      return followUp;
    }
    case 'complete-follow-up': {
      const followUp = await followUps.complete(request.id);
      emit({ type: 'follow-ups-changed', reason: 'follow-up-completed' });
      return followUp;
    }
    case 'delete-follow-up':
      await followUps.remove(request.id);
      emit({ type: 'follow-ups-changed', reason: 'follow-up-deleted' });
      return true;
    case 'get-application-packet':
      return packets.build(request.id);
    case 'get-outcome-analytics':
      return analytics.getSnapshot();
    case 'get-funnel-analytics':
      return analytics.getFunnelSnapshot();
    case 'list-claims':
      return claims.list({ kind: request.kind as ClaimKind | undefined, status: request.status as ClaimStatus | undefined });
    case 'save-claim':
      return claims.save(request.claim);
    case 'set-claim-status':
      return claims.setStatus(request.id, request.status);
    case 'delete-claim':
      return claims.remove(request.id);
    case 'get-job-requirements':
      return claims.requirements(await jobs.get(request.id).then((job) => {
        if (!job) throw new Error('Job not found.');
        return job;
      }));
    case 'get-policy-report':
      return policy.report(request.id);
    case 'override-policy-gate':
      return policy.override({
        jobId: request.jobId,
        code: request.code as PolicyCode,
        level: request.level as PolicyLevel | undefined,
        note: request.note,
      });
    case 'clear-policy-override':
      return policy.clearOverride(request.id, request.code);
    case 'get-policy-constraints':
      return settings.getPolicyConstraints();
    case 'save-policy-constraints':
      return settings.savePolicyConstraints(request.constraints);
    case 'list-dossiers':
      return dossiers.list(request.jobId);
    case 'open-dossier': {
      const packet = await packets.build(request.id).catch(() => undefined);
      const report = await policy.report(request.id).catch(() => undefined);
      return dossiers.ensure(request.id, packet, report);
    }
    case 'save-dossier-answer':
      return dossiers.saveAnswer(request.id, request.answer as DossierAnswerInput);
    case 'remove-dossier-answer':
      return dossiers.removeAnswer(request.id, request.answerId);
    case 'save-dossier-artifact':
      return dossiers.saveArtifact(request.id, request.artifact as DossierArtifactInput);
    case 'remove-dossier-artifact':
      return dossiers.removeArtifact(request.id, request.artifactId);
    case 'set-dossier-status':
      return dossiers.markStatus(request.id, request.status as DossierStatus);
    case 'delete-dossier':
      return dossiers.remove(request.id);
    case 'get-decision-inbox':
      return decisions.inbox();
    case 'save-decision':
      return decisions.set(request.jobId, {
        state: request.state as DecisionState | undefined,
        rationale: request.rationale,
        nextAction: request.nextAction,
      });
    case 'clear-decision':
      return decisions.clear(request.id);
    case 'compare-jobs':
      return decisions.compare(request.ids);
    case 'get-profile':
      return settings.getProfile();
    case 'save-profile':
      return settings.saveProfile(request.profile);
    case 'clear-profile':
      await settings.clearProfile();
      return true;
    case 'get-preferences':
      return settings.getPreferences();
    case 'save-preferences': {
      const saved = await settings.savePreferences(request.preferences);
      await reminderService?.syncAll();
      return saved;
    }
    case 'get-ai-config':
      return aiSettings.getConfig();
    case 'save-ai-config':
      return aiSettings.saveConfig(request.config);
    case 'clear-ai-config':
      await aiSettings.clearConfig();
      return true;
    case 'fetch-ai-models':
      return aiSettings.fetchModels(request.baseUrl, request.apiKey, request.timeoutMs);
    case 'preview-backup':
      return backups.preview(request.payload);
    case 'import-backup': {
      const result = await backups.import(request.payload, request.conflictStrategy);
      await reminderService.syncAll();
      return result;
    }
    case 'export-backup':
      return backups.export();
    case 'open-dashboard':
      await browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
      return true;
  }
}

async function injectContentScriptIntoOpenTabs(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ url: SUPPORTED_MATCH_PATTERNS });
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      try {
        await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
      } catch {
        // The tab may be restricted, discarded, or already closed.
      }
    }
  } catch {
    // Ignore tab query failures during extension lifecycle events.
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void injectContentScriptIntoOpenTabs());
  browser.runtime.onStartup?.addListener(() => void injectContentScriptIntoOpenTabs());
  browserReminderScheduler.onAlarm((alarm) => {
    void reminderService?.handleAlarm(alarm);
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: GatewayResponse) => void) => {
    const envelope = message as { request?: unknown; action?: string; job?: DetectedJob };
    const request = isGatewayRequest(envelope.request)
      ? envelope.request
      : envelope.action === 'quick-clip-job' && envelope.job
        ? ({ action: 'clip-job', job: envelope.job } satisfies GatewayRequest)
        : undefined;
    if (!request) return false;
    handle(request)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
});
