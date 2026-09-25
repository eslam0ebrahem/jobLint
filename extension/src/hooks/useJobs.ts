import { useCallback, useEffect, useRef, useState } from 'react';
import type { Job } from '@/src/types/job';
import { sendGatewayRequest, subscribeGateway } from '@/src/lib/gateway';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const nextJobs = await sendGatewayRequest({ action: 'list-jobs' });
      if (sequence === loadSequence.current) setJobs(nextJobs);
      setError(null);
    } catch (reason) {
      if (sequence === loadSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Could not load jobs.');
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  const replaceJob = useCallback((job: Job) => {
    setJobs((current) => {
      const exists = current.some((item) => item.id === job.id);
      const next = exists ? current.map((item) => item.id === job.id ? job : item) : [job, ...current];
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id));
  }, []);

  useEffect(() => {
    void load();
    return subscribeGateway((event) => {
      if (event.type === 'job-updated') replaceJob(event.job);
      else if (event.type === 'jobs-changed') void load();
    });
  }, [load, replaceJob]);

  return { jobs, loading, error, refresh: load, replaceJob, patchJob, removeJob };
}
