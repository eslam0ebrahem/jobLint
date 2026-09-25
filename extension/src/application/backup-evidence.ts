import type { ApplicationDossier } from '@/src/types/dossier';
import type { JobDecision } from '@/src/types/decisions';
import type { StoredPolicyOverride } from '@/src/types/policy';
import type { BackupEvidenceData, BackupClaimSummary } from './backup-service';
import type { ClaimRepository } from './claim-service';
import type { DossierRepository } from './dossier-service';
import type { DecisionRepository } from './decision-service';
import type { PolicyOverrideRepository } from './policy-service';
import { summarizeClaims } from '@/src/domain/claims';

export interface BackupEvidenceSources {
  claims: ClaimRepository;
  dossiers: DossierRepository;
  decisions: DecisionRepository;
  policies: PolicyOverrideRepository;
}

/**
 * Bridges the evidence stores onto the backup contract. Claim saves are the
 * only fallible call, so a malformed record is reported as "not imported"
 * rather than aborting the whole restore.
 */
export function createBackupEvidenceAdapter(sources: BackupEvidenceSources): BackupEvidenceData {
  return {
    async listClaims() {
      return { claims: summarizeClaims(await sources.claims.getAll()).claims as BackupClaimSummary[] };
    },
    listDossiers: (jobId) => sources.dossiers.getAll(jobId),
    listDecisions: () => sources.decisions.getAll(),
    listPolicyOverrides: () => sources.policies.getAll(),
    async saveClaim(claim) {
      try {
        return await sources.claims.save(claim);
      } catch {
        return undefined;
      }
    },
    saveDossier: (dossier) => sources.dossiers.save(dossier as ApplicationDossier),
    saveDecision: (decision) => sources.decisions.save(decision) as Promise<JobDecision | undefined>,
    savePolicyOverride: (override) => sources.policies.save(override as never) as Promise<StoredPolicyOverride | undefined>,
  };
}
