import type { Job } from '@/src/types/job';

interface Props {
  job: Job;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function JobCard({ job, onDelete }: Props) {
  return (
    <div className="job-item">
      <div className="job-item-header">
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="job-item-title"
        >
          {job.title}
        </a>
        <button
          className="delete-btn"
          onClick={(e) => onDelete(job.id, e)}
          title="Delete"
        >
          ×
        </button>
      </div>
      <div className="job-item-company">
        {job.company} {job.location ? `• ${job.location}` : ''}
      </div>
      <div className="job-item-meta">
        <span className="source-tag">{job.source}</span>
        {job.salary && <span className="salary-tag">{job.salary}</span>}
      </div>
    </div>
  );
}
