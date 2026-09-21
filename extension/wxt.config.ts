import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'JobLint - AI Job Hunter and Kanban',
    description: 'Smart job clipper, AI match evaluator, skill gap analyzer, and Kanban tracker for LinkedIn and Indeed.',
    action: {
      default_title: 'JobLint',
    },
    permissions: ['activeTab', 'storage', 'tabs', 'scripting'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
