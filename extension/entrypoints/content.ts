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
      const result = detectJob();
      if (!result?.job) {
        removeFloatingBadge();
        currentJobKey = null;
        return;
      }

      const jobKey = result.job.jobId || result.job.jobUrl || result.job.title;
      if (jobKey === currentJobKey) return;
      currentJobKey = jobKey;

      try {
        const status = await browser.runtime.sendMessage({
          action: 'check-job-saved',
          jobId: result.job.jobId,
          source: result.job.source,
          jobUrl: result.job.jobUrl,
        });

        renderFloatingBadge(
          result.job,
          status?.isSaved || false,
          handleClip,
          handleOpenDashboard,
        );
      } catch {
        renderFloatingBadge(result.job, false, handleClip, handleOpenDashboard);
      }
    };

    // Initial check after DOM settles
    setTimeout(updateBadge, 800);

    // Watch for SPA job navigation (clicking different jobs in search list)
    window.addEventListener('popstate', updateBadge);
    setInterval(updateBadge, 1200);
  },
});
