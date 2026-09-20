import { detectJob } from '@/src/lib/detectors';

export default defineContentScript({
  matches: [
    '*://*.linkedin.com/*',
    '*://*.indeed.com/*',
    '*://*.indeed.co.uk/*',
    '*://*.indeed.ca/*',
    '*://*.indeed.es/*',
    '*://*.indeed.fr/*',
    '*://*.indeed.de/*',
    '*://*.indeed.it/*',
    '*://*.indeed.nl/*',
    '*://*.indeed.com.mx/*',
  ],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((msg, _, send) => {
      if (msg.action === 'clip-job') {
        const result = detectJob();
        if (result?.job) {
          console.log('[JobLint] Detected Job:', {
            title: result.job.title,
            company: result.job.company,
            descLength: result.job.description?.length || 0,
          });
        }
        send(result);
        return true;
      }
    });
  },
});
