import type { Column, Job } from '@/src/types/job';
import { COLUMNS } from '../constants';

interface Props {
  job: Job;
  onMove: (id: string, col: Column) => void;
  onDelete: (id: string) => void;
}

export function KanbanCard({ job, onMove, onDelete }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', job.id)}
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing shrink-0"
    >
      <div className="flex justify-between items-start gap-1.5 mb-1">
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-slate-900 hover:text-blue-600 line-clamp-2 leading-snug flex-1 break-words"
        >
          {job.title}
        </a>
        <button
          onClick={() => onDelete(job.id)}
          className="text-slate-400 hover:text-red-500 text-sm leading-none p-0.5 cursor-pointer shrink-0"
          title="Delete"
        >
          ×
        </button>
      </div>

      <p className="text-[11px] text-slate-500 my-1 truncate">
        {job.company} {job.location ? `• ${job.location}` : ''}
      </p>

      <div className="flex gap-1.5 flex-wrap mb-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize bg-indigo-100 text-indigo-800">
          {job.source}
        </span>
        {job.salary && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 truncate max-w-full">
            {job.salary}
          </span>
        )}
      </div>

      <select
        value={job.column || 'to_apply'}
        onChange={(e) => onMove(job.id, e.target.value as Column)}
        className="w-full text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-500 cursor-pointer"
      >
        {COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            Move to: {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
