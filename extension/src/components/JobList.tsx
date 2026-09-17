import type { Job } from '@/src/types/job';
import { JobCard } from './JobCard';

interface Props {
  jobs: Job[];
  loading: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function JobList({ jobs, loading, onDelete }: Props) {
  if (loading) return <div className="empty-state">Loading jobs...</div>;
  if (jobs.length === 0) return <div className="empty-state">No jobs saved yet.</div>;

  return (
    <div className="job-list">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onDelete={onDelete} />
      ))}
    </div>
  );
}
