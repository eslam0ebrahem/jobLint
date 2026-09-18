import type { Job } from '@/src/types/job';

interface Props {
  job: Job;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onEvaluate?: (job: Job) => void;
  isEvaluating?: boolean;
}

export function JobCard({ job, onDelete, onEvaluate, isEvaluating }: Props) {
  const e = job.evaluation;
  const matched = Array.isArray(e?.matchedSkills) ? e.matchedSkills : [];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 hover:border-slate-300 transition-colors">
      <div className="flex justify-between items-start gap-1.5">
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-slate-900 hover:text-blue-600 truncate flex-1 leading-snug"
        >
          {job.title}
        </a>
        <button
          onClick={(e) => onDelete(job.id, e)}
          title="Delete"
          className="text-slate-400 hover:text-red-500 text-sm leading-none px-1 cursor-pointer"
        >
          ×
        </button>
      </div>

      <div className="text-[11px] text-slate-500 my-1 truncate">
        {job.company} {job.location ? `• ${job.location}` : ''}
      </div>

      {/* Badges: Source, Verdict, Salary */}
      <div className="flex gap-1.5 flex-wrap items-center mb-1">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize bg-indigo-100 text-indigo-800">
          {job.source}
        </span>
        {e?.verdictLabel && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              e.verdict === 'Apply'
                ? 'bg-emerald-100 text-emerald-800'
                : e.verdict === 'Caution'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {e.verdictLabel} ({e.score})
          </span>
        )}
        {job.salary && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
            {job.salary}
          </span>
        )}
      </div>

      {/* Evaluation Tags: Archetype, Seniority, Level, Remote */}
      {e && (
        <div className="flex gap-1 flex-wrap items-center mb-1 text-[10px] font-medium text-slate-600">
          {e.archetype && <span className="bg-slate-200/70 px-1.5 py-0.5 rounded">{e.archetype}</span>}
          {e.seniority && <span className="bg-slate-200/70 px-1.5 py-0.5 rounded">{e.seniority}</span>}
          {e.level && (
            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">
              🏷️ {e.level}
            </span>
          )}
          {e.remote && <span className="bg-slate-200/70 px-1.5 py-0.5 rounded">{e.remote}</span>}
        </div>
      )}

      {/* Matched Skills */}
      {matched.length > 0 && (
        <div className="flex gap-1 flex-wrap items-center mb-1.5">
          {matched.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.2 rounded font-medium"
            >
              ✓ {s}
            </span>
          ))}
          {matched.length > 3 && (
            <span className="text-[9px] text-slate-400 font-medium">+{matched.length - 3}</span>
          )}
        </div>
      )}

      {/* Evaluate / Re-evaluate */}
      {!e ? (
        <button
          onClick={() => onEvaluate?.(job)}
          disabled={isEvaluating}
          className="w-full mt-1.5 py-1 px-2 rounded bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-[10px] font-semibold border border-indigo-200 flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
        >
          <span>⚡</span> {isEvaluating ? 'Evaluating...' : 'Evaluate'}
        </button>
      ) : (
        <div className="flex justify-end mt-1">
          <button
            onClick={() => onEvaluate?.(job)}
            disabled={isEvaluating}
            title="Re-evaluate with AI"
            className="text-[10px] text-slate-400 hover:text-indigo-600 cursor-pointer disabled:opacity-50"
          >
            ↻ {isEvaluating ? 'Evaluating...' : 'Re-evaluate'}
          </button>
        </div>
      )}
    </div>
  );
}
