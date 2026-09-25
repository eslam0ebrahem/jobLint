interface Props {
  onClip: () => void;
  onEvaluate: () => void;
  onEvaluateAi: () => void;
  evaluating?: boolean;
  evaluatingAi?: boolean;
}

export function Footer({ onClip, onEvaluate, onEvaluateAi, evaluating, evaluatingAi }: Props) {
  const busy = Boolean(evaluating || evaluatingAi);

  return (
    <footer className="pt-2 grid grid-cols-[1fr_1fr_auto] gap-1.5" aria-label="Job actions">
      <button
        type="button"
        onClick={onEvaluate}
        disabled={busy}
        className="px-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <span aria-hidden="true">⚡</span> {evaluating ? 'Evaluating…' : 'Local score'}
      </button>
      <button
        type="button"
        onClick={onEvaluateAi}
        disabled={busy}
        title="Send the job to your configured AI provider"
        className="px-2 py-2 rounded-lg bg-violet-50 hover:bg-violet-100 active:bg-violet-200 text-violet-700 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <span aria-hidden="true">✦</span> {evaluatingAi ? 'AI reviewing…' : 'AI review'}
      </button>
      <button
        type="button"
        onClick={onClip}
        disabled={busy}
        className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
        title="Clip directly to Kanban and run the local evaluation"
      >
        + Clip
      </button>
    </footer>
  );
}
