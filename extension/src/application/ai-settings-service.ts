import type { AiConfig } from '@/src/types/job';
import {
  migrateAiConfig,
  normalizeAiConfigForSave,
  type AiModelResult,
} from '@/src/domain/ai';

export interface AiConfigRepository {
  read(): Promise<unknown>;
  write(config: AiConfig): Promise<void>;
  clear(): Promise<void>;
}

export interface AiModelCatalog {
  fetchModels(baseUrl: string, apiKey: string, timeoutMs?: number): Promise<AiModelResult>;
}

export interface AiSettingsEvents {
  onConfigChanged?(): void;
}

export class AiSettingsService {
  constructor(
    private readonly repository: AiConfigRepository,
    private readonly models: AiModelCatalog,
    private readonly events: AiSettingsEvents = {},
  ) {}

  getConfig(): Promise<AiConfig> {
    return this.repository.read().then(migrateAiConfig);
  }

  async saveConfig(config: AiConfig): Promise<AiConfig> {
    const normalized = normalizeAiConfigForSave(config);
    await this.repository.write(normalized);
    this.events.onConfigChanged?.();
    return normalized;
  }

  async clearConfig(): Promise<void> {
    await this.repository.clear();
    this.events.onConfigChanged?.();
  }

  fetchModels(baseUrl: string, apiKey: string, timeoutMs?: number): Promise<AiModelResult> {
    return this.models.fetchModels(baseUrl, apiKey, timeoutMs);
  }
}
