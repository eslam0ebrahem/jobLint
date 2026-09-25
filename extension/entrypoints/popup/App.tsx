import { useState, type FormEvent } from 'react';
import { Header } from '@/src/components/Header';
import { JobList } from '@/src/components/JobList';
import { Footer } from '@/src/components/Footer';
import { EvaluationCard } from '@/src/components/EvaluationCard';
import { useJobs } from '@/src/hooks/useJobs';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { getProfileMissingNotice } from '@/src/domain/settings';
import type { DetectedJob, Job, JobEvaluation } from '@/src/types/job';

type ManualDraft = {
  title: string;
  company: string;
  location: string;
  salary: string;
  jobUrl: string;
  description: string;
};

const EMPTY_DRAFT: ManualDraft = { title: '', company: '', location: '', salary: '', jobUrl: '', description: '' };

export default function App() {
  const { jobs, loading, error: jobsError, refresh } = useJobs();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluatingJob, setEvaluatingJob] = useState<(DetectedJob & { evaluation: JobEvaluation }) | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);
  const [isScanningDiscovery, setIsScanningDiscovery] = useState(false);
  const [evaluatingCardId, setEvaluatingCardId] = useState<string | null>(null);
  const [aiEvaluatingCardId, setAiEvaluatingCardId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualDraft>(EMPTY_DRAFT);
  const [savingManual, setSavingManual] = useState(false);
  const [savingEvaluated, setSavingEvaluated] = useState(false);

  const showError = (message: string) => {
    setError(message);
    window.setTimeout(() => setError(null), 6000);
  };

  const getActiveTabJob = async (): Promise<DetectedJob | null> => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return null;
    try {
      return (await browser.tabs.sendMessage(tab.id, { action: 'clip-job' })) as DetectedJob | null;
    } catch {
      try {
        await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        return (await browser.tabs.sendMessage(tab.id, { action: 'clip-job' })) as DetectedJob | null;
      } catch {
        return null;
      }
    }
  };

  const evaluateActiveJob = async (enhanceAi: boolean) => {
    setFeedback(null);
    setError(null);
    if (enhanceAi) setIsAiEvaluating(true);
    else setIsEvaluating(true);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        showError('No supported job was detected. Try “Add manually” below.');
        return;
      }
      const profile = await sendGatewayRequest({ action: 'get-profile' });
      const notice = getProfileMissingNotice(profile);
      if (notice && !enhanceAi) showError(`${notice} The local report will show lower confidence.`);
      const evaluated = await sendGatewayRequest({ action: 'evaluate-job', job, enhanceAi });
      setEvaluatingJob({ ...job, evaluation: evaluated.evaluation as JobEvaluation });
      if (enhanceAi && !evaluated.evaluation?.aiEnhanced) {
        setFeedback('AI review was unavailable; the deterministic report remains ready to save.');
      }
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not evaluate this job.');
    } finally {
      setIsEvaluating(false);
      setIsAiEvaluating(false);
    }
  };

  const handleSaveEvaluated = async () => {
    if (!evaluatingJob?.evaluation) return;
    setSavingEvaluated(true);
    try {
      await sendGatewayRequest({ action: 'save-job', job: evaluatingJob });
      await refresh();
      setFeedback(`Saved and tracked: ${evaluatingJob.title}`);
      setEvaluatingJob(null);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not save this job.');
    } finally {
      setSavingEvaluated(false);
    }
  };

  const handleClip = async () => {
    setFeedback(null);
    setError(null);
    try {
      const job = await getActiveTabJob();
      if (!job) {
        showError('No supported job was detected. Try “Add manually” below.');
        return;
      }
      const result = await sendGatewayRequest({ action: 'clip-job', job });
      await refresh();
      const enhancement = result.aiEnhanced ? ' with AI review' : '';
      setFeedback(`${result.isNew ? 'Clipped' : 'Already saved; refreshed'}${enhancement}: ${job.title}`);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not clip this job.');
    }
  };

  const handleScanDiscovery = async () => {
    setFeedback(null);
    setError(null);
    setIsScanningDiscovery(true);
    try {
      const result = await sendGatewayRequest({ action: 'scan-discovery-jobs' });
      if (!result.detectedCount) {
        setFeedback('No complete job cards were found on this page. Try a results list or refresh the page.');
        return;
      }
      setFeedback(`Discovery scan found ${result.detectedCount} jobs: ${result.addedCount} new, ${result.refreshedCount} refreshed. Opening the inbox…`);
      await browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html#discovery') });
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not scan this page for jobs.');
    } finally {
      setIsScanningDiscovery(false);
    }
  };

  const handleEvaluateCard = async (job: Job, enhanceAi = false) => {
    if (enhanceAi) setAiEvaluatingCardId(job.id);
    else setEvaluatingCardId(job.id);
    setError(null);
    setFeedback(null);
    try {
      const updated = await sendGatewayRequest({ action: 'evaluate-job', id: job.id, enhanceAi });
      await refresh();
      if (enhanceAi) {
        setFeedback(updated.evaluation?.aiEnhanced
          ? `AI assessment attached; local score remains ${updated.evaluation?.score}.`
          : 'AI review fell back safely to the local evaluation.');
      }
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Evaluation failed.');
    } finally {
      setEvaluatingCardId(null);
      setAiEvaluatingCardId(null);
    }
  };

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await sendGatewayRequest({ action: 'delete-job', id });
      await refresh();
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not delete this job.');
    }
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!manual.title.trim() || !manual.company.trim()) {
      showError('Manual jobs need at least a title and company.');
      return;
    }
    if (manual.jobUrl.trim()) {
      try {
        const url = new URL(manual.jobUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
      } catch {
        showError('Enter a valid http(s) job URL or leave it blank.');
        return;
      }
    }
    setSavingManual(true);
    try {
      const job: DetectedJob = {
        source: 'manual',
        title: manual.title.trim(),
        company: manual.company.trim(),
        location: manual.location.trim() || undefined,
        salary: manual.salary.trim() || undefined,
        description: manual.description.trim() || undefined,
        jobUrl: manual.jobUrl.trim() || undefined,
        applyUrl: manual.jobUrl.trim() || undefined,
        detection: {
          confidence: manual.description.trim() ? 0.7 : 0.45,
          warnings: ['Manually entered posting. Verify the source before applying.'],
          strategy: 'manual-fallback',
          state: manual.description.trim() ? 'detected' : 'partial',
          detectedAt: new Date().toISOString(),
        },
      };
      const evaluated = await sendGatewayRequest({ action: 'evaluate-job', job });
      await refresh();
      setManual(EMPTY_DRAFT);
      setShowManual(false);
      setFeedback(`Manually added and evaluated: ${evaluated.title}`);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'Could not add this job.');
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="box-border flex min-h-[520px] w-[380px] flex-col bg-white font-sans p-3 text-slate-900">
      <Header count={jobs.length} />
      {feedback && <Notice tone="success" onClose={() => setFeedback(null)}>{feedback}</Notice>}
      {(error || jobsError) && <Notice tone="error" onClose={() => setError(null)}>{error || jobsError}</Notice>}

      {evaluatingJob ? (
        <EvaluationCard job={evaluatingJob} onAddToKanban={handleSaveEvaluated} onCancel={() => setEvaluatingJob(null)} saving={savingEvaluated} />
      ) : showManual ? (
        <ManualForm draft={manual} setDraft={setManual} onSubmit={submitManual} onCancel={() => setShowManual(false)} saving={savingManual} />
      ) : (
        <>
          <JobList
            jobs={jobs}
            loading={loading}
            onDelete={handleDelete}
            onEvaluate={handleEvaluateCard}
            evaluatingId={evaluatingCardId}
            aiEvaluatingId={aiEvaluatingCardId}
          />
          <Footer onClip={handleClip} onEvaluate={() => evaluateActiveJob(false)} onEvaluateAi={() => evaluateActiveJob(true)} evaluating={isEvaluating} evaluatingAi={isAiEvaluating} />
          <button type="button" onClick={() => void handleScanDiscovery()} disabled={isScanningDiscovery} className="mt-2 w-full cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{isScanningDiscovery ? 'Scanning visible job cards…' : 'Scan this LinkedIn / Indeed search page'}</button>
          <button type="button" onClick={() => setShowManual(true)} className="mt-2 cursor-pointer text-center text-[11px] font-semibold text-slate-500 hover:text-indigo-700">Couldn’t detect this job? Add it manually</button>
        </>
      )}
    </div>
  );
}

function ManualForm({ draft, setDraft, onSubmit, onCancel, saving }: { draft: ManualDraft; setDraft: React.Dispatch<React.SetStateAction<ManualDraft>>; onSubmit: (event: FormEvent) => void; onCancel: () => void; saving: boolean }) {
  const update = (key: keyof ManualDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1 text-xs">
      <div><h2 className="text-sm font-bold text-slate-950">Add a job manually</h2><p className="mt-0.5 text-[11px] text-slate-500">Use this when a site changes or a posting is hosted elsewhere.</p></div>
      <Field label="Title *" value={draft.title} onChange={(value) => update('title', value)} />
      <Field label="Company *" value={draft.company} onChange={(value) => update('company', value)} />
      <div className="grid grid-cols-2 gap-2"><Field label="Location" value={draft.location} onChange={(value) => update('location', value)} /><Field label="Compensation" value={draft.salary} onChange={(value) => update('salary', value)} /></div>
      <Field label="Job URL" type="url" value={draft.jobUrl} onChange={(value) => update('jobUrl', value)} />
      <label className="block"><span className="mb-1 block font-semibold text-slate-600">Description</span><textarea rows={7} value={draft.description} onChange={(event) => update('description', event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 p-2 outline-none focus:border-indigo-500" /></label>
      <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white pt-2"><button type="button" onClick={onCancel} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Evaluating…' : 'Add & score'}</button></div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block font-semibold text-slate-600">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500" /></label>;
}

function Notice({ children, tone, onClose }: { children: React.ReactNode; tone: 'success' | 'error'; onClose: () => void }) {
  const success = tone === 'success';
  return <div role="status" className={`mb-2 flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-medium ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><span>{success ? '✓' : '⚠'} {children}</span><button type="button" onClick={onClose} aria-label="Dismiss notice" className="cursor-pointer text-sm leading-none">×</button></div>;
}
