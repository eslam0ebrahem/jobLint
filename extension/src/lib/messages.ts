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
import type { ExtensionDiagnostics } from '@/src/domain/diagnostics';
import type { DiscoveryInboxSnapshot, DiscoveryRecord, DiscoverySaveResult } from '@/src/types/discovery';
import type { FollowUp, FollowUpKind, FollowUpStatus } from '@/src/types/job';
import type { ApplicationPacket } from '@/src/types/packet';
import type { FunnelAnalytics, OutcomeAnalytics } from '@/src/types/analytics';
import type { CandidateClaim, CandidateClaimInput, ClaimLedgerSnapshot, ClaimStatus, RequirementEvidence } from '@/src/types/claims';
import type { DecisionInbox, DecisionState, JobComparison, JobDecision } from '@/src/types/decisions';
import type { ApplicationDossier, DossierAnswerInput, DossierArtifactInput, DossierStatus } from '@/src/types/dossier';
import type { PolicyCode, PolicyConstraints, PolicyReport } from '@/src/types/policy';
import type {
  BackupConflictStrategy,
  BackupImportResult,
  BackupPayload,
  BackupPreview,
} from '@/src/domain/backup';

export type {
  BackupConflictStrategy,
  BackupImportResult,
  BackupIssue,
  BackupPayload,
  BackupPreview,
} from '@/src/domain/backup';

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
  | { action: 'get-extension-diagnostics' }
  | { action: 'scan-discovery-jobs' }
  | { action: 'list-discovery' }
  | { action: 'save-discovery'; id: string }
  | { action: 'dismiss-discovery'; id: string }
  | { action: 'revisit-discovery'; id: string }
  | { action: 'list-follow-ups'; jobId?: string }
  | { action: 'create-follow-up'; jobId: string; title: string; dueAt: string; kind?: FollowUpKind; notes?: string; reminderAt?: string }
  | { action: 'update-follow-up'; id: string; title?: string; dueAt?: string; kind?: FollowUpKind; notes?: string; status?: FollowUpStatus; reminderAt?: string }
  | { action: 'complete-follow-up'; id: string }
  | { action: 'delete-follow-up'; id: string }
  | { action: 'get-application-packet'; id: string }
  | { action: 'get-outcome-analytics' }
  | { action: 'get-funnel-analytics' }
  | { action: 'list-claims'; kind?: string; status?: string }
  | { action: 'save-claim'; claim: CandidateClaimInput }
  | { action: 'set-claim-status'; id: string; status: ClaimStatus }
  | { action: 'delete-claim'; id: string }
  | { action: 'get-job-requirements'; id: string }
  | { action: 'get-policy-report'; id: string }
  | { action: 'override-policy-gate'; jobId: string; code: PolicyCode; level?: string; note?: string }
  | { action: 'clear-policy-override'; id: string; code: PolicyCode }
  | { action: 'get-policy-constraints' }
  | { action: 'save-policy-constraints'; constraints: PolicyConstraints }
  | { action: 'list-dossiers'; jobId?: string }
  | { action: 'open-dossier'; id: string }
  | { action: 'save-dossier-answer'; id: string; answer: DossierAnswerInput }
  | { action: 'remove-dossier-answer'; id: string; answerId: string }
  | { action: 'save-dossier-artifact'; id: string; artifact: DossierArtifactInput }
  | { action: 'remove-dossier-artifact'; id: string; artifactId: string }
  | { action: 'set-dossier-status'; id: string; status: DossierStatus }
  | { action: 'delete-dossier'; id: string }
  | { action: 'get-decision-inbox' }
  | { action: 'save-decision'; jobId: string; state?: DecisionState; rationale?: string; nextAction?: string }
  | { action: 'clear-decision'; id: string }
  | { action: 'compare-jobs'; ids: string[] }
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
  | { type: 'ai-config-changed' }
  | { type: 'discovery-changed'; reason: string }
  | { type: 'follow-ups-changed'; reason: string }
  | { type: 'claims-changed'; reason: string }
  | { type: 'policy-changed'; jobId?: string }
  | { type: 'dossiers-changed'; jobId: string }
  | { type: 'decisions-changed'; jobId: string };

export type GatewayResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AiModelResult = { success: boolean; models: string[]; error?: string };
export type ClipJobResult = { job: Job; isNew: boolean; aiEnhanced: boolean };
export type SavedStatusResult = { isSaved: boolean; job?: Job };
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
  'get-extension-diagnostics': ExtensionDiagnostics;
  'scan-discovery-jobs': DiscoveryInboxSnapshot;
  'list-discovery': DiscoveryInboxSnapshot;
  'save-discovery': DiscoverySaveResult;
  'dismiss-discovery': DiscoveryRecord;
  'revisit-discovery': true;
  'list-follow-ups': FollowUp[];
  'create-follow-up': FollowUp;
  'update-follow-up': FollowUp;
  'complete-follow-up': FollowUp;
  'delete-follow-up': true;
  'get-application-packet': ApplicationPacket;
  'get-outcome-analytics': OutcomeAnalytics;
  'get-funnel-analytics': FunnelAnalytics;
  'list-claims': ClaimLedgerSnapshot;
  'save-claim': CandidateClaim;
  'set-claim-status': CandidateClaim;
  'delete-claim': true;
  'get-job-requirements': RequirementEvidence[];
  'get-policy-report': PolicyReport;
  'override-policy-gate': PolicyReport;
  'clear-policy-override': PolicyReport;
  'get-policy-constraints': PolicyConstraints;
  'save-policy-constraints': PolicyConstraints;
  'list-dossiers': ApplicationDossier[];
  'open-dossier': ApplicationDossier;
  'save-dossier-answer': ApplicationDossier;
  'remove-dossier-answer': ApplicationDossier;
  'save-dossier-artifact': ApplicationDossier;
  'remove-dossier-artifact': ApplicationDossier;
  'set-dossier-status': ApplicationDossier;
  'delete-dossier': true;
  'get-decision-inbox': DecisionInbox;
  'save-decision': JobDecision;
  'clear-decision': true;
  'compare-jobs': JobComparison;
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
    case 'get-extension-diagnostics':
    case 'scan-discovery-jobs':
    case 'list-discovery':
    case 'get-outcome-analytics':
    case 'get-funnel-analytics':
    case 'get-profile':
    case 'clear-profile':
    case 'get-preferences':
    case 'get-ai-config':
    case 'clear-ai-config':
    case 'export-backup':
    case 'open-dashboard':
    case 'list-claims':
    case 'get-policy-constraints':
    case 'get-decision-inbox':
      return true;
    case 'get-job':
    case 'move-job':
    case 'update-notes':
    case 'delete-job':
    case 'complete-follow-up':
    case 'delete-follow-up':
    case 'get-application-packet':
    case 'get-outcome-analytics':
    case 'save-discovery':
    case 'dismiss-discovery':
    case 'revisit-discovery':
    case 'delete-claim':
    case 'get-job-requirements':
    case 'get-policy-report':
    case 'open-dossier':
    case 'remove-dossier-answer':
    case 'remove-dossier-artifact':
    case 'set-dossier-status':
    case 'delete-dossier':
    case 'clear-decision':
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
    case 'list-follow-ups':
      return value.jobId === undefined || typeof value.jobId === 'string';
    case 'create-follow-up':
      return typeof value.jobId === 'string' && typeof value.title === 'string' && typeof value.dueAt === 'string';
    case 'update-follow-up':
      return hasId;
    case 'save-claim':
      return isRecord(value.claim) && typeof value.claim.label === 'string' && value.claim.label.length > 0;
    case 'set-claim-status':
      return hasId && typeof value.status === 'string';
    case 'save-policy-constraints':
      return isRecord(value.constraints);
    case 'save-dossier-answer':
      return hasId && isRecord(value.answer) && typeof value.answer.question === 'string';
    case 'save-dossier-artifact':
      return hasId && isRecord(value.artifact);
    case 'compare-jobs':
      return Array.isArray(value.ids) && value.ids.length >= 2 && value.ids.every((id) => typeof id === 'string' && id.length > 0);
    case 'save-decision':
      return typeof value.jobId === 'string' && value.jobId.length > 0;
    case 'override-policy-gate':
      return typeof value.jobId === 'string' && value.jobId.length > 0 && typeof value.code === 'string';
    case 'clear-policy-override':
      return hasId && typeof value.code === 'string';
    case 'list-dossiers':
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
