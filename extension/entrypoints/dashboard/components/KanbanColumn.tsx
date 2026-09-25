import type { Column, Job } from '@/src/types/job';
import type { ColumnDef } from '../constants';
import { KanbanCard } from './KanbanCard';

interface Props {
  column: ColumnDef;
  jobs: Job[];
  onDrop: (col: Column, e: React.DragEvent) => void;
  onMove: (id: string, col: Column) => void | Promise<void>;
  onDelete: (id: string) => void;
  onEvaluate?: (job: Job, enhanceAi?: boolean) => void;
  onSelect?: (job: Job) => void;
  evaluationBusy?: { id: string; ai: boolean } | null;
}

export function KanbanColumn({ column, jobs, onDrop, onMove, onDelete, onEvaluate, onSelect, evaluationBusy }: Props) {
  return <section className="flex max-h-full w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/90 p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(column.id, event)} aria-label={`${column.label} jobs`}>
    <div className="mb-2.5 flex shrink-0 items-center gap-2 border-b border-slate-200 pb-2.5"><span className={`h-2 w-2 rounded-full ${column.dotColor}`} /><h2 className="flex-1 truncate text-xs font-bold text-slate-800">{column.label}</h2><span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{jobs.length}</span></div>
    <div className="flex min-h-[100px] flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">{jobs.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Drop jobs here</div> : jobs.map((job) => <KanbanCard key={job.id} job={job} onMove={onMove} onDelete={onDelete} onEvaluate={onEvaluate} onSelect={onSelect} isEvaluating={evaluationBusy?.id === job.id && !evaluationBusy.ai} isAiEvaluating={evaluationBusy?.id === job.id && evaluationBusy.ai} />)}</div>
  </section>;
}
