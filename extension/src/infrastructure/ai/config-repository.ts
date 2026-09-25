import type { AiConfig } from '@/src/types/job';
import { migrateAiConfig, normalizeAiConfigForSave } from '@/src/domain/ai';

export const browserAiConfigRepository = {
  async read(): Promise<unknown> {
    return browser.storage.local.get(['aiConfig', 'baseUrl', 'apiKey', 'model']);
  },
  async write(config: AiConfig): Promise<void> {
    await browser.storage.local.set({ aiConfig: config });
  },
  async clear(): Promise<void> {
    await browser.storage.local.remove(['aiConfig', 'baseUrl', 'apiKey', 'model', 'models']);
  },
};

export async function getAiConfig(): Promise<AiConfig> {
  return migrateAiConfig(await browserAiConfigRepository.read());
}

export async function saveAiConfig(config: AiConfig): Promise<AiConfig> {
  const normalized = normalizeAiConfigForSave(config);
  await browserAiConfigRepository.write(normalized);
  return normalized;
}

export async function clearAiConfig(): Promise<void> {
  await browserAiConfigRepository.clear();
}
