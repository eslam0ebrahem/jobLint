import { detectJob } from '@/src/lib/detectors';

export default defineContentScript({
  matches: ['*://*.linkedin.com/*', '*://*.indeed.com/*'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'clip-job') {
        sendResponse(detectJob());
      }
    });
  },
});
