import { detectJob, getDetectorHealth } from '@/src/lib/detectors';
import { renderFloatingBadge, removeFloatingBadge } from '@/src/lib/floatingBadge';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { SUPPORTED_MATCH_PATTERNS } from '@/src/lib/detectors/registry';
import type { DetectedJob } from '@/src/types/job';

const CONTENT_MARKER = '__joblintContentScriptLoaded';

export default defineContentScript({
  matches: SUPPORTED_MATCH_PATTERNS,
  runAt: 'document_idle',
  main() {
    const globalWindow = window as Window & { [CONTENT_MARKER]?: boolean };
    if (globalWindow[CONTENT_MARKER]) return;
    globalWindow[CONTENT_MARKER] = true;

    let currentJobKey: string | null = null;
    let requestGeneration = 0;
    let debounceTimer: number | undefined;
    let observer: MutationObserver | undefined;

    const handleClip = async (job: DetectedJob): Promise<boolean> => {
      try {
        const result = await sendGatewayRequest({ action: 'clip-job', job });
        return Boolean(result?.job);
      } catch {
        return false;
      }
    };

    const handleOpenDashboard = () => {
      void sendGatewayRequest({ action: 'open-dashboard' }).catch(() => undefined);
    };

    const updateBadge = async () => {
      const generation = ++requestGeneration;
      const job = detectJob();
      if (!job) {
        removeFloatingBadge();
        currentJobKey = null;
        return;
      }

      const jobKey = job.jobId || job.jobUrl || `${job.title}|${job.company}`;
      if (jobKey === currentJobKey) return;
      currentJobKey = jobKey;

      try {
        const status = await sendGatewayRequest({ action: 'check-job-saved', job });
        if (generation !== requestGeneration) return;
        renderFloatingBadge(job, status.isSaved, handleClip, handleOpenDashboard);
      } catch {
        if (generation === requestGeneration) renderFloatingBadge(job, false, handleClip, handleOpenDashboard);
      }
    };

    const scheduleUpdate = () => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => void updateBadge(), 180);
    };

    browser.runtime.onMessage.addListener((message: unknown, sender, send) => {
      const action = (message as { action?: string } | undefined)?.action;
      if (action === 'detector-health') {
        send(getDetectorHealth(sender.tab?.id ?? -1, location.href));
        return false;
      }
      if (action === 'clip-job') {
        send(detectJob());
        return false;
      }
      if (action === 'refresh-job-badge') {
        scheduleUpdate();
        send({ ok: true });
        return false;
      }
      return false;
    });

    const start = () => {
      scheduleUpdate();
      window.setTimeout(scheduleUpdate, 700);
      window.setTimeout(scheduleUpdate, 1800);
      observer = new MutationObserver(scheduleUpdate);
      const root = document.body || document.documentElement;
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    };

    window.addEventListener('popstate', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleUpdate();
    });

    if (document.body) start();
    else window.addEventListener('DOMContentLoaded', start, { once: true });
  },
});
