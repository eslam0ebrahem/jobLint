import type { Job } from '@/src/types/job';
import { JobCard } from './JobCard';

interface Props {
  jobs: Job[];
  loading: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onEvaluate?: (job: Job, enhanceAi?: boolean) => void;
  evaluatingId?: string | null;
  aiEvaluatingId?: string | null;
}

export function JobList({ jobs, loading, onDelete, onEvaluate, evaluatingId, aiEvaluatingId }: Props) {
  if (loading) return <div className="py-6 text-center text-xs text-slate-400" role="status">Loading jobs…</div>;
  if (jobs.length === 0) return <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">No active jobs saved yet.</div>;

  return (
    <div className="mb-2.5 flex max-h-80 flex-col gap-2 overflow-y-auto pr-0.5" aria-live="polite">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onDelete={onDelete}
          onEvaluate={onEvaluate}
          isEvaluating={evaluatingId === job.id}
          isAiEvaluating={aiEvaluatingId === job.id}
        />
      ))}
    </div>
  );
}
