import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

interface FirefoxManifest {
  manifest_version: number;
  permissions: string[];
  optional_permissions?: string[];
  background: { scripts: string[] };
  browser_specific_settings?: {
    gecko?: {
      id?: string;
      data_collection_permissions?: { required: string[] };
    };
  };
  content_scripts?: Array<{ matches: string[]; js: string[] }>;
}

test('Firefox MV2 artifact keeps the compatibility contract', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(process.cwd(), '.output/firefox-mv2/manifest.json'), 'utf8'),
  ) as FirefoxManifest;
  const hostPermissions = manifest.permissions.filter((permission) => permission.includes('linkedin.com') || permission.includes('indeed.'));

  expect(manifest.manifest_version).toBe(2);
  expect(manifest.background.scripts).toEqual(['background.js']);
  expect(manifest.permissions).toEqual(expect.arrayContaining(['storage', 'tabs', 'scripting', 'alarms']));
  expect(manifest.optional_permissions).toContain('notifications');
  expect(hostPermissions).toHaveLength(10);
  expect(manifest.browser_specific_settings?.gecko?.id).toBe('joblint@local');
  expect(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required).toEqual(['none']);
  expect(manifest.content_scripts?.[0]?.js).toEqual(['content-scripts/content.js']);
});
