import { getActiveJobs, saveJob } from '@/src/lib/db';
import type { DetectedJob } from '@/src/types/job';

interface BackgroundMessage {
  action: string;
  jobId?: string;
  source?: string;
  jobUrl?: string;
  job?: DetectedJob;
}

const SUPPORTED_MATCH_PATTERNS = [
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
];

async function injectContentScriptIntoOpenTabs() {
  try {
    const tabs = await browser.tabs.query({ url: SUPPORTED_MATCH_PATTERNS });
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
        } catch {
          // Tab may be discarded, restricted, or already closed
        }
      }
    }
  } catch {
    // Ignore query errors
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    injectContentScriptIntoOpenTabs();
  });

  browser.runtime.onMessage.addListener(
    (msg: BackgroundMessage, _sender, sendResponse: (res?: unknown) => void) => {
      if (msg.action === 'check-job-saved') {
        getActiveJobs()
          .then((jobs) => {
            const existing = jobs.find(
              (j) =>
                (msg.jobId && j.jobId === msg.jobId && j.source === msg.source) ||
                (msg.jobUrl && j.jobUrl === msg.jobUrl),
            );
            sendResponse({ isSaved: !!existing, job: existing });
          })
          .catch((err) => {
            sendResponse({ isSaved: false, error: String(err) });
          });
        return true; // Keep message channel open for async sendResponse in Chrome
      }

      if (msg.action === 'quick-clip-job' && msg.job) {
        saveJob({
          ...msg.job,
          column: 'to_apply',
          status: 'active',
        })
          .then(({ isNew, id }) => {
            sendResponse({ success: true, isNew, id });
          })
          .catch((err) => {
            sendResponse({ success: false, error: String(err) });
          });
        return true; // Keep message channel open for async sendResponse in Chrome
      }

      if (msg.action === 'open-dashboard') {
        browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
        sendResponse({ success: true });
        return false;
      }

      return false;
    },
  );
});
