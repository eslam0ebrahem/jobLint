import type { DetectedJob, JobEvaluation } from '@/src/types/job';

interface Props {
  job: DetectedJob & { evaluation: JobEvaluation };
  onAddToKanban: () => void;
  onCancel: () => void;
}

export function EvaluationCard({ job, onAddToKanban, onCancel }: Props) {
  const e = job.evaluation || ({} as Partial<JobEvaluation>);
  const matched = e.matchedSkills || [];
  const missing = e.missingSkills || [];
  const flags = e.redFlags || [];

  const verdictStyles =
    e.verdict === 'Apply'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : e.verdict === 'Caution'
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-rose-50 border-rose-200 text-rose-900';

  return (
    <div className="flex flex-col space-y-2 text-slate-800 text-xs">
      <div>
        <h2 className="font-bold text-slate-900 line-clamp-1">{job.title}</h2>
        <p className="text-[11px] text-slate-500 truncate">
          {job.company} {job.location ? `• ${job.location}` : ''}
        </p>
      </div>

      <div className={`p-2 rounded-lg border flex items-center justify-between font-bold ${verdictStyles}`}>
        <div className="flex items-center gap-1.5">
          <span>{e.verdictLabel || 'Evaluation'}</span>
          {e.aiEnhanced && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600 text-white uppercase tracking-wider">
              AI
            </span>
          )}
        </div>
        <span className="px-2 py-0.5 rounded bg-white/90 border border-current text-[11px]">
          {e.score ?? 3.0} / 5.0
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap text-[10px] font-semibold text-slate-600">
        {e.archetype && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{e.archetype}</span>}
        {e.seniority && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{e.seniority}</span>}
        {e.level && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">🏷️ {e.level}</span>}
        {e.remote && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{e.remote}</span>}
      </div>

      {e.reason && (
        <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200 italic">
          "{e.reason}"
        </p>
      )}

      {flags.length > 0 && (
        <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          ⚠️ {flags.join(', ')}
        </div>
      )}

      <div className="space-y-1">
        <div className="text-[11px] font-semibold text-slate-700">Matched Skills</div>
        <div className="flex flex-wrap gap-1">
          {matched.length ? (
            matched.map((s) => (
              <span key={s} className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                ✓ {s}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-slate-400">None detected</span>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-slate-700">Gaps</div>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 6).map((s) => (
              <span key={s} className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                ✕ {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onAddToKanban}
          className="flex-2 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
        >
          + Add to Kanban
        </button>
      </div>
    </div>
  );
}
