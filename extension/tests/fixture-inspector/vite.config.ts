import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const inspectorRoot = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(inspectorRoot, '../..');

export default defineConfig({
  base: './',
  root: inspectorRoot,
  publicDir: resolve(extensionRoot, '.output/fixture-inspector'),
  server: {
    host: '127.0.0.1',
    fs: {
      allow: [extensionRoot],
    },
  },
});
