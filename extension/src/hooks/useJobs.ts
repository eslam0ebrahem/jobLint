import { useEffect, useState } from 'react';
import { getActiveJobs } from '@/src/lib/db';
import type { Job } from '@/src/types/job';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getActiveJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return { jobs, loading, refresh: load };
}
