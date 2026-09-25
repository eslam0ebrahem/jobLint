import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://www.linkedin.com/' },
    },
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
