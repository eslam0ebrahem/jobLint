import type {
  ExtensionDiagnostics,
  ManifestSummary,
  PlatformSummary,
  RepositoryStats,
  StorageUsage,
} from '@/src/domain/diagnostics';
import type { AiConfig } from '@/src/types/job';

export interface DiagnosticsRepository {
  getRepositoryStats(): Promise<RepositoryStats>;
}

export interface DiagnosticsRuntime {
  getStorageUsage(): Promise<StorageUsage>;
  getManifest(): ManifestSummary;
}

export interface DiagnosticsConfigReader {
  getConfig(): Promise<AiConfig>;
}

export class DiagnosticsService {
  constructor(
    private readonly repository: DiagnosticsRepository,
    private readonly runtime: DiagnosticsRuntime,
    private readonly configs: DiagnosticsConfigReader,
    private readonly platforms: PlatformSummary[],
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getSnapshot(): Promise<ExtensionDiagnostics> {
    const [database, storage, config] = await Promise.all([
      this.repository.getRepositoryStats(),
      this.runtime.getStorageUsage(),
      this.configs.getConfig(),
    ]);
    let endpointHost: string | undefined;
    try {
      endpointHost = config.baseUrl ? new URL(config.baseUrl).hostname : undefined;
    } catch {
      endpointHost = undefined;
    }
    return {
      generatedAt: this.now(),
      database,
      storage,
      manifest: this.runtime.getManifest(),
      ai: {
        enabled: config.enabled,
        provider: config.provider,
        endpointHost,
      },
      platforms: this.platforms,
    };
  }
}
