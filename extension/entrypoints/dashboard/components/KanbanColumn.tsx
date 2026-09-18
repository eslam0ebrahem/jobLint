import type { Column, Job } from '@/src/types/job';
import type { ColumnDef } from '../constants';
import { KanbanCard } from './KanbanCard';

interface Props {
  column: ColumnDef;
  jobs: Job[];
  onDrop: (col: Column, e: React.DragEvent) => void;
  onMove: (id: string, col: Column) => void;
  onDelete: (id: string) => void;
  onEvaluate?: (job: Job) => void;
  evaluatingId?: string | null;
}

export function KanbanColumn({
  column,
  jobs,
  onDrop,
  onMove,
  onDelete,
  onEvaluate,
  evaluatingId,
}: Props) {
  return (
    <div
      className="w-72 shrink-0 bg-slate-50/90 border border-slate-200 rounded-xl p-3 flex flex-col max-h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(column.id, e)}
    >
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 mb-2.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
        <span className="text-xs font-bold text-slate-800 flex-1 truncate">
          {column.label}
        </span>
        <span className="bg-slate-200 text-slate-600 text-[11px] font-bold px-1.5 py-0.2 rounded-full">
          {jobs.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-0.5 min-h-[100px]">
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
            Drop jobs here
          </div>
        ) : (
          jobs.map((job) => (
            <KanbanCard
              key={job.id}
              job={job}
              onMove={onMove}
              onDelete={onDelete}
              onEvaluate={onEvaluate}
              isEvaluating={evaluatingId === job.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
