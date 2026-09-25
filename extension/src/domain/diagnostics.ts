import type { AiProviderId, JobSource } from '@/src/types/job';

export interface RepositoryStats {
  version: number;
  jobCount: number;
  eventCount: number;
  discoveryCount: number;
  followUpCount: number;
}

export interface StorageUsage {
  usage: number;
  quota: number;
}

export interface ManifestSummary {
  version: string;
  permissions: string[];
  hostPermissions: string[];
}

export interface PlatformSummary {
  source: JobSource;
  label: string;
  domains: string[];
}

export interface ExtensionDiagnostics {
  generatedAt: string;
  database: RepositoryStats;
  storage: StorageUsage;
  manifest: ManifestSummary;
  ai: {
    enabled: boolean;
    provider: AiProviderId;
    endpointHost?: string;
  };
  platforms: PlatformSummary[];
}
