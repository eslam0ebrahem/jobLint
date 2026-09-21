import { detectJob } from '@/src/lib/detectors';
import { renderFloatingBadge, removeFloatingBadge } from '@/src/lib/floatingBadge';
import type { DetectedJob } from '@/src/types/job';

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
    let currentJobKey: string | null = null;

    // Handle popup clip request
    browser.runtime.onMessage.addListener((msg, _, send) => {
      if (msg.action === 'clip-job') {
        const job = detectJob();
        send(job);
        return false;
      }
    });

    const handleClip = async (job: DetectedJob): Promise<boolean> => {
      try {
        const res = await browser.runtime.sendMessage({
          action: 'quick-clip-job',
          job,
        });
        return !!res?.success;
      } catch {
        return false;
      }
    };

    const handleOpenDashboard = () => {
      browser.runtime.sendMessage({ action: 'open-dashboard' });
    };

    const updateBadge = async () => {
      const job = detectJob();
      if (!job) {
        removeFloatingBadge();
        currentJobKey = null;
        return;
      }

      const jobKey = job.jobId || job.jobUrl || job.title;
      if (jobKey === currentJobKey) return;
      currentJobKey = jobKey;

      try {
        const status = await browser.runtime.sendMessage({
          action: 'check-job-saved',
          jobId: job.jobId,
          source: job.source,
          jobUrl: job.jobUrl,
        });

        renderFloatingBadge(
          job,
          status?.isSaved || false,
          handleClip,
          handleOpenDashboard,
        );
      } catch {
        renderFloatingBadge(job, false, handleClip, handleOpenDashboard);
      }
    };

    // Initial checks after DOM settles and hydrates
    setTimeout(updateBadge, 400);
    setTimeout(updateBadge, 1000);
    setTimeout(updateBadge, 2200);

    // Watch for SPA job navigation
    window.addEventListener('popstate', updateBadge);
    setInterval(updateBadge, 1000);
  },
});
