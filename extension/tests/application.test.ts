import { describe, expect, it, vi } from 'vitest';
import { AiSettingsService } from '@/src/application/ai-settings-service';
import { BackupService } from '@/src/application/backup-service';
import { JobService } from '@/src/application/job-service';
import { SettingsService } from '@/src/application/settings-service';
import type { AiReviewer } from '@/src/application/ai-review';
import { DEFAULT_AI_CONFIG, isAutomaticAiEnhancementEnabled } from '@/src/domain/ai';
import { DEFAULT_PREFERENCES, type AiConfig } from '@/src/types/job';
import { jobRepository } from '@/src/infrastructure/database/job-repository';
import { browserAiConfigRepository } from '@/src/infrastructure/ai/config-repository';
import { browserSettingsRepository } from '@/src/infrastructure/settings/browser-settings-repository';
import { evaluateJob } from '@/src/lib/evaluation';
import type { DetectedJob, JobEvaluation } from '@/src/types/job';

const detectedJob: DetectedJob = {
  source: 'manual',
  title: 'React Engineer',
  company: 'Acme',
  description: 'Build React and TypeScript products with Node.js and AWS.',
};

function createAiReviewer() {
  const review = vi.fn(async (_job: DetectedJob, fallback: JobEvaluation): Promise<JobEvaluation> => ({
    ...fallback,
    evaluator: 'ai',
    aiEnhanced: true,
    aiModel: 'test-model',
    aiAssessment: {
      score: 3.1,
      verdict: 'Skip',
      reason: 'Advisory review',
      model: 'test-model',
    },
    reason: 'Advisory review',
  }));
  const reviewer: AiReviewer = { review };
  return { reviewer, review };
}

function createAiSettings(events: { onConfigChanged?: () => void } = {}) {
  return new AiSettingsService(
    browserAiConfigRepository,
    { fetchModels: vi.fn(async () => ({ success: true, models: [] })) },
    events,
  );
}

describe('application services', () => {
  it('requires preference, enabled config, and config auto-enhancement for automatic AI', () => {
    const enabled: AiConfig = {
      ...DEFAULT_AI_CONFIG,
      provider: 'openai',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test',
      model: 'test-model',
      enabled: true,
      autoEnhance: true,
    };
    const optedIn = { ...DEFAULT_PREFERENCES, autoEnhanceWithAi: true };
    expect(isAutomaticAiEnhancementEnabled(DEFAULT_PREFERENCES, enabled)).toBe(false);
    expect(isAutomaticAiEnhancementEnabled(optedIn, { ...enabled, enabled: false })).toBe(false);
    expect(isAutomaticAiEnhancementEnabled(optedIn, { ...enabled, autoEnhance: false })).toBe(false);
    expect(isAutomaticAiEnhancementEnabled(optedIn, enabled)).toBe(true);
  });

  it('clips with the local default, reviews only when policy allows, and honors manual AI review', async () => {
    const settings = new SettingsService(browserSettingsRepository);
    const aiSettings = createAiSettings();
    const { reviewer, review } = createAiReviewer();
    const service = new JobService(
      jobRepository,
      settings,
      aiSettings,
      evaluateJob,
      reviewer,
      { changed: vi.fn() },
    );
    await settings.saveProfile({ roles: 'React Engineer', skills: 'React, TypeScript, Node.js, AWS' });
    await settings.savePreferences({ ...DEFAULT_PREFERENCES, autoEnhanceWithAi: true });
    await aiSettings.saveConfig({
      ...DEFAULT_AI_CONFIG,
      provider: 'openai',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test',
      model: 'test-model',
      enabled: true,
      autoEnhance: true,
    });

    const clipped = await service.clip(detectedJob);
    const local = evaluateJob(
      detectedJob,
      { roles: 'React Engineer', skills: 'React, TypeScript, Node.js, AWS' },
      { ...DEFAULT_PREFERENCES, autoEnhanceWithAi: true },
    );
    expect(clipped.aiEnhanced).toBe(true);
    expect(clipped.job.evaluation?.score).toBe(local.score);
    expect(review).toHaveBeenCalledTimes(1);

    await settings.savePreferences({ ...DEFAULT_PREFERENCES, autoEnhanceWithAi: false });
    const localOnly = await service.clip({ ...detectedJob, jobId: 'local-only', title: 'Platform Engineer' });
    expect(localOnly.aiEnhanced).toBe(false);
    expect(review).toHaveBeenCalledTimes(1);

    const manuallyReviewed = await service.evaluateJob(clipped.job.id, undefined, true);
    expect(manuallyReviewed.evaluation?.aiEnhanced).toBe(true);
    expect(manuallyReviewed.evaluation?.score).toBe(clipped.job.evaluation?.score);
    expect(review).toHaveBeenCalledTimes(2);
  });

  it('previews conflicts and remaps imported events to the preserved local job ID', async () => {
    const settings = new SettingsService(browserSettingsRepository);
    const jobsChanged = vi.fn();
    const metadataChanged = vi.fn();
    const service = new BackupService(jobRepository, settings, { jobsChanged, metadataChanged });
    const existing = await jobRepository.saveJob({
      source: 'linkedin',
      jobId: 'existing',
      title: 'Original Engineer',
      company: 'Acme',
    });
    const payload = {
      schemaVersion: 2,
      jobs: [
        { id: 'backup-existing', source: 'linkedin', jobId: 'existing', title: 'Updated Engineer', company: 'Acme' },
        { id: 'backup-new', source: 'manual', title: 'Product Designer', company: 'Acme' },
      ],
      events: [
        { id: 'event-existing', jobId: 'backup-existing', type: 'imported', at: '2026-01-01T00:00:00.000Z' },
        { id: 'event-new', jobId: 'backup-new', type: 'imported', at: '2026-01-02T00:00:00.000Z' },
      ],
      profile: { roles: '  Product Designer  ' },
      preferences: { prioritizeFit: 9, riskTolerance: 'cautious' },
    };

    await expect(service.preview(payload)).resolves.toMatchObject({
      conflictCount: 1,
      jobCount: 2,
      eventCount: 2,
    });
    const result = await service.import(payload);
    expect(result).toMatchObject({
      imported: 1,
      replaced: 0,
      skipped: 1,
      eventsImported: 2,
      metadataImported: true,
    });
    expect(result.issues.some((issue) => issue.reason.includes('Skipped duplicate'))).toBe(true);
    expect((await jobRepository.getEvents(existing.id)).some((event) => event.id === 'event-existing' && event.jobId === existing.id)).toBe(true);
    expect((await jobRepository.getEvents('backup-new')).some((event) => event.id === 'event-new' && event.jobId === 'backup-new')).toBe(true);
    await expect(settings.getProfile()).resolves.toEqual({ roles: 'Product Designer' });
    await expect(settings.getPreferences()).resolves.toMatchObject({ prioritizeFit: 1, riskTolerance: 'cautious' });
    expect(jobsChanged).toHaveBeenCalledWith('backup-imported');
    expect(metadataChanged).toHaveBeenCalledTimes(1);
  });

  it('normalizes settings and emits precise change notifications', async () => {
    const onProfileChanged = vi.fn();
    const onPreferencesChanged = vi.fn();
    const service = new SettingsService(browserSettingsRepository, { onProfileChanged, onPreferencesChanged });

    await expect(service.saveProfile({ roles: '  Engineer  ', skills: ' TypeScript  ' })).resolves.toEqual({
      roles: 'Engineer',
      skills: 'TypeScript',
    });
    await expect(service.savePreferences({
      autoEnhanceWithAi: true,
      prioritizeFit: 4,
      prioritizeOpportunity: -1,
      riskTolerance: 'invalid' as never,
    })).resolves.toEqual({
      autoEnhanceWithAi: true,
      prioritizeFit: 1,
      prioritizeOpportunity: 0,
      riskTolerance: 'balanced',
    });
    expect(onProfileChanged).toHaveBeenCalledTimes(1);
    expect(onPreferencesChanged).toHaveBeenCalledTimes(1);

    await service.clearProfile();
    await expect(service.getProfile()).resolves.toEqual({});
    expect(onProfileChanged).toHaveBeenCalledTimes(2);
  });

  it('persists normalized AI mutations and emits one config change per mutation', async () => {
    const onConfigChanged = vi.fn();
    const service = createAiSettings({ onConfigChanged });
    const saved = await service.saveConfig({
      ...DEFAULT_AI_CONFIG,
      provider: 'openai',
      baseUrl: 'https://api.example.com/v1/chat/completions',
      apiKey: 'Bearer test',
      model: ' test-model ',
      enabled: true,
      autoEnhance: true,
    });
    expect(saved).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test',
      model: 'test-model',
      enabled: true,
      autoEnhance: true,
    });
    await expect(service.getConfig()).resolves.toEqual(saved);

    const disabled = await service.saveConfig({ ...saved, enabled: false, autoEnhance: true });
    expect(disabled.autoEnhance).toBe(false);
    expect(onConfigChanged).toHaveBeenCalledTimes(2);
  });
});
