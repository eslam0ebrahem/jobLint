import { jobRepository } from '@/src/infrastructure/database/job-repository';
import { browserSettingsRepository } from '@/src/infrastructure/settings/browser-settings-repository';
import { browserAiConfigRepository } from '@/src/infrastructure/ai/config-repository';
import { AiHttpTransport } from '@/src/infrastructure/ai/transport';
import { getDetectorHealth } from '@/src/infrastructure/detectors/health';
import { SUPPORTED_MATCH_PATTERNS } from '@/src/lib/detectors/registry';
import { evaluateJob } from '@/src/lib/evaluation';
import { AiReviewService } from '@/src/application/ai-review';
import { AiSettingsService } from '@/src/application/ai-settings-service';
import { BackupService } from '@/src/application/backup-service';
import { JobService } from '@/src/application/job-service';
import { SettingsService } from '@/src/application/settings-service';
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

function jobChanged(reason: string, job?: Job): void {
  if (job) {
    emit({ type: 'job-updated', job });
    emit({ type: 'jobs-changed', reason, jobId: job.id });
  } else {
    emit({ type: 'jobs-changed', reason });
  }
}

const settings = new SettingsService(browserSettingsRepository, {
  onProfileChanged: () => emit({ type: 'profile-changed' }),
  onPreferencesChanged: () => emit({ type: 'preferences-changed' }),
});
const aiTransport = new AiHttpTransport();
const aiSettings = new AiSettingsService(browserAiConfigRepository, aiTransport, {
  onConfigChanged: () => emit({ type: 'ai-config-changed' }),
});
const aiReviewer = new AiReviewService(
  { getConfig: () => aiSettings.getConfig() },
  aiTransport,
);
const jobs = new JobService(
  jobRepository,
  settings,
  { getConfig: () => aiSettings.getConfig() },
  evaluateJob,
  aiReviewer,
  { changed: jobChanged },
);
const backups = new BackupService(jobRepository, settings, {
  jobsChanged: (reason) => jobChanged(reason),
  metadataChanged: () => emit({ type: 'profile-changed' }),
});

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
    case 'get-profile':
      return settings.getProfile();
    case 'save-profile':
      return settings.saveProfile(request.profile);
    case 'clear-profile':
      await settings.clearProfile();
      return true;
    case 'get-preferences':
      return settings.getPreferences();
    case 'save-preferences':
      return settings.savePreferences(request.preferences);
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
    case 'import-backup':
      return backups.import(request.payload, request.conflictStrategy);
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
