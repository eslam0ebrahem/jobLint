import type { DetectedJob } from '@/src/types/job';

let hostEl: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let dismissedJobKey: string | null = null;

export function removeFloatingBadge(): void {
  hostEl?.remove();
  hostEl = null;
  shadowRoot = null;
}

function button(className: string, label: string, title: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.className = className;
  element.type = 'button';
  element.textContent = label;
  element.title = title;
  element.setAttribute('aria-label', title);
  return element;
}

const style = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .badge-container { display: flex; align-items: center; gap: 8px; }
  button { border: 0; cursor: pointer; transition: transform .2s, background .2s, box-shadow .2s; }
  button:focus-visible { outline: 3px solid #a5b4fc; outline-offset: 3px; }
  .btn-clip, .btn-saved { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700; }
  .btn-clip { color: #fff; background: #4f46e5; box-shadow: 0 8px 22px rgba(79,70,229,.4); }
  .btn-clip:hover { background: #4338ca; transform: translateY(-1px); }
  .btn-saved { color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; }
  .btn-saved:hover { background: #d1fae5; }
  .btn-dash, .btn-dismiss { display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #475569; border: 1px solid #cbd5e1; }
  .btn-dash { width: 38px; height: 38px; border-radius: 9999px; font-size: 16px; }
  .btn-dash:hover { transform: scale(1.06); background: #f1f5f9; }
  .btn-dismiss { width: 24px; height: 24px; border-radius: 9999px; font-size: 15px; }
`;

export function renderFloatingBadge(
  job: DetectedJob,
  isSaved: boolean,
  onClip: (job: DetectedJob) => Promise<boolean>,
  onOpenDashboard: () => void,
): void {
  const currentKey = job.jobId || job.jobUrl || job.title;
  if (dismissedJobKey === currentKey) return;
  if (!document.body) return;

  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.id = 'joblint-floating-root';
    hostEl.style.cssText = 'all: initial !important; position: fixed !important; bottom: 24px !important; right: 24px !important; z-index: 2147483647 !important; display: block !important; pointer-events: auto !important;';
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
  }
  if (!shadowRoot) return;
  if (!document.body.contains(hostEl)) document.body.appendChild(hostEl);

  shadowRoot.replaceChildren();
  const styleElement = document.createElement('style');
  styleElement.textContent = style;
  const container = document.createElement('div');
  container.className = 'badge-container';
  const main = button(isSaved ? 'btn-saved' : 'btn-clip', isSaved ? '✓ In Kanban' : '⚡ Clip to Kanban', isSaved ? 'Saved in Kanban. Open dashboard.' : 'Clip this job to Kanban.');
  const dashboard = button('btn-dash', '📊', 'Open Kanban dashboard');
  const dismiss = button('btn-dismiss', '×', 'Hide JobLint for this job');
  container.append(main, dashboard, dismiss);
  shadowRoot.append(styleElement, container);

  main.addEventListener('click', async () => {
    if (isSaved) {
      onOpenDashboard();
      return;
    }
    main.disabled = true;
    main.textContent = '⏳ Saving…';
    const success = await onClip(job);
    main.disabled = false;
    if (success) {
      main.className = 'btn-saved';
      main.textContent = '✓ In Kanban';
      main.title = 'Saved in Kanban. Open dashboard.';
    } else {
      main.textContent = '⚠ Try again';
      window.setTimeout(() => {
        main.className = 'btn-clip';
        main.textContent = '⚡ Clip to Kanban';
      }, 1800);
    }
  });
  dashboard.addEventListener('click', onOpenDashboard);
  dismiss.addEventListener('click', () => {
    dismissedJobKey = currentKey;
    removeFloatingBadge();
  });
}
