import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/fixture-inspector.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: 'node scripts/generate-fixture-inspector.mjs && vite --config tests/fixture-inspector/vite.config.ts --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4175',
    headless: true,
  },
});
