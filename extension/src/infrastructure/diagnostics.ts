import type { ManifestSummary, StorageUsage } from '@/src/domain/diagnostics';

export const browserDiagnosticsAdapter = {
  async getStorageUsage(): Promise<StorageUsage> {
    const estimate = await navigator.storage?.estimate?.();
    return {
      usage: estimate?.usage || 0,
      quota: estimate?.quota || 0,
    };
  },

  getManifest(): ManifestSummary {
    const manifest = browser.runtime.getManifest() as {
      version?: string;
      permissions?: string[];
      host_permissions?: string[];
    };
    const permissions = manifest.permissions || [];
    return {
      version: manifest.version || 'unknown',
      permissions: permissions.filter((permission) => !permission.includes('://')),
      hostPermissions: manifest.host_permissions || permissions.filter((permission) => permission.includes('://')),
    };
  },
};
