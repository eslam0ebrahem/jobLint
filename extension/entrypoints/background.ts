import { getActiveJobs, saveJob } from '@/src/lib/db';
import type { DetectedJob } from '@/src/types/job';

interface BackgroundMessage {
  action: string;
  jobId?: string;
  source?: string;
  jobUrl?: string;
  job?: DetectedJob;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
    if (msg.action === 'check-job-saved') {
      return getActiveJobs().then((jobs) => {
        const existing = jobs.find(
          (j) =>
            (msg.jobId && j.jobId === msg.jobId && j.source === msg.source) ||
            (msg.jobUrl && j.jobUrl === msg.jobUrl),
        );
        return { isSaved: !!existing, job: existing };
      });
    }

    if (msg.action === 'quick-clip-job' && msg.job) {
      return saveJob({
        ...msg.job,
        column: 'to_apply',
        status: 'active',
      }).then(({ isNew, id }) => ({ success: true, isNew, id }));
    }

    if (msg.action === 'open-dashboard') {
      browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
      return Promise.resolve({ success: true });
    }
  });
});

