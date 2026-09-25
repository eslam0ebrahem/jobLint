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

export interface EvaluationEvidence {
  id: string;
  category: 'skill' | 'role' | 'location' | 'compensation' | 'risk' | 'profile';
  label: string;
  value?: string;
  detail?: string;
  confidence: number;
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
    | 'imported';
  at: string;
  from?: Column;
  to?: Column;
  outcome?: ApplicationOutcome;
  metadata?: Record<string, string | number | boolean>;
}

export interface Job extends DetectedJob {
  id: string;
  identity?: JobIdentity;
  column: Column;
  status: JobStatus;
  notes?: string;
  outcome?: ApplicationOutcome;
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
};

export const DEFAULT_PROFILE: Profile = {
  roles: '',
  skills: '',
  location: '',
};
