import {
  deleteJob,
  findJobByIdentity,
  getActiveJobs,
  getAllJobs,
  getEvents,
  getJob,
  getJobInsights,
  recordOutcome,
  saveEvents,
  saveJob,
  updateJobColumn,
  updateJobEvaluation,
  updateJobNotes,
} from '@/src/lib/db';
import { fetchAiModels, getAiConfig, saveAiConfig, clearAiConfig } from '@/src/lib/ai';
import { evaluateJob, evaluateJobWithAi } from '@/src/lib/evaluation';
import { getPreferences, getProfile, savePreferences, saveProfile, clearProfile } from '@/src/lib/settings';
import { getPlatformForHost, SUPPORTED_MATCH_PATTERNS } from '@/src/lib/detectors/registry';
import { parseBackupPayload } from '@/src/lib/backup';
import type { DetectedJob, DetectorHealth, Job, UserPreferences } from '@/src/types/job';
import type {
  BackupImportResult,
  BackupPayload,
  BackupPreview,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function previewBackup(payload: unknown): Promise<BackupPreview> {
  const parsed = parseBackupPayload(payload);
  let conflictCount = 0;
  for (const item of parsed.jobs) {
    if (await findJobByIdentity(item.input)) conflictCount += 1;
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

async function exportBackup(): Promise<BackupPayload> {
  const [jobs, events, profile, preferences] = await Promise.all([
    getAllJobs(),
    getEvents(),
    getProfile(),
    getPreferences(),
  ]);
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    jobs,
    events,
    profile,
    preferences,
  };
}

async function importBackup(payload: unknown, conflictStrategy: 'skip' | 'overwrite' = 'skip'): Promise<BackupImportResult> {
  const parsed = parseBackupPayload(payload);
  const issues = [...parsed.issues];
  const idMap = new Map<string, string>();
  let imported = 0;
  let replaced = 0;
  let skipped = 0;

  for (const item of parsed.jobs) {
    const existing = await findJobByIdentity(item.input);
    if (existing && conflictStrategy === 'skip') {
      skipped += 1;
      issues.push({ index: parsed.jobs.indexOf(item), reason: `Skipped duplicate of ${existing.title} at ${existing.company}.` });
      if (item.sourceId) idMap.set(item.sourceId, existing.id);
      continue;
    }
    const result = await saveJob(item.input, {
      creationEventType: 'imported',
      eventType: existing ? 'imported' : undefined,
      overwriteWorkflow: Boolean(existing),
    });
    if (item.sourceId) idMap.set(item.sourceId, result.id);
    if (result.isNew) imported += 1;
    else replaced += 1;
  }

  let eventsImported = 0;
  const eventChecks = await Promise.all(parsed.events.map(async (event) => {
    const jobId = idMap.get(event.jobId) || event.jobId;
    return getJob(jobId).then((job) => job ? [{ ...event, jobId }] : []);
  }));
  const restorableEvents = eventChecks.flat();
  if (restorableEvents.length) {
    await saveEvents(restorableEvents);
    eventsImported = restorableEvents.length;
  }

  let metadataImported = false;
  if (parsed.profile) {
    await saveProfile(parsed.profile);
    metadataImported = true;
  }
  if (parsed.preferences) {
    await savePreferences(parsed.preferences);
    metadataImported = true;
  }
  jobChanged('backup-imported');
  if (metadataImported) emit({ type: 'profile-changed' });
  return { imported, replaced, skipped, eventsImported, metadataImported, issues };
}

async function shouldAutoEnhance(preferences: UserPreferences): Promise<boolean> {
  if (!preferences.autoEnhanceWithAi) return false;
  const config = await getAiConfig();
  return config.enabled && config.autoEnhance;
}

async function getDetectorHealth(): Promise<DetectorHealth[]> {
  const tabs = await browser.tabs.query({ url: SUPPORTED_MATCH_PATTERNS });
  return Promise.all(tabs.flatMap((tab) => {
    if (tab.id === undefined || !tab.url) return [];
    let hostname = '';
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      return [];
    }
    const platform = getPlatformForHost(hostname);
    const fallback: DetectorHealth = {
      tabId: tab.id,
      url: tab.url,
      source: platform?.source || 'other',
      label: platform?.label || 'Supported page',
      state: 'unrecognized',
      strategy: 'content-script-unavailable',
      confidence: 0,
      warnings: ['The detector did not respond on this tab. Reload the page and try again.'],
    };
    return [browser.tabs.sendMessage(tab.id, { action: 'detector-health' })
      .then((value) => isDetectorHealth(value) ? value : fallback)
      .catch(() => fallback)];
  }));
}

function isDetectorHealth(value: unknown): value is DetectorHealth {
  return isRecord(value)
    && typeof value.tabId === 'number'
    && typeof value.url === 'string'
    && typeof value.state === 'string'
    && typeof value.strategy === 'string'
    && typeof value.confidence === 'number'
    && Array.isArray(value.warnings);
}

async function handle(request: GatewayRequest): Promise<unknown> {
  switch (request.action) {
    case 'list-jobs':
      return request.includeDiscarded ? getAllJobs() : getActiveJobs();
    case 'get-job':
      return getJob(request.id);
    case 'check-job-saved': {
      const existing = await findJobByIdentity(request.job);
      return { isSaved: Boolean(existing), job: existing };
    }
    case 'clip-job': {
      const [profile, preferences] = await Promise.all([getProfile(), getPreferences()]);
      let evaluation = evaluateJob(request.job, profile, preferences);
      if (await shouldAutoEnhance(preferences)) evaluation = await evaluateJobWithAi(request.job, profile, preferences);
      const result = await saveJob({ ...request.job, evaluation, column: 'to_apply', status: 'active' });
      jobChanged('job-clipped', result.job);
      return { job: result.job, isNew: result.isNew, aiEnhanced: evaluation.aiEnhanced === true };
    }
    case 'save-job': {
      const result = await saveJob(request.job);
      jobChanged('job-saved', result.job);
      return result.job;
    }
    case 'move-job': {
      const job = await updateJobColumn(request.id, request.column);
      if (job) jobChanged('job-moved', job);
      return job;
    }
    case 'update-notes': {
      const job = await updateJobNotes(request.id, request.notes);
      if (job) jobChanged('job-notes-updated', job);
      return job;
    }
    case 'delete-job':
      await deleteJob(request.id);
      jobChanged('job-deleted');
      return true;
    case 'record-outcome': {
      const job = await recordOutcome(request.id, request.outcome);
      if (job) jobChanged('job-outcome-updated', job);
      return job;
    }
    case 'evaluate-job': {
      const job = request.id ? await getJob(request.id) : request.job;
      if (!job) throw new Error('Job not found.');
      const [profile, preferences] = await Promise.all([getProfile(), getPreferences()]);
      let evaluation = evaluateJob(job, profile, preferences);
      if (request.enhanceAi) evaluation = await evaluateJobWithAi(job, profile, preferences);
      const updated = request.id
        ? await updateJobEvaluation(request.id, evaluation, job.evaluation ? 're_evaluated' : 'evaluation_completed')
        : (await saveJob({ ...job, evaluation }, { eventType: 'evaluation_completed' })).job;
      if (!updated) throw new Error('Job not found.');
      jobChanged('job-evaluated', updated);
      return updated;
    }
    case 'get-events':
      return getEvents(request.jobId);
    case 'get-insights':
      return getJobInsights();
    case 'get-detector-health':
      return getDetectorHealth();
    case 'get-profile':
      return getProfile();
    case 'save-profile': {
      const profile = await saveProfile(request.profile);
      emit({ type: 'profile-changed' });
      return profile;
    }
    case 'clear-profile':
      await clearProfile();
      emit({ type: 'profile-changed' });
      return true;
    case 'get-preferences':
      return getPreferences();
    case 'save-preferences': {
      const preferences = await savePreferences(request.preferences);
      emit({ type: 'preferences-changed' });
      return preferences;
    }
    case 'get-ai-config':
      return getAiConfig();
    case 'save-ai-config': {
      const config = await saveAiConfig(request.config);
      emit({ type: 'ai-config-changed' });
      return config;
    }
    case 'clear-ai-config':
      await clearAiConfig();
      emit({ type: 'ai-config-changed' });
      return true;
    case 'fetch-ai-models':
      return fetchAiModels(request.baseUrl, request.apiKey, request.timeoutMs);
    case 'preview-backup':
      return previewBackup(request.payload);
    case 'import-backup':
      return importBackup(request.payload, request.conflictStrategy);
    case 'export-backup':
      return exportBackup();
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
