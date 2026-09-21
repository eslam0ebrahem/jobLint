import type { DetectedJob } from '@/src/types/job';

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

export function renderFloatingBadge(
  job: DetectedJob,
  isSaved: boolean,
  onClip: (job: DetectedJob) => Promise<boolean>,
  onOpenDashboard: () => void,
) {
  const currentKey = job.jobId || job.jobUrl || job.title;
  if (dismissedJobKey === currentKey) return;

  if (!document.body) return;

  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.id = 'joblint-floating-root';
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
  }

  // Ensure host element has unbreakable fixed positioning at maximum z-index
  hostEl.style.cssText = `
    all: initial !important;
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: block !important;
    pointer-events: auto !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  `;

  if (!document.body.contains(hostEl)) {
    document.body.appendChild(hostEl);
  }

  if (!shadowRoot) return;

  shadowRoot.innerHTML = `
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .badge-container {
        display: flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        user-select: none;
      }
      .btn-clip {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1);
        background-color: #4f46e5;
        color: #ffffff;
        border: 1px solid #4338ca;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none;
      }
      .btn-clip:hover {
        background-color: #4338ca;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
      }
      .btn-clip:active {
        transform: scale(0.96);
      }
      .btn-saved {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 9999px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        background-color: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .btn-saved:hover {
        background-color: #d1fae5;
        transform: translateY(-1px);
      }
      .btn-dash {
        cursor: pointer;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        background-color: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;
      }
      .btn-dash:hover {
        background-color: #f1f5f9;
        transform: scale(1.08);
      }
      .btn-dismiss {
        cursor: pointer;
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        background-color: rgba(255, 255, 255, 0.9);
        border: 1px solid #cbd5e1;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        line-height: 1;
        transition: all 0.2s;
      }
      .btn-dismiss:hover {
        color: #0f172a;
        background-color: #f8fafc;
      }
    </style>
    <div class="badge-container">
      ${
        isSaved
          ? `
          <button class="btn-saved" id="joblint-main-btn" title="Saved in Kanban. Click to open Kanban board.">
            <span>✓</span> In Kanban
          </button>
        `
          : `
          <button class="btn-clip" id="joblint-main-btn" title="1-click save this job to JobLint Kanban">
            <span>⚡</span> Clip to Kanban
          </button>
        `
      }
      <button class="btn-dash" id="joblint-dashboard-btn" title="Open Kanban Dashboard">
        📊
      </button>
      <button class="btn-dismiss" id="joblint-dismiss-btn" title="Hide for this job">
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
          mainBtn.className = 'btn-saved';
          mainBtn.innerHTML = '<span>✓</span> Clipped!';
          setTimeout(() => {
            if (mainBtn) mainBtn.innerHTML = '<span>✓</span> In Kanban';
          }, 1500);
        } else {
          mainBtn.innerHTML = '<span>✕</span> Failed';
          setTimeout(() => {
            if (mainBtn) {
              mainBtn.className = 'btn-clip';
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
