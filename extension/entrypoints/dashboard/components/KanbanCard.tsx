import type { Column, Job, RiskLevel } from '@/src/types/job';
import { COLUMNS } from '../constants';

interface Props {
  job: Job;
  onMove: (id: string, col: Column) => void | Promise<void>;
  onDelete: (id: string) => void;
  onEvaluate?: (job: Job, enhanceAi?: boolean) => void;
  onSelect?: (job: Job) => void;
  isEvaluating?: boolean;
  isAiEvaluating?: boolean;
}

const riskStyles: Record<RiskLevel, string> = { low: 'bg-emerald-100 text-emerald-800', medium: 'bg-amber-100 text-amber-800', high: 'bg-rose-100 text-rose-800' };

export function KanbanCard({ job, onMove, onDelete, onEvaluate, onSelect, isEvaluating, isAiEvaluating }: Props) {
  const evaluation = job.evaluation;
  const busy = Boolean(isEvaluating || isAiEvaluating);
  return (
    <article draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', job.id)} onClick={() => onSelect?.(job)} className="shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing">
      <div className="mb-1 flex items-start justify-between gap-1.5"><div className="min-w-0 flex-1"><h3 className="line-clamp-2 break-words text-xs font-bold leading-5 text-slate-950">{job.title}</h3><p className="mt-0.5 truncate text-[11px] text-slate-500">{job.company}{job.location ? ` · ${job.location}` : ''}</p></div><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(job.id); }} aria-label={`Delete ${job.title}`} title="Delete" className="cursor-pointer rounded px-1 text-sm leading-none text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button></div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-800">{job.source}</span>{evaluation && <><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${evaluation.verdict === 'Apply' ? 'bg-emerald-100 text-emerald-800' : evaluation.verdict === 'Caution' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{evaluation.score} · {evaluation.verdict}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold capitalize ${riskStyles[evaluation.riskLevel]}`}>{evaluation.riskLevel} risk</span>{evaluation.aiEnhanced && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-800">AI</span>}</>}{job.outcome && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold capitalize text-slate-600">{job.outcome.replace('_', ' ')}</span>}</div>
      {evaluation ? <><div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] text-slate-500"><Metric label="Fit" value={evaluation.fitScore} /><Metric label="Opp." value={evaluation.opportunityScore} /><Metric label="Safety" value={evaluation.safetyScore} /></div><div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span>{evaluation.missingSkills.length ? `${evaluation.missingSkills.length} skill gaps` : 'No skill gaps'}</span><span>{Math.round(evaluation.confidence * 100)}% confidence</span></div><div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-2"><button type="button" onClick={(event) => { event.stopPropagation(); onEvaluate?.(job, false); }} disabled={busy} className="cursor-pointer text-[10px] font-semibold text-slate-500 hover:text-indigo-700 disabled:opacity-50">{isEvaluating ? 'Local…' : '↻ Local'}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEvaluate?.(job, true); }} disabled={busy} title="Request an AI advisory; local score is retained" className="cursor-pointer text-[10px] font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50">{isAiEvaluating ? 'AI…' : '✦ AI'}</button></div></> : <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2"><button type="button" onClick={(event) => { event.stopPropagation(); onEvaluate?.(job, false); }} disabled={busy} className="cursor-pointer rounded border border-indigo-200 bg-indigo-50 px-1 py-1 text-[10px] font-bold text-indigo-700 disabled:opacity-50">{isEvaluating ? 'Local…' : 'Local score'}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEvaluate?.(job, true); }} disabled={busy} className="cursor-pointer rounded border border-violet-200 bg-violet-50 px-1 py-1 text-[10px] font-bold text-violet-700 disabled:opacity-50">{isAiEvaluating ? 'AI…' : 'AI review'}</button></div>}
      {job.notes && <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[10px] text-slate-400" title={job.notes}>📝 {job.notes}</p>}
      <select value={job.column || 'to_apply'} onClick={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); void onMove(job.id, event.target.value as Column); }} className="mt-2 w-full cursor-pointer rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] text-slate-600 outline-none focus:border-indigo-400" aria-label={`Move ${job.title}`}>
        {COLUMNS.map((column) => <option key={column.id} value={column.id}>Move to: {column.label}</option>)}
      </select>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded bg-slate-50 px-1 py-1"><strong className="block text-[11px] text-slate-800">{value}</strong><span>{label}</span></div>; }
