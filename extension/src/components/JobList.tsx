import type { Job } from '@/src/types/job';
import { JobCard } from './JobCard';

interface Props {
  jobs: Job[];
  loading: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onEvaluate?: (job: Job) => void;
  evaluatingId?: string | null;
}

export function JobList({ jobs, loading, onDelete, onEvaluate, evaluatingId }: Props) {
  if (loading)
    return <div className="text-center text-slate-400 text-xs py-5">Loading jobs...</div>;
  if (jobs.length === 0)
    return <div className="text-center text-slate-400 text-xs py-5">No jobs saved yet.</div>;

  return (
    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-2.5 pr-0.5">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onDelete={onDelete}
          onEvaluate={onEvaluate}
          isEvaluating={evaluatingId === job.id}
        />
      ))}
    </div>
  );
}
