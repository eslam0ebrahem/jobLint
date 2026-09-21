import { useState } from 'react';
import { saveJob, deleteJob } from '@/src/lib/db';
import { useJobs } from '@/src/hooks/useJobs';
import { Header } from '@/src/components/Header';
import { JobList } from '@/src/components/JobList';
import { Footer } from '@/src/components/Footer';
import { EvaluationCard } from '@/src/components/EvaluationCard';
import { evaluateJobWithAi, getProfileMissingNotice } from '@/src/lib/evaluation';
import type { DetectedJob, Job, JobEvaluation } from '@/src/types/job';

export default function App() {
  const { jobs, loading, refresh } = useJobs();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluatingJob, setEvaluatingJob] = useState<(DetectedJob & { evaluation: JobEvaluation }) | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingCardId, setEvaluatingCardId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const getProfile = async () => {
    const res = await browser.storage.local.get('profile');
    return (res.profile as Record<string, string>) || {};
  };

  const getActiveTabJob = async (): Promise<DetectedJob | null> => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;

    let res: DetectedJob | null = null;
    try {
      res = await browser.tabs.sendMessage(tab.id, { action: 'clip-job' });
    } catch {
      // Content script may not be running yet on pre-existing tabs; inject dynamically
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js'],
        });
        await new Promise((r) => setTimeout(r, 250));
        res = await browser.tabs.sendMessage(tab.id, { action: 'clip-job' });
      } catch (err) {
        console.warn('Could not inject or connect to content script:', err);
        return null;
      }
    }
    return res?.title ? res : null;
  };

  const handleEvaluate = async () => {
    setFeedback(null);
    setError(null);

    const profile = await getProfile();
    const notice = getProfileMissingNotice(profile);
    if (notice) {
      showError(notice);
      return;
    }

    setIsEvaluating(true);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        showError('No job detected. Open a job on LinkedIn or Indeed first.');
        return;
      }
      const evaluation = await evaluateJobWithAi(job, profile);
      setEvaluatingJob({ ...job, evaluation });
    } catch {
      showError('Could not connect. Refresh the job page and try again.');
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
    setError(null);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        showError('No job detected. Open a job on LinkedIn or Indeed first.');
        return;
      }
      const { isNew } = await saveJob({ ...job, column: 'to_apply', status: 'active' });
      await refresh();
      setFeedback(isNew ? `Clipped: ${job.title}` : `Updated: ${job.title}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      showError('Could not connect. Refresh the job page and try again.');
    }
  };

  const handleEvaluateCard = async (job: Job) => {
    const profile = await getProfile();
    const notice = getProfileMissingNotice(profile);
    if (notice) {
      showError(notice);
      return;
    }

    setEvaluatingCardId(job.id);
    setError(null);
    try {
      const evaluation = await evaluateJobWithAi(job, profile);
      await saveJob({ ...job, evaluation });
      await refresh();
    } catch {
      showError('Evaluation failed. Please check AI settings or network.');
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
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2.5 py-1.5 rounded-md mb-2 font-medium flex items-center justify-between">
          <span>✓ {feedback}</span>
          <button onClick={() => setFeedback(null)} className="cursor-pointer text-sm leading-none ml-1">×</button>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-2.5 py-1.5 rounded-md mb-2 font-medium flex items-start justify-between gap-1.5">
          <div className="flex-1">
            <span>✕ {error}</span>
            {error.includes('Profile') && (
              <button
                onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/profile.html') })}
                className="mt-1 block font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Open Profile Settings →
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="cursor-pointer text-sm leading-none ml-1 shrink-0">×</button>
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
