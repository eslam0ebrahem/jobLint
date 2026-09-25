import type { Job, JobDeadline, JobEvaluation, Profile } from '@/src/types/job';

export interface PacketJobSnapshot {
  id: string;
  title: string;
  company: string;
  location?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionExcerpt?: string;
  deadline?: JobDeadline;
  facts?: Job['facts'];
}

export interface PacketProfileSnapshot {
  roles?: string;
  skills?: string;
  location?: string;
  summary?: string;
}

export interface PacketEvidence {
  id: string;
  source: 'job' | 'profile' | 'evaluation';
  label: string;
  value?: string;
  detail?: string;
  confidence: number;
}

export interface ApplicationPacket {
  version: 1;
  localOnly: true;
  generatedAt: string;
  job: PacketJobSnapshot;
  profile: PacketProfileSnapshot;
  alignment: {
    score: number | null;
    verdict: JobEvaluation['verdict'] | null;
    confidence: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    missingData: string[];
  };
  talkingPoints: string[];
  questions: string[];
  checklist: string[];
  evidence: PacketEvidence[];
  disclosure: string;
}

export type ApplicationPacketProfile = Profile;
