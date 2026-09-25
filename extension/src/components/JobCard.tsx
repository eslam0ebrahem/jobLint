import type { Job, RiskLevel } from '@/src/types/job';

interface Props {
  job: Job;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onEvaluate?: (job: Job, enhanceAi?: boolean) => void;
  isEvaluating?: boolean;
  isAiEvaluating?: boolean;
}

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-rose-100 text-rose-800',
};

export function JobCard({ job, onDelete, onEvaluate, isEvaluating, isAiEvaluating }: Props) {
  const evaluation = job.evaluation;
  const matched = evaluation?.matchedSkills || [];
  const missingCount = evaluation?.missingSkills.length || 0;
  const busy = Boolean(isEvaluating || isAiEvaluating);

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {job.jobUrl ? (
            <a href={job.jobUrl} target="_blank" rel="noreferrer" className="block truncate text-xs font-bold leading-5 text-slate-950 hover:text-indigo-700">{job.title}</a>
          ) : <h3 className="truncate text-xs font-bold text-slate-950">{job.title}</h3>}
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
        </div>
        <button type="button" onClick={(event) => onDelete(job.id, event)} title="Delete saved job" aria-label={`Delete ${job.title}`} className="cursor-pointer rounded px-1 text-sm leading-none text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-800">{job.source}</span>
        {evaluation && (
          <>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${evaluation.verdict === 'Apply' ? 'bg-emerald-100 text-emerald-800' : evaluation.verdict === 'Caution' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{evaluation.score} · {evaluation.verdict}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold capitalize ${riskStyles[evaluation.riskLevel]}`}>{evaluation.riskLevel} risk</span>
            {evaluation.aiEnhanced && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-800">AI review</span>}
          </>
        )}
        {job.salary && <span className="max-w-full truncate rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">{job.salary}</span>}
      </div>

      {evaluation ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] text-slate-500">
            <MiniScore label="Fit" value={evaluation.fitScore} />
            <MiniScore label="Opportunity" value={evaluation.opportunityScore} />
            <MiniScore label="Safety" value={evaluation.safetyScore} />
          </div>
          {matched.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {matched.slice(0, 3).map((skill) => <span key={skill} className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">✓ {skill}</span>)}
              {(matched.length > 3 || missingCount > 0) && <span className="px-1 text-[9px] text-slate-400">{matched.length > 3 ? `+${matched.length - 3}` : ''}{matched.length > 3 && missingCount ? ' · ' : ''}{missingCount ? `${missingCount} gap${missingCount === 1 ? '' : 's'}` : ''}</span>}
            </div>
          )}
          <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-600">{evaluation.reason}</p>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
            <span className="text-[9px] text-slate-400">{Math.round(evaluation.confidence * 100)}% confidence</span>
            <div className="flex gap-1">
              <ActionButton label={isEvaluating ? 'Local…' : 'Local'} disabled={busy} onClick={() => onEvaluate?.(job, false)} />
              <ActionButton label={isAiEvaluating ? 'AI…' : 'AI'} disabled={busy} onClick={() => onEvaluate?.(job, true)} />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-200 pt-2">
          <ActionButton label={isEvaluating ? 'Evaluating…' : 'Local score'} disabled={busy} onClick={() => onEvaluate?.(job, false)} primary />
          <ActionButton label={isAiEvaluating ? 'Reviewing…' : 'AI review'} disabled={busy} onClick={() => onEvaluate?.(job, true)} />
        </div>
      )}
    </article>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return <div className="rounded bg-white px-1 py-1"><strong className="block text-[11px] text-slate-800">{value}</strong><span>{label}</span></div>;
}

function ActionButton({ label, disabled, onClick, primary = false }: { label: string; disabled: boolean; onClick: () => void; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`cursor-pointer rounded-md border px-2 py-1 text-[9px] font-bold disabled:cursor-wait disabled:opacity-50 ${primary ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>{label}</button>;
}
