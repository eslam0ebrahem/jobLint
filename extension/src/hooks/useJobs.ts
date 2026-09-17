import { getActiveJobs } from '@/src/lib/db';
import type { Job } from '@/src/types/job';
import { useEffect, useState } from 'react';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setJobs(await getActiveJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { jobs, loading, error, refresh: load };
}
