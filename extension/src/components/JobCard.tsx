import type { Job } from '@/src/types/job';

interface Props {
  job: Job;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function JobCard({ job, onDelete }: Props) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 hover:border-slate-300 transition-colors">
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

      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize bg-indigo-100 text-indigo-800">
          {job.source}
        </span>
        {job.evaluation?.verdictLabel && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              job.evaluation.verdict === 'Apply'
                ? 'bg-emerald-100 text-emerald-800'
                : job.evaluation.verdict === 'Caution'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {job.evaluation.verdictLabel} ({job.evaluation.score})
          </span>
        )}
        {job.salary && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
            {job.salary}
          </span>
        )}
      </div>
    </div>
  );
}
