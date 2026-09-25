import { describe, expect, it, vi } from 'vitest';
import { BackupService } from '@/src/application/backup-service';
import { createBackupEvidenceAdapter } from '@/src/application/backup-evidence';
import { SettingsService } from '@/src/application/settings-service';
import { claimRepository } from '@/src/infrastructure/database/claim-repository';
import { decisionRepository } from '@/src/infrastructure/database/decision-repository';
import { dossierRepository } from '@/src/infrastructure/database/dossier-repository';
import { followUpRepository } from '@/src/infrastructure/database/follow-up-repository';
import { jobRepository, resetDatabaseForTests } from '@/src/infrastructure/database/job-repository';
import { policyRepository } from '@/src/infrastructure/database/policy-repository';
import { browserSettingsRepository } from '@/src/infrastructure/settings/browser-settings-repository';
import { evaluateJob } from '@/src/lib/evaluation';
import type { BackupPayload } from '@/src/domain/backup';
import type { DetectedJob } from '@/src/types/job';

const detected: DetectedJob = {
  source: 'linkedin',
  jobId: 'rt-1',
  title: 'Senior React Engineer',
  company: 'Northstar Labs',
  location: 'Remote, United States',
  description: 'Build React and TypeScript products. 5+ years of experience.',
  jobUrl: 'https://www.linkedin.com/jobs/view/rt-1',
  applyUrl: 'https://boards.greenhouse.io/northstar/rt-1',
};

function build() {
  const settings = new SettingsService(browserSettingsRepository);
  const events = { jobsChanged: vi.fn(), metadataChanged: vi.fn(), evidenceChanged: vi.fn() };
  const service = new BackupService(
    jobRepository,
    settings,
    events,
    undefined,
    undefined,
    followUpRepository,
    createBackupEvidenceAdapter({
      claims: claimRepository,
      dossiers: dossierRepository,
      decisions: decisionRepository,
      policies: policyRepository,
    }),
  );
  return { service, settings, events };
}

/** A realistic local state: job, claim, dossier with provenance, decision, override. */
async function seed() {
  const { service, settings, events } = build();
  const saved = await jobRepository.saveJob({ ...detected, evaluation: evaluateJob(detected, { roles: 'React Engineer', skills: 'React, TypeScript' }) });
  const claim = await claimRepository.save({ kind: 'skill', label: 'TypeScript', status: 'verified', source: 'resume', reference: 'resume.pdf p2' });
  const dossier = await dossierRepository.save({
    version: 1,
    id: 'dossier-rt-1',
    jobId: saved.id,
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    posting: {
      version: 1,
      capturedAt: '2026-01-01T00:00:00.000Z',
      title: detected.title,
      company: detected.company,
      location: detected.location,
      description: detected.description || '',
      jobUrl: detected.jobUrl,
      applyUrl: detected.applyUrl,
      contentHash: 'deadbeef',
      detector: { source: 'linkedin', strategy: 'jsonld', state: 'detected', version: '1' },
    },
    packet: { packetVersion: 2, generatedAt: '2026-01-01T00:00:00.000Z', score: 4.2, claimIds: [claim!.id], policyLevel: 'pass' },
    evaluation: { evaluator: 'heuristic', evaluatorVersion: 2, score: 4.2, verdict: 'Apply', createdAt: '2026-01-01T00:00:00.000Z' },
    answers: [{ id: 'a1', question: 'Why this role?', answer: 'Because TypeScript.', claimIds: [claim!.id], updatedAt: '2026-01-01T00:00:00.000Z' }],
    artifacts: [{ id: 'f1', kind: 'resume', label: 'Résumé 2026', reference: '~/resume.pdf', claimIds: [claim!.id], createdAt: '2026-01-01T00:00:00.000Z' }],
    eventIds: ['e1'],
  });
  await decisionRepository.save({ jobId: saved.id, state: 'shortlisted', nextAction: 'Send résumé by Friday' });
  await policyRepository.save({ jobId: saved.id, code: 'low_evaluation_confidence', level: 'caution', note: 'Reviewed manually' });
  await settings.saveProfile({ roles: 'React Engineer', skills: 'React, TypeScript' });
  await settings.savePolicyConstraints({
    doNotApplyCompanies: ['Bad Corp'],
    doNotApplyDomains: [],
    authorizedRegions: ['United States'],
    minimumCompensation: 120_000,
    stalePostingDays: 30,
    minEvaluationConfidence: 0.5,
  });
  const payload = await service.export();
  return { service, settings, events, payload, jobId: saved.id, claimId: claim!.id, dossierId: dossier.id };
}

/** Rewrites every job-scoped reference, as if exported from another device. */
function foreignize(payload: BackupPayload, from: string, to: string): BackupPayload {
  return {
    ...payload,
    jobs: payload.jobs.map((job) => (job.id === from ? { ...job, id: to } : job)),
    events: payload.events.map((event) => ({ ...event, jobId: event.jobId === from ? to : event.jobId })),
    dossiers: (payload.dossiers || []).map((dossier) => (dossier.jobId === from ? { ...dossier, jobId: to } : dossier)),
    decisions: (payload.decisions || []).map((decision) =>
      decision.jobId === from ? { ...decision, id: to, jobId: to } : decision,
    ),
    policyOverrides: (payload.policyOverrides || []).map((override) =>
      override.jobId === from ? { ...override, key: `${to}::${override.code}`, jobId: to } : override,
    ),
  };
}

describe('backup v3 round trip', () => {
  it('exports every evidence store and reports a valid preview', async () => {
    const { payload, service } = await seed();
    expect(payload.schemaVersion).toBe(3);
    expect(payload.claims).toHaveLength(1);
    expect(payload.dossiers).toHaveLength(1);
    expect(payload.decisions).toHaveLength(1);
    expect(payload.policyOverrides).toHaveLength(1);
    expect(payload.policyConstraints).toMatchObject({ doNotApplyCompanies: ['Bad Corp'], minimumCompensation: 120_000 });
    const preview = await service.preview(payload);
    expect(preview).toMatchObject({ valid: true, claimCount: 1, dossierCount: 1, decisionCount: 1, policyOverrideCount: 1, conflictCount: 1, hasPolicyConstraints: true });
  });

  it('restores everything into a wiped database', async () => {
    const { payload, jobId, dossierId } = await seed();
    await resetDatabaseForTests();
    const { service, settings } = build();

    const result = await service.import(payload);
    expect(result).toMatchObject({
      imported: 1,
      skipped: 0,
      eventsImported: 1,
      claimsImported: 1,
      dossiersImported: 1,
      decisionsImported: 1,
      policyOverridesImported: 1,
      metadataImported: true,
    });

    const job = await jobRepository.getJob(jobId);
    expect(job).toBeDefined();

    const claims = await claimRepository.getAll();
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ label: 'TypeScript', status: 'verified', reference: 'resume.pdf p2' });
    const restoredClaimId = claims[0]!.id;

    const dossiers = await dossierRepository.getAll();
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0]).toMatchObject({ id: dossierId, jobId, status: 'draft' });
    expect(dossiers[0]?.posting.contentHash).toBe('deadbeef');
    expect(dossiers[0]?.packet.claimIds).toEqual([restoredClaimId]);
    expect(dossiers[0]?.answers[0]?.claimIds).toEqual([restoredClaimId]);
    expect(dossiers[0]?.artifacts[0]?.claimIds).toEqual([restoredClaimId]);

    expect(await decisionRepository.getByJobId(jobId)).toMatchObject({ state: 'shortlisted', nextAction: 'Send résumé by Friday' });
    const overrides = await policyRepository.getAll(jobId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({ code: 'low_evaluation_confidence', level: 'caution', note: 'Reviewed manually' });
    await expect(settings.getPolicyConstraints()).resolves.toMatchObject({ doNotApplyCompanies: ['Bad Corp'], stalePostingDays: 30 });
    await expect(settings.getProfile()).resolves.toMatchObject({ roles: 'React Engineer' });
  });

  it('remaps every job-scoped record when the restore lands on a different local job ID', async () => {
    const { payload, jobId } = await seed();
    const foreign = foreignize(payload, jobId, 'foreign-device-1');
    expect(foreign.dossiers?.[0]?.jobId).toBe('foreign-device-1');
    expect(foreign.decisions?.[0]?.jobId).toBe('foreign-device-1');
    expect(foreign.policyOverrides?.[0]?.key).toBe('foreign-device-1::low_evaluation_confidence');

    await resetDatabaseForTests();
    const { service } = build();

    // The same posting already exists here under its own local ID.
    const local = await jobRepository.saveJob({ ...detected, title: 'Senior React Engineer' });
    expect(local.id).not.toBe('foreign-device-1');

    const result = await service.import(foreign, 'skip');
    expect(result).toMatchObject({ skipped: 1, imported: 0, dossiersImported: 1, decisionsImported: 1, policyOverridesImported: 1 });
    expect(result.issues.some((issue) => issue.reason.includes('Skipped duplicate'))).toBe(true);

    const dossiers = await dossierRepository.getAll();
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0]?.jobId).toBe(local.id);
    expect(dossiers[0]?.id).toBe('dossier-rt-1');
    expect(await decisionRepository.getByJobId(local.id)).toMatchObject({ state: 'shortlisted' });
    expect(await decisionRepository.getByJobId('foreign-device-1')).toBeUndefined();
    const overrides = await policyRepository.getAll(local.id);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.key).toBe(`${local.id}::low_evaluation_confidence`);
    expect(await policyRepository.getAll('foreign-device-1')).toEqual([]);
    expect((await jobRepository.getEvents(local.id)).some((event) => event.jobId === local.id)).toBe(true);
  });

  it('merges a repeated claim by kind and label instead of duplicating the ledger', async () => {
    const { payload } = await seed();
    await resetDatabaseForTests();
    const { service } = build();

    await service.import(payload);
    const firstClaim = (await claimRepository.getAll())[0]!;
    expect(firstClaim).toBeDefined();

    // A second restore from another device, with a different local claim ID.
    await service.import({ ...payload, claims: [{ ...payload.claims![0]!, id: 'claim-from-other-device' }] });
    const claims = await claimRepository.getAll();
    expect(claims).toHaveLength(1);
    expect(claims[0]!.id).toBe(firstClaim.id);
  });

  it('notifies the UI layers that actually changed', async () => {
    const { service, events } = build();
    await service.import({ schemaVersion: 3, jobs: [], claims: [], dossiers: [], decisions: [], policyOverrides: [] });
    expect(events.jobsChanged).toHaveBeenCalledWith('backup-imported');
    expect(events.metadataChanged).not.toHaveBeenCalled();
    expect(events.evidenceChanged).not.toHaveBeenCalled();
  });

  it('treats a claims-only backup as valid and importable', async () => {
    const { service } = build();
    const claimsOnly: BackupPayload = {
      schemaVersion: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      jobs: [],
      events: [],
      claims: [{ version: 1, id: 'c1', kind: 'skill', label: 'Rust', status: 'asserted', source: 'manual', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      profile: {},
      preferences: { autoEnhanceWithAi: false, prioritizeFit: 0.6, prioritizeOpportunity: 0.25, riskTolerance: 'balanced' },
    };
    await expect(service.preview(claimsOnly)).resolves.toMatchObject({ valid: true, jobCount: 0, claimCount: 1 });
    await expect(service.import(claimsOnly)).resolves.toMatchObject({ imported: 0, claimsImported: 1 });
    expect((await claimRepository.getAll())[0]).toMatchObject({ label: 'Rust', status: 'asserted' });
  });
});
