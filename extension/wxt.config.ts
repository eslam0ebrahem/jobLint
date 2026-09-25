import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { SUPPORTED_HOST_PERMISSIONS } from './src/lib/detectors/registry';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'JobLint - Local-first Job Hunter and Kanban',
    description: 'Clip supported job postings, run local evidence-based fit evaluation, and track applications in a private Kanban board.',
    action: {
      default_title: 'JobLint',
    },
    permissions: ['activeTab', 'storage', 'tabs', 'scripting'],
    host_permissions: SUPPORTED_HOST_PERMISSIONS,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
