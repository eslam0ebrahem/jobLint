export type JobSource = 'linkedin' | 'indeed' | 'manual' | 'other';

export type Column =
  | 'to_apply'
  | 'applied'
  | 'assessment'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export type JobStatus = 'active' | 'discarded';

export type ApplicationOutcome =
  | 'interested'
  | 'not_interested'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type RiskLevel = 'low' | 'medium' | 'high';
export type Verdict = 'Apply' | 'Caution' | 'Skip';
export type DetectionState = 'detected' | 'partial' | 'unrecognized';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | 'volunteer' | 'other';
export type WorkMode = 'remote' | 'hybrid' | 'on-site' | 'unknown';
export type DeadlineKind = 'application' | 'posting' | 'event' | 'unknown';
export type FollowUpKind = 'follow-up' | 'application' | 'interview' | 'custom';
export type FollowUpStatus = 'open' | 'completed' | 'dismissed';

export interface JobDeadline {
  kind: DeadlineKind;
  date: string;
  raw: string;
  confidence: number;
  source: 'description' | 'title' | 'url' | 'manual';
}

export interface CompensationFacts {
  raw: string;
  currency?: string;
  min?: number;
  max?: number;
  period?: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface JobFacts {
  version: 1;
  employmentType: EmploymentType;
  workMode: WorkMode;
  seniority?: string;
  skills: string[];
  benefits: string[];
  qualifications: string[];
  compensation?: CompensationFacts;
  deadline?: JobDeadline;
  postedAt?: string;
  extractedAt: string;
  evidence: string[];
}

export interface JobIdentity {
  /** Stable key used to collapse repeated captures of the same posting. */
  key: string;
  source: JobSource;
  sourceJobId?: string;
  canonicalUrl?: string;
  fingerprint: string;
}

export interface DetectionMetadata {
  confidence: number;
  warnings: string[];
  strategy: string;
  state: DetectionState;
  detectedAt: string;
}

export interface DetectorHealth {
  tabId: number;
  url: string;
  source: JobSource;
  label: string;
  state: DetectionState;
  strategy: string;
  confidence: number;
  warnings: string[];
  jobId?: string;
  title?: string;
  company?: string;
}

/**
 * How strongly the local claim ledger backs an evidence signal. Purely
 * descriptive: it never feeds the score.
 */
export type ClaimSupport = 'verified' | 'asserted' | 'unbacked';

export interface EvaluationEvidence {
  id: string;
  category: 'skill' | 'role' | 'location' | 'compensation' | 'risk' | 'profile';
  label: string;
  value?: string;
  detail?: string;
  confidence: number;
  /** Candidate claims that back this signal, when the ledger was consulted. */
  claimIds?: string[];
  support?: ClaimSupport;
}

export interface EvaluationScoreBreakdown {
  fit: number;
  opportunity: number;
  safety: number;
  overall: number;
}

export interface AiAssessment {
  score?: number;
  verdict?: Verdict;
  reason?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  model?: string;
}

export interface JobEvaluation {
  /** Version of the evaluator/report shape. Legacy records are migrated to 2. */
  version: 2;
  evaluator: 'heuristic' | 'ai';
  createdAt: string;
  score: number;
  verdict: Verdict;
  verdictLabel: string;
  archetype: string;
  seniority: string;
  level?: string;
  remote: string;
  legitimacy: 'High Confidence' | 'Proceed with Caution' | 'Suspicious';
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
  redFlags: string[];
  fitScore: number;
  opportunityScore: number;
  safetyScore: number;
  confidence: number;
  riskLevel: RiskLevel;
  missingData: string[];
  evidence: EvaluationEvidence[];
  scoreBreakdown: EvaluationScoreBreakdown;
  aiEnhanced?: boolean;
  aiModel?: string;
  aiAssessment?: AiAssessment;
}

export interface DetectedJob {
  source: JobSource;
  jobId?: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  requirements?: string;
  description?: string;
  applyUrl?: string;
  jobUrl?: string;
  evaluation?: JobEvaluation;
  detection?: DetectionMetadata;
  facts?: JobFacts;
}

export interface FollowUp {
  id: string;
  jobId: string;
  kind: FollowUpKind;
  title: string;
  dueAt: string;
  notes?: string;
  status: FollowUpStatus;
  reminderAt?: string;
  reminderId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ApplicationEvent {
  id: string;
  jobId: string;
  type:
    | 'clipped'
    | 'stage_changed'
    | 'note_added'
    | 'evaluation_completed'
    | 're_evaluated'
    | 'outcome_recorded'
    | 'follow_up_created'
    | 'follow_up_updated'
    | 'follow_up_completed'
    | 'follow_up_deleted'
    | 'dossier_opened'
    | 'dossier_submitted'
    | 'dossier_closed'
    | 'answer_recorded'
    | 'artifact_attached'
    | 'decision_recorded'
    | 'policy_overridden'
    | 'repost_detected'
    | 'imported';
  at: string;
  from?: Column;
  to?: Column;
  outcome?: ApplicationOutcome;
  metadata?: Record<string, string | number | boolean>;
}

export interface OutcomeSnapshot {
  score: number;
  verdict: JobEvaluation['verdict'];
  evaluator: JobEvaluation['evaluator'];
  createdAt: string;
}

export interface Job extends DetectedJob {
  id: string;
  identity?: JobIdentity;
  column: Column;
  status: JobStatus;
  facts?: JobFacts;
  notes?: string;
  outcome?: ApplicationOutcome;
  outcomeSnapshot?: OutcomeSnapshot;
  clippedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type NewJob = Partial<Omit<Job, 'id' | 'clippedAt' | 'createdAt' | 'updatedAt'>> &
  Pick<DetectedJob, 'source' | 'title' | 'company'> & {
    id?: string;
  };

export interface Profile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  roles?: string;
  skills?: string;
  salary?: string;
  visa?: string;
  summary?: string;
}

export interface UserPreferences {
  autoEnhanceWithAi: boolean;
  prioritizeFit: number;
  prioritizeOpportunity: number;
  riskTolerance: 'cautious' | 'balanced' | 'opportunistic';
  remindersEnabled?: boolean;
  reminderLeadDays?: number;
}

export type AiProviderId = 'openrouter' | 'openai' | 'groq' | 'minimax' | 'ollama' | 'custom';

export interface AiConfig {
  provider: AiProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  autoEnhance: boolean;
  timeoutMs: number;
}

export interface JobInsightSummary {
  totalJobs: number;
  activeJobs: number;
  evaluatedJobs: number;
  stageCounts: Record<Column, number>;
  outcomeCounts: Partial<Record<ApplicationOutcome, number>>;
  averageFit: number | null;
  averageOpportunity: number | null;
  averageSafety: number | null;
  topGaps: string[];
  topFlags: string[];
  sourceCounts: Partial<Record<JobSource, number>>;
}

export const COLUMNS: readonly Column[] = [
  'to_apply',
  'applied',
  'assessment',
  'interviewing',
  'offer',
  'rejected',
] as const;

export const APPLICATION_OUTCOMES: readonly ApplicationOutcome[] = [
  'interested',
  'not_interested',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoEnhanceWithAi: false,
  prioritizeFit: 0.6,
  prioritizeOpportunity: 0.25,
  riskTolerance: 'balanced',
  remindersEnabled: false,
  reminderLeadDays: 3,
};

export const DEFAULT_PROFILE: Profile = {
  roles: '',
  skills: '',
  location: '',
};
