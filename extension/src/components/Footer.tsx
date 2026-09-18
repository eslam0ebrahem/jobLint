interface Props {
  onClip: () => void;
  onEvaluate: () => void;
  evaluating?: boolean;
}

export function Footer({ onClip, onEvaluate, evaluating }: Props) {
  return (
    <footer className="pt-2 flex gap-2">
      <button
        onClick={onEvaluate}
        disabled={evaluating}
        className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <span>⚡</span> {evaluating ? 'Evaluating...' : 'Evaluate Job'}
      </button>
      <button
        onClick={onClip}
        className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
        title="Quick clip directly to Kanban"
      >
        + Clip
      </button>
    </footer>
  );
}
