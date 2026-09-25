import type {
  ApplicationDossier,
  DossierAnswer,
  DossierAnswerInput,
  DossierArtifact,
  DossierArtifactInput,
  DossierStatus,
  PostingSnapshot,
} from '@/src/types/dossier';
import type { ApplicationPacket } from '@/src/types/packet';
import type { Job } from '@/src/types/job';
import type { PolicyReport } from '@/src/types/policy';
import { cleanString, isRecord } from './shared';
import { capturedDescription, MAX_POSTING_DESCRIPTION, postingContentHash } from './repost';

const MAX_DESCRIPTION = MAX_POSTING_DESCRIPTION;

/** FNV-1a, so a posting snapshot is comparable without any crypto dependency. */
export function contentHash(parts: (string | undefined)[]): string {
  const text = parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('\n');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createPostingSnapshot(job: Job, capturedAt: string): PostingSnapshot {
  const description = capturedDescription(job);
  return {
    version: 1,
    capturedAt,
    title: job.title,
    company: job.company,
    location: cleanString(job.location, 1_000),
    jobUrl: job.jobUrl,
    applyUrl: job.applyUrl,
    description,
    requirements: cleanString(job.requirements, MAX_DESCRIPTION),
    salary: cleanString(job.salary, 1_000),
    facts: job.facts,
    contentHash: postingContentHash(job),
    detector: {
      source: job.source,
      strategy: job.detection?.strategy || 'unknown',
      state: job.detection?.state || 'unrecognized',
      version: '1',
    },
  };
}

export interface CreateDossierOptions {
  job: Job;
  packet?: ApplicationPacket;
  policy?: PolicyReport;
  claimIds?: string[];
  eventIds?: string[];
  capturedAt: string;
  createId: (prefix: string) => string;
}

export function createDossier(options: CreateDossierOptions): ApplicationDossier {
  const { job, packet, policy, claimIds, eventIds, capturedAt, createId } = options;
  return {
    version: 1,
    id: createId('dossier'),
    jobId: job.id,
    status: 'draft',
    createdAt: capturedAt,
    updatedAt: capturedAt,
    posting: createPostingSnapshot(job, capturedAt),
    packet: {
      packetVersion: packet?.version ?? 1,
      generatedAt: packet?.generatedAt || capturedAt,
      score: packet?.alignment.score ?? null,
      claimIds: [...(claimIds || [])],
      policyLevel: policy?.level || 'unknown',
    },
    evaluation: job.evaluation
      ? {
          evaluator: job.evaluation.evaluator,
          evaluatorVersion: job.evaluation.version,
          score: job.evaluation.score,
          verdict: job.evaluation.verdict,
          createdAt: job.evaluation.createdAt,
        }
      : null,
    answers: [],
    artifacts: [],
    eventIds: [...(eventIds || [])],
  };
}

export function upsertDossierAnswer(
  dossier: ApplicationDossier,
  input: DossierAnswerInput,
  options: { createId: (prefix: string) => string; timestamp: string },
): ApplicationDossier {
  const question = cleanString(input.question, 500);
  if (!question) throw new Error('An answer needs a question.');
  const existing = dossier.answers.find((answer) => answer.id === input.id || answer.question === question);
  const answer: DossierAnswer = {
    id: existing?.id || input.id || options.createId('answer'),
    question,
    answer: (input.answer || '').slice(0, 20_000),
    claimIds: [...(input.claimIds || existing?.claimIds || [])],
    updatedAt: options.timestamp,
  };
  return {
    ...dossier,
    answers: [...dossier.answers.filter((item) => item.id !== answer.id), answer],
    updatedAt: options.timestamp,
  };
}

export function removeDossierAnswer(
  dossier: ApplicationDossier,
  id: string,
  timestamp: string,
): ApplicationDossier {
  return {
    ...dossier,
    answers: dossier.answers.filter((answer) => answer.id !== id),
    updatedAt: timestamp,
  };
}

export function upsertDossierArtifact(
  dossier: ApplicationDossier,
  input: DossierArtifactInput,
  options: { createId: (prefix: string) => string; timestamp: string },
): ApplicationDossier {
  const label = cleanString(input.label, 200);
  const reference = cleanString(input.reference, 2_000);
  if (!label || !reference) throw new Error('An artifact needs a label and a reference.');
  const existing = dossier.artifacts.find((artifact) => artifact.id === input.id || artifact.label === label);
  const artifact: DossierArtifact = {
    id: existing?.id || input.id || options.createId('artifact'),
    kind: input.kind || existing?.kind || 'resume',
    label,
    reference,
    claimIds: [...(input.claimIds || existing?.claimIds || [])],
    createdAt: existing?.createdAt || options.timestamp,
  };
  return {
    ...dossier,
    artifacts: [...dossier.artifacts.filter((item) => item.id !== artifact.id), artifact],
    updatedAt: options.timestamp,
  };
}

export function removeDossierArtifact(
  dossier: ApplicationDossier,
  id: string,
  timestamp: string,
): ApplicationDossier {
  return {
    ...dossier,
    artifacts: dossier.artifacts.filter((artifact) => artifact.id !== id),
    updatedAt: timestamp,
  };
}

export function setDossierStatus(
  dossier: ApplicationDossier,
  status: DossierStatus,
  timestamp: string,
): ApplicationDossier {
  return {
    ...dossier,
    status,
    updatedAt: timestamp,
    submittedAt: status === 'submitted' ? timestamp : dossier.submittedAt,
  };
}

export function linkDossierEvent(dossier: ApplicationDossier, eventId: string, timestamp: string): ApplicationDossier {
  if (dossier.eventIds.includes(eventId)) return dossier;
  return { ...dossier, eventIds: [...dossier.eventIds, eventId], updatedAt: timestamp };
}

/** What is still missing before the record is worth keeping. */
export function dossierGaps(dossier: ApplicationDossier): string[] {
  const gaps: string[] = [];
  if (!dossier.posting.description) gaps.push('Job description');
  if (!dossier.posting.applyUrl) gaps.push('Apply URL');
  if (!dossier.evaluation) gaps.push('Evaluation');
  if (!dossier.artifacts.length) gaps.push('Attached artifact');
  if (!dossier.packet.claimIds.length) gaps.push('Claim provenance');
  if (dossier.status === 'draft') gaps.push('Submission confirmation');
  return gaps;
}

function normalizeAnswer(value: unknown): DossierAnswer | undefined {
  if (!isRecord(value)) return undefined;
  const question = cleanString(value.question, 500);
  if (!question) return undefined;
  return {
    id: cleanString(value.id, 200) || question,
    question,
    answer: cleanString(value.answer, 20_000) || '',
    claimIds: Array.isArray(value.claimIds) ? value.claimIds.filter((item): item is string => typeof item === 'string').slice(0, 100) : [],
    updatedAt: cleanString(value.updatedAt, 100) || new Date().toISOString(),
  };
}

function normalizeArtifact(value: unknown): DossierArtifact | undefined {
  if (!isRecord(value)) return undefined;
  const label = cleanString(value.label, 200);
  const reference = cleanString(value.reference, 2_000);
  if (!label || !reference) return undefined;
  const kind = ['resume', 'cover_letter', 'portfolio', 'other'].includes(value.kind as string)
    ? (value.kind as DossierArtifact['kind'])
    : 'other';
  return {
    id: cleanString(value.id, 200) || label,
    kind,
    label,
    reference,
    claimIds: Array.isArray(value.claimIds) ? value.claimIds.filter((item): item is string => typeof item === 'string').slice(0, 100) : [],
    createdAt: cleanString(value.createdAt, 100) || new Date().toISOString(),
  };
}

export function normalizeDossier(value: unknown): ApplicationDossier | undefined {
  if (!isRecord(value)) return undefined;
  const jobId = cleanString(value.jobId, 500);
  if (!jobId || !isRecord(value.posting)) return undefined;
  const createdAt = cleanString(value.createdAt, 100) || new Date().toISOString();
  const status = (['draft', 'submitted', 'closed'] as const).includes(value.status as DossierStatus)
    ? (value.status as DossierStatus)
    : 'draft';
  const posting = value.posting as Partial<PostingSnapshot> & Record<string, unknown>;
  return {
    version: 1,
    id: cleanString(value.id, 200) || `dossier-${jobId}`,
    jobId,
    status,
    createdAt,
    updatedAt: cleanString(value.updatedAt, 100) || createdAt,
    submittedAt: cleanString(value.submittedAt, 100),
    posting: {
      version: 1,
      capturedAt: cleanString(posting.capturedAt, 100) || createdAt,
      title: cleanString(posting.title, 500) || 'Untitled job',
      company: cleanString(posting.company, 500) || 'Unknown company',
      location: cleanString(posting.location, 1_000),
      jobUrl: cleanString(posting.jobUrl, 4_000),
      applyUrl: cleanString(posting.applyUrl, 4_000),
      description: cleanString(posting.description, MAX_DESCRIPTION) || '',
      requirements: cleanString(posting.requirements, MAX_DESCRIPTION),
      salary: cleanString(posting.salary, 1_000),
      facts: isRecord(posting.facts) ? (posting.facts as PostingSnapshot['facts']) : undefined,
      contentHash: cleanString(posting.contentHash, 64) || 'unknown',
      detector: isRecord(posting.detector)
        ? {
            source: (posting.detector.source as PostingSnapshot['detector']['source']) || 'other',
            strategy: cleanString(posting.detector.strategy, 100) || 'unknown',
            state: (posting.detector.state as PostingSnapshot['detector']['state']) || 'unrecognized',
            version: cleanString(posting.detector.version, 20) || '1',
          }
        : { source: 'other', strategy: 'unknown', state: 'unrecognized', version: '1' },
    },
    packet: isRecord(value.packet)
      ? {
          packetVersion: Number(value.packet.packetVersion) || 1,
          generatedAt: cleanString(value.packet.generatedAt, 100) || createdAt,
          score: Number.isFinite(Number(value.packet.score)) ? Number(value.packet.score) : null,
          claimIds: Array.isArray(value.packet.claimIds) ? value.packet.claimIds.filter((item): item is string => typeof item === 'string') : [],
          policyLevel: (['pass', 'caution', 'block', 'unknown'] as const).includes(value.packet.policyLevel as never)
            ? (value.packet.policyLevel as ApplicationDossier['packet']['policyLevel'])
            : 'unknown',
        }
      : { packetVersion: 1, generatedAt: createdAt, score: null, claimIds: [], policyLevel: 'unknown' },
    evaluation: isRecord(value.evaluation) && Number.isFinite(Number(value.evaluation.score))
      ? {
          evaluator: (value.evaluation.evaluator as 'heuristic' | 'ai') || 'heuristic',
          evaluatorVersion: Number(value.evaluation.evaluatorVersion) || 2,
          score: Number(value.evaluation.score),
          verdict: (value.evaluation.verdict as 'Apply' | 'Caution' | 'Skip') || 'Caution',
          createdAt: cleanString(value.evaluation.createdAt, 100) || createdAt,
        }
      : null,
    answers: Array.isArray(value.answers) ? value.answers.map(normalizeAnswer).filter((item): item is DossierAnswer => Boolean(item)) : [],
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.map(normalizeArtifact).filter((item): item is DossierArtifact => Boolean(item)) : [],
    eventIds: Array.isArray(value.eventIds) ? value.eventIds.filter((item): item is string => typeof item === 'string').slice(0, 500) : [],
  };
}
