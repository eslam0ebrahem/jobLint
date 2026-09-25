import type {
  AiConfig,
  AiProviderId,
  ApplicationEvent,
  ApplicationOutcome,
  Column,
  DetectedJob,
  DetectorHealth,
  Job,
  JobEvaluation,
  JobInsightSummary,
  Profile,
  UserPreferences,
} from '@/src/types/job';

export type GatewayRequest =
  | { action: 'list-jobs'; includeDiscarded?: boolean }
  | { action: 'get-job'; id: string }
  | { action: 'clip-job'; job: DetectedJob }
  | { action: 'save-job'; job: DetectedJob & { evaluation?: JobEvaluation } }
  | { action: 'check-job-saved'; job: DetectedJob }
  | { action: 'move-job'; id: string; column: Column }
  | { action: 'update-notes'; id: string; notes: string }
  | { action: 'delete-job'; id: string }
  | { action: 'record-outcome'; id: string; outcome: ApplicationOutcome }
  | { action: 'evaluate-job'; id?: string; job?: DetectedJob; enhanceAi?: boolean }
  | { action: 'get-events'; jobId?: string }
  | { action: 'get-insights' }
  | { action: 'get-detector-health' }
  | { action: 'get-profile' }
  | { action: 'save-profile'; profile: Profile }
  | { action: 'clear-profile' }
  | { action: 'get-preferences' }
  | { action: 'save-preferences'; preferences: UserPreferences }
  | { action: 'get-ai-config' }
  | { action: 'save-ai-config'; config: AiConfig }
  | { action: 'clear-ai-config' }
  | { action: 'fetch-ai-models'; baseUrl: string; apiKey: string; timeoutMs?: number }
  | { action: 'preview-backup'; payload: unknown }
  | { action: 'import-backup'; payload: unknown; conflictStrategy?: BackupConflictStrategy }
  | { action: 'export-backup' }
  | { action: 'open-dashboard' };

export type GatewayEvent =
  | { type: 'jobs-changed'; reason: string; jobId?: string }
  | { type: 'job-updated'; job: Job }
  | { type: 'profile-changed' }
  | { type: 'preferences-changed' }
  | { type: 'ai-config-changed' };

export type GatewayResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AiModelResult = { success: boolean; models: string[]; error?: string };
export type ClipJobResult = { job: Job; isNew: boolean; aiEnhanced: boolean };
export type SavedStatusResult = { isSaved: boolean; job?: Job };
export type BackupPayload = {
  schemaVersion: 2;
  exportedAt: string;
  jobs: Job[];
  events: ApplicationEvent[];
  profile: Profile;
  preferences: UserPreferences;
};
export type BackupConflictStrategy = 'skip' | 'overwrite';
export type BackupIssue = { index: number; reason: string };
export type BackupPreview = {
  valid: boolean;
  schemaVersion: 1 | 2;
  jobCount: number;
  eventCount: number;
  conflictCount: number;
  hasProfile: boolean;
  hasPreferences: boolean;
  issues: BackupIssue[];
};
export type BackupImportResult = {
  imported: number;
  replaced: number;
  skipped: number;
  eventsImported: number;
  metadataImported: boolean;
  issues: BackupIssue[];
};

export type GatewayData = {
  'list-jobs': Job[];
  'get-job': Job | undefined;
  'clip-job': ClipJobResult;
  'save-job': Job;
  'check-job-saved': SavedStatusResult;
  'move-job': Job | undefined;
  'update-notes': Job | undefined;
  'delete-job': true;
  'record-outcome': Job | undefined;
  'evaluate-job': Job;
  'get-events': ApplicationEvent[];
  'get-insights': JobInsightSummary;
  'get-detector-health': DetectorHealth[];
  'get-profile': Profile;
  'save-profile': Profile;
  'clear-profile': true;
  'get-preferences': UserPreferences;
  'save-preferences': UserPreferences;
  'get-ai-config': AiConfig;
  'save-ai-config': AiConfig;
  'clear-ai-config': true;
  'fetch-ai-models': AiModelResult;
  'preview-backup': BackupPreview;
  'import-backup': BackupImportResult;
  'export-backup': BackupPayload;
  'open-dashboard': true;
};

export type GatewayAction = GatewayRequest['action'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJob(value: unknown): boolean {
  return isRecord(value) && typeof value.source === 'string' && typeof value.title === 'string' && typeof value.company === 'string';
}

/** Runtime guard for messages crossing the extension boundary. */
export function isGatewayRequest(value: unknown): value is GatewayRequest {
  if (!isRecord(value) || typeof value.action !== 'string') return false;
  const hasId = typeof value.id === 'string' && value.id.length > 0;
  switch (value.action) {
    case 'list-jobs':
    case 'get-insights':
    case 'get-detector-health':
    case 'get-profile':
    case 'clear-profile':
    case 'get-preferences':
    case 'get-ai-config':
    case 'clear-ai-config':
    case 'export-backup':
    case 'open-dashboard':
      return true;
    case 'get-job':
    case 'move-job':
    case 'update-notes':
    case 'delete-job':
      return hasId;
    case 'clip-job':
    case 'save-job':
    case 'check-job-saved':
      return isJob(value.job);
    case 'record-outcome':
      return hasId && typeof value.outcome === 'string';
    case 'evaluate-job':
      return hasId || isJob(value.job);
    case 'get-events':
      return value.jobId === undefined || typeof value.jobId === 'string';
    case 'save-profile':
      return isRecord(value.profile);
    case 'save-preferences':
      return isRecord(value.preferences);
    case 'save-ai-config':
      return isRecord(value.config) && typeof value.config.provider === 'string';
    case 'fetch-ai-models':
      return typeof value.baseUrl === 'string' && typeof value.apiKey === 'string';
    case 'preview-backup':
    case 'import-backup':
      return Object.prototype.hasOwnProperty.call(value, 'payload');
    default:
      return false;
  }
}

export type { AiProviderId };
