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
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'clip-job') {
        sendResponse(detectJob());
      }
    });
  },
});
