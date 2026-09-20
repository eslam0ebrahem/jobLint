import type { DetectedJob } from '@/src/types/job';
import tailwindCss from '@/src/styles.css?inline';

let hostEl: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let dismissedJobKey: string | null = null;

export function removeFloatingBadge() {
  if (hostEl) {
    hostEl.remove();
    hostEl = null;
    shadowRoot = null;
  }
}

const BTN_CLIP =
  'cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full shadow-lg transition-all select-none bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white';
const BTN_SAVED =
  'cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full shadow-sm border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 transition-all select-none';

export function renderFloatingBadge(
  job: DetectedJob,
  isSaved: boolean,
  onClip: (job: DetectedJob) => Promise<boolean>,
  onOpenDashboard: () => void,
) {
  const currentKey = job.jobId || job.jobUrl || job.title;
  if (dismissedJobKey === currentKey) return;

  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.id = 'joblint-floating-root';
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);
  }

  if (!shadowRoot) return;

  shadowRoot.innerHTML = `
    <style>${tailwindCss}</style>
    <div class="fixed bottom-6 right-20 z-[2147483647] flex items-center gap-1.5 font-sans animate-in fade-in slide-in-from-bottom-2 duration-200">
      ${
        isSaved
          ? `
          <button class="${BTN_SAVED}" id="joblint-main-btn" title="Saved in Kanban. Click to open Kanban board.">
            <span>✓</span> In Kanban
          </button>
        `
          : `
          <button class="${BTN_CLIP}" id="joblint-main-btn" title="1-click save this job to JobLint Kanban">
            <span>⚡</span> Clip to Kanban
          </button>
        `
      }
      <button class="cursor-pointer w-7 h-7 rounded-full bg-white hover:bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-xs text-slate-600 transition-all hover:scale-105" id="joblint-dashboard-btn" title="Open Kanban Dashboard">
        📊
      </button>
      <button class="cursor-pointer w-4 h-4 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-600 leading-none" id="joblint-dismiss-btn" title="Hide for this job">
        ×
      </button>
    </div>
  `;

  const mainBtn = shadowRoot.getElementById('joblint-main-btn');
  const dashBtn = shadowRoot.getElementById('joblint-dashboard-btn');
  const dismissBtn = shadowRoot.getElementById('joblint-dismiss-btn');

  if (mainBtn) {
    mainBtn.addEventListener('click', async () => {
      if (isSaved) {
        onOpenDashboard();
      } else {
        mainBtn.innerHTML = '<span>⏳</span> Saving...';
        const success = await onClip(job);
        if (success) {
          mainBtn.className = BTN_SAVED;
          mainBtn.innerHTML = '<span>✓</span> Clipped!';
          setTimeout(() => {
            if (mainBtn) mainBtn.innerHTML = '<span>✓</span> In Kanban';
          }, 1500);
        } else {
          mainBtn.innerHTML = '<span>✕</span> Failed';
          setTimeout(() => {
            if (mainBtn) {
              mainBtn.className = BTN_CLIP;
              mainBtn.innerHTML = '<span>⚡</span> Clip to Kanban';
            }
          }, 2000);
        }
      }
    });
  }

  if (dashBtn) {
    dashBtn.addEventListener('click', onOpenDashboard);
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      dismissedJobKey = currentKey;
      removeFloatingBadge();
    });
  }
}
