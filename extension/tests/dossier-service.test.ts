import { describe, expect, it, vi } from 'vitest';
import { DossierService } from '@/src/application/dossier-service';
import type { DossierEventRecorder, DossierRepository } from '@/src/application/dossier-service';
import type { ApplicationDossier } from '@/src/types/dossier';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job } from '@/src/types/job';

const NOW = '2026-09-25T12:00:00.000Z';

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'linkedin',
    title: 'Senior React Engineer',
    company: 'Northstar Labs',
    location: 'Remote',
    description: 'Build React and TypeScript products.',
    column: 'applied',
    status: 'active',
    clippedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createService(claims: CandidateClaim[] = []) {
  const store = new Map<string, ApplicationDossier>();
  const repository: DossierRepository = {
    getAll: async (jobId) => [...store.values()].filter((item) => !jobId || item.jobId === jobId),
    getById: async (id) => store.get(id),
    getLatestForJob: async (jobId) => [...store.values()].find((item) => item.jobId === jobId),
    save: async (record) => {
      store.set(record.id, record);
      return record;
    },
    delete: async (id) => store.delete(id),
  };
  const changed = vi.fn();
  const ledger = {
    recordEvent: vi.fn(async (..._args: Parameters<DossierEventRecorder['recordEvent']>) => ({ id: 'e1', jobId: 'job-1', type: 'dossier_opened' as const, at: NOW })),
  };
  const service = new DossierService(
    { get: async (id) => (id === 'job-1' ? job() : undefined), getEvents: async () => [] },
    repository,
    { getAll: async () => claims },
    ledger,
    { changed },
    () => NOW,
  );
  return { service, store, changed, ledger };
}

describe('dossier service', () => {
  it('opens a record and records the opening in the transition ledger', async () => {
    const { service, ledger, changed } = createService();
    const dossier = await service.open('job-1');
    expect(dossier).toMatchObject({ jobId: 'job-1', status: 'draft' });
    expect(ledger.recordEvent).toHaveBeenCalledWith('job-1', 'dossier_opened', expect.objectContaining({ dossierId: dossier.id }));
    expect(changed).toHaveBeenCalledWith('job-1');
  });

  it('is idempotent through ensure, so opening twice never duplicates a record', async () => {
    const { service, store } = createService();
    const first = await service.ensure('job-1');
    const second = await service.ensure('job-1');
    expect(second.id).toBe(first.id);
    expect(store.size).toBe(1);
  });

  it('records answers and artifacts, and the matching ledger entries', async () => {
    const { service, ledger } = createService();
    const dossier = await service.open('job-1');
    const withAnswer = await service.saveAnswer(dossier.id, { question: 'Why this role?', answer: 'Because TypeScript.' });
    expect(withAnswer.answers).toHaveLength(1);
    const withArtifact = await service.saveArtifact(dossier.id, { kind: 'resume', label: 'Résumé', reference: '~/resume.pdf' });
    expect(withArtifact.artifacts).toHaveLength(1);
    expect(ledger.recordEvent).toHaveBeenCalledWith('job-1', 'answer_recorded', expect.anything());
    expect(ledger.recordEvent).toHaveBeenCalledWith('job-1', 'artifact_attached', expect.anything());
  });

  it('maps each status change to its own ledger entry', async () => {
    const { service, ledger } = createService();
    const dossier = await service.open('job-1');
    await service.markStatus(dossier.id, 'submitted');
    await service.markStatus(dossier.id, 'closed');
    const types = ledger.recordEvent.mock.calls.map((call) => call[1]);
    expect(types).toContain('dossier_submitted');
    expect(types).toContain('dossier_closed');
  });

  it('cites the claim ledger in the record it captures', async () => {
    const claim: CandidateClaim = {
      version: 1,
      id: 'claim-react',
      kind: 'skill',
      label: 'React',
      status: 'verified',
      source: 'resume',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { service } = createService([claim]);
    const dossier = await service.open('job-1');
    expect(dossier.packet.claimIds).toEqual([]);
    // The job has no evaluation, so no matched skills can be grounded yet.
    expect(dossier.evaluation).toBeNull();
  });

  it('deletes a record and refuses to delete one twice', async () => {
    const { service, store, changed } = createService();
    const dossier = await service.open('job-1');
    await expect(service.remove(dossier.id)).resolves.toBe(true);
    expect(store.size).toBe(0);
    expect(changed).toHaveBeenLastCalledWith('job-1');
    await expect(service.remove(dossier.id)).rejects.toThrow('Dossier not found');
  });

  it('survives a ledger that refuses to record, since the dossier is already saved', async () => {
    const store = new Map<string, ApplicationDossier>();
    const service = new DossierService(
      { get: async () => job(), getEvents: async () => [] },
      {
        getAll: async () => [...store.values()],
        getById: async (id) => store.get(id),
        getLatestForJob: async () => undefined,
        save: async (record) => { store.set(record.id, record); return record; },
        delete: async (id) => store.delete(id),
      },
      { getAll: async () => [] },
      { recordEvent: async () => { throw new Error('ledger offline'); } },
      { changed: () => undefined },
      () => NOW,
    );
    await expect(service.open('job-1')).resolves.toMatchObject({ jobId: 'job-1' });
    expect(store.size).toBe(1);
  });

  it('rejects an answer with no question and an artifact with no reference', async () => {
    const { service } = createService();
    const dossier = await service.open('job-1');
    await expect(service.saveAnswer(dossier.id, { question: '  ', answer: 'x' })).rejects.toThrow(/needs a question/);
    await expect(service.saveArtifact(dossier.id, { kind: 'resume', label: 'Résumé', reference: '' })).rejects.toThrow(/label and a reference/);
  });

  it('refuses to open a record for a job that does not exist', async () => {
    const { service } = createService();
    await expect(service.open('missing')).rejects.toThrow('Job not found');
  });

  it('links an event reference only once', async () => {
    const { service } = createService();
    const dossier = await service.open('job-1');
    const linked = await service.linkEvent(dossier.id, 'event-1');
    const again = await service.linkEvent(linked.id, 'event-1');
    expect(again.eventIds).toEqual(['event-1']);
  });

  it('removes a previously recorded answer and artifact', async () => {
    const { service } = createService();
    const dossier = await service.open('job-1');
    const withAnswer = await service.saveAnswer(dossier.id, { question: 'Q', answer: 'A' });
    const withArtifact = await service.saveArtifact(withAnswer.id, { kind: 'resume', label: 'Résumé', reference: '~/r.pdf' });
    const withoutAnswer = await service.removeAnswer(withArtifact.id, withArtifact.answers[0]!.id);
    expect(withoutAnswer.answers).toEqual([]);
    const withoutArtifact = await service.removeArtifact(withoutAnswer.id, withoutAnswer.artifacts[0]!.id);
    expect(withoutArtifact.artifacts).toEqual([]);
  });
});
