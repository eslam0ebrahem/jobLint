import { useState } from 'react';
import { saveJob, deleteJob } from '@/src/lib/db';
import { useJobs } from '@/src/hooks/useJobs';
import { Header } from '@/src/components/Header';
import { JobList } from '@/src/components/JobList';
import { Footer } from '@/src/components/Footer';
import { EvaluationCard } from '@/src/components/EvaluationCard';
import { evaluateJobWithAi } from '@/src/lib/evaluator';
import type { DetectedJob, Job, JobEvaluation } from '@/src/types/job';

export default function App() {
  const { jobs, loading, refresh } = useJobs();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evaluatingJob, setEvaluatingJob] = useState<(DetectedJob & { evaluation: JobEvaluation }) | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingCardId, setEvaluatingCardId] = useState<string | null>(null);

  const getProfile = async () => {
    const res = await browser.storage.local.get('profile');
    return (res.profile as Record<string, string>) || {};
  };

  const getActiveTabJob = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const res = await browser.tabs.sendMessage(tab.id, { action: 'clip-job' });
    return res?.job || null;
  };

  const handleEvaluate = async () => {
    setFeedback(null);
    setIsEvaluating(true);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        alert('No job detected on this page.');
        return;
      }
      const profile = await getProfile();
      const evaluation = await evaluateJobWithAi(job, profile);
      setEvaluatingJob({ ...job, evaluation });
    } catch {
      alert('Could not connect. Refresh the job page and try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSaveEvaluated = async () => {
    if (!evaluatingJob) return;
    const { isNew } = await saveJob({ ...evaluatingJob, column: 'to_apply', status: 'active' });
    await refresh();
    setFeedback(isNew ? `Saved: ${evaluatingJob.title}` : `Updated: ${evaluatingJob.title}`);
    setEvaluatingJob(null);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleClip = async () => {
    setFeedback(null);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        alert('No job detected on this page.');
        return;
      }
      const { isNew } = await saveJob({ ...job, column: 'to_apply', status: 'active' });
      await refresh();
      setFeedback(isNew ? `Clipped: ${job.title}` : `Updated: ${job.title}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      alert('Could not connect. Refresh the job page and try again.');
    }
  };

  const handleEvaluateCard = async (job: Job) => {
    setEvaluatingCardId(job.id);
    try {
      const profile = await getProfile();
      const evaluation = await evaluateJobWithAi(job, profile);
      await saveJob({ ...job, evaluation });
      await refresh();
    } catch {
      alert('Evaluation failed. Please check your settings or network.');
    } finally {
      setEvaluatingCardId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteJob(id);
    await refresh();
  };

  return (
    <div className="w-[340px] p-3 flex flex-col font-sans bg-white text-slate-900 box-border">
      <Header count={jobs.length} />
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2.5 py-1.5 rounded-md mb-2 font-medium">
          ✓ {feedback}
        </div>
      )}
      {evaluatingJob ? (
        <EvaluationCard
          job={evaluatingJob}
          onAddToKanban={handleSaveEvaluated}
          onCancel={() => setEvaluatingJob(null)}
        />
      ) : (
        <>
          <JobList
            jobs={jobs}
            loading={loading}
            onDelete={handleDelete}
            onEvaluate={handleEvaluateCard}
            evaluatingId={evaluatingCardId}
          />
          <Footer onClip={handleClip} onEvaluate={handleEvaluate} evaluating={isEvaluating} />
        </>
      )}
    </div>
  );
}
