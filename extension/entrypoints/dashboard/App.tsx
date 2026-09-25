import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useJobs } from '@/src/hooks/useJobs';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { exportBackupToJson, exportJobsToCsv, readBackupFile } from '@/src/lib/export';
import type { BackupConflictStrategy, BackupPreview } from '@/src/lib/messages';
import type { ApplicationOutcome, Column, DetectedJob, DetectorHealth, Job, JobInsightSummary, RiskLevel } from '@/src/types/job';
import { DashboardHeader } from './components/DashboardHeader';
import { KanbanColumn } from './components/KanbanColumn';
import { JobDetailsDrawer } from './components/JobDetailsDrawer';
import { COLUMNS } from './constants';

type Notice = { message: string; tone: 'success' | 'error' };
type EvaluationBusy = { id: string; ai: boolean } | null;
type BackupDraft = { payload: unknown; preview: BackupPreview };

export default function App() {
  const { jobs, loading, error: jobsError, refresh, replaceJob, patchJob, removeJob } = useJobs();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'score' | 'company'>('updated');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [evaluationBusy, setEvaluationBusy] = useState<EvaluationBusy>(null);
  const [insights, setInsights] = useState<JobInsightSummary | null>(null);
  const [detectorHealth, setDetectorHealth] = useState<DetectorHealth[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [backupDraft, setBackupDraft] = useState<BackupDraft | null>(null);
  const [busyImport, setBusyImport] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;

  const showNotice = (message: string, tone: Notice['tone'] = 'success') => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 6500);
  };

  const loadInsights = async () => {
    try {
      setInsights(await sendGatewayRequest({ action: 'get-insights' }));
    } catch {
      setInsights(null);
    }
  };

  const loadDiagnostics = async () => {
    try {
      setDetectorHealth(await sendGatewayRequest({ action: 'get-detector-health' }));
    } catch {
      setDetectorHealth([]);
    }
  };

  useEffect(() => {
    void loadInsights();
    void loadDiagnostics();
  }, []);

  useEffect(() => {
    void loadInsights();
  }, [jobs.length]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const matchesQuery = !query || [job.title, job.company, job.location, job.salary, job.notes]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesSource = sourceFilter === 'all' || job.source === sourceFilter;
      const matchesRisk = riskFilter === 'all' || job.evaluation?.riskLevel === riskFilter;
      return matchesQuery && matchesSource && matchesRisk;
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'score') return (b.evaluation?.score || 0) - (a.evaluation?.score || 0);
      if (sortBy === 'company') return a.company.localeCompare(b.company);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [jobs, search, sourceFilter, riskFilter, sortBy]);

  const handleMove = async (id: string, column: Column) => {
    const original = jobs.find((job) => job.id === id);
    if (!original || original.column === column) return;
    patchJob(id, { column });
    try {
      const updated = await sendGatewayRequest({ action: 'move-job', id, column });
      if (updated) replaceJob(updated);
      void loadInsights();
    } catch (reason) {
      patchJob(id, { column: original.column });
      showNotice(reason instanceof Error ? reason.message : 'Could not move the job.', 'error');
    }
  };

  const handleDrop = (column: Column, event: React.DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (id) void handleMove(id, column);
  };

  const handleDelete = async (id: string) => {
    try {
      await sendGatewayRequest({ action: 'delete-job', id });
      removeJob(id);
      if (selectedJobId === id) setSelectedJobId(null);
      void loadInsights();
      showNotice('Job and its event history were deleted.');
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not delete the job.', 'error');
    }
  };

  const handleNotes = async (id: string, notes: string) => {
    try {
      const updated = await sendGatewayRequest({ action: 'update-notes', id, notes });
      if (updated) replaceJob(updated);
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not save notes.', 'error');
    }
  };

  const handleOutcome = async (id: string, outcome: ApplicationOutcome) => {
    try {
      const updated = await sendGatewayRequest({ action: 'record-outcome', id, outcome });
      if (updated) replaceJob(updated);
      void loadInsights();
      showNotice('Outcome recorded.');
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not record the outcome.', 'error');
    }
  };

  const handleEvaluate = async (job: Job, enhanceAi = false) => {
    setEvaluationBusy({ id: job.id, ai: enhanceAi });
    try {
      const updated = await sendGatewayRequest({ action: 'evaluate-job', id: job.id, enhanceAi });
      replaceJob(updated);
      await loadInsights();
      showNotice(enhanceAi
        ? (updated.evaluation?.aiEnhanced ? 'AI assessment attached without replacing the local score.' : 'AI review unavailable; local evaluation kept.')
        : 'Local evidence report refreshed.');
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Evaluation failed.', 'error');
    } finally {
      setEvaluationBusy(null);
    }
  };

  const handleExportCsv = () => {
    if (!jobs.length) return showNotice('No jobs to export.', 'error');
    exportJobsToCsv(jobs);
    showNotice(`Exported ${jobs.length} jobs to CSV.`);
  };

  const handleExportBackup = async () => {
    try {
      const payload = await sendGatewayRequest({ action: 'export-backup' });
      exportBackupToJson(payload);
      showNotice('Full local backup downloaded.');
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not export the backup.', 'error');
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const payload = await readBackupFile(file);
      const preview = await sendGatewayRequest({ action: 'preview-backup', payload });
      if (!preview.valid) throw new Error('The backup contains no restorable jobs, events, or settings.');
      setBackupDraft({ payload, preview });
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not read the backup.', 'error');
    }
  };

  const confirmImport = async (strategy: BackupConflictStrategy) => {
    if (!backupDraft) return;
    setBusyImport(true);
    try {
      const result = await sendGatewayRequest({ action: 'import-backup', payload: backupDraft.payload, conflictStrategy: strategy });
      await refresh();
      await loadInsights();
      setBackupDraft(null);
      const issueNote = result.issues.length ? ` ${result.issues.length} record warning${result.issues.length === 1 ? '' : 's'} were recorded.` : '';
      showNotice(`Imported ${result.imported}, replaced ${result.replaced}, skipped ${result.skipped}; restored ${result.eventsImported} events.${issueNote}`);
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not import the backup.', 'error');
    } finally {
      setBusyImport(false);
    }
  };

  const submitManual = async (draft: ManualDraft) => {
    const job: DetectedJob = {
      source: 'manual', title: draft.title, company: draft.company, location: draft.location || undefined,
      salary: draft.salary || undefined, description: draft.description || undefined, jobUrl: draft.jobUrl || undefined,
      applyUrl: draft.jobUrl || undefined,
      detection: { confidence: draft.description ? 0.7 : 0.45, warnings: ['Manually entered posting. Verify the source before applying.'], strategy: 'manual-fallback', state: draft.description ? 'detected' : 'partial', detectedAt: new Date().toISOString() },
    };
    try {
      const saved = await sendGatewayRequest({ action: 'evaluate-job', job });
      replaceJob(saved);
      setShowManual(false);
      await loadInsights();
      showNotice(`Added and evaluated ${saved.title}.`);
    } catch (reason) {
      showNotice(reason instanceof Error ? reason.message : 'Could not add the job.', 'error');
    }
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 p-4 font-sans text-slate-900 sm:p-6">
      <DashboardHeader
        totalJobs={jobs.length}
        search={search}
        onSearchChange={setSearch}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportBackup}
        onImportJson={handleImportFile}
        onAddManual={() => setShowManual(true)}
        onShowInsights={() => setShowInsights(true)}
        onShowDiagnostics={() => { setShowDiagnostics(true); void loadDiagnostics(); }}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter} options={[['all', 'All sources'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['manual', 'Manual'], ['other', 'Other']]} />
        <FilterSelect label="Risk" value={riskFilter} onChange={(value) => setRiskFilter(value as 'all' | RiskLevel)} options={[['all', 'Any risk'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} />
        <FilterSelect label="Sort" value={sortBy} onChange={(value) => setSortBy(value as typeof sortBy)} options={[['updated', 'Recently updated'], ['score', 'Highest fit'], ['company', 'Company A–Z']]} />
        <span className="ml-auto text-xs text-slate-500">{filteredJobs.length} shown{filteredJobs.length !== jobs.length ? ` · ${jobs.length} total` : ''}</span>
        {(search || sourceFilter !== 'all' || riskFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setSourceFilter('all'); setRiskFilter('all'); }} className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800">Clear filters</button>}
      </div>

      {notice && <div role="status" className={`mb-3 flex items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${notice.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="cursor-pointer text-sm leading-none">×</button></div>}
      {jobsError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">{jobsError}</div>}

      {loading ? <div className="py-20 text-center text-sm text-slate-500">Loading jobs…</div> : (
        <div className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => <KanbanColumn key={column.id} column={column} jobs={filteredJobs.filter((job) => (job.column || 'to_apply') === column.id)} onDrop={handleDrop} onMove={handleMove} onDelete={handleDelete} onEvaluate={handleEvaluate} onSelect={(job) => setSelectedJobId(job.id)} evaluationBusy={evaluationBusy} />)}
        </div>
      )}

      {selectedJob && <JobDetailsDrawer job={selectedJob} onClose={() => setSelectedJobId(null)} onMove={handleMove} onDelete={handleDelete} onEvaluate={handleEvaluate} onUpdateNotes={handleNotes} onRecordOutcome={handleOutcome} evaluationBusy={evaluationBusy} />}
      {showInsights && <InsightsDialog insights={insights} onClose={() => setShowInsights(false)} />}
      {showDiagnostics && <DiagnosticsDialog health={detectorHealth} onClose={() => setShowDiagnostics(false)} onRefresh={loadDiagnostics} />}
      {showManual && <ManualDialog onClose={() => setShowManual(false)} onSubmit={submitManual} />}
      {backupDraft && <BackupDialog draft={backupDraft} busy={busyImport} onClose={() => setBackupDraft(null)} onConfirm={confirmImport} />}
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function InsightsDialog({ insights, onClose }: { insights: JobInsightSummary | null; onClose: () => void }) {
  return <Dialog title="Search insights" onClose={onClose}><div className="grid gap-3 sm:grid-cols-3"><Metric label="Active jobs" value={insights?.activeJobs ?? 0} /><Metric label="Average fit" value={insights?.averageFit ?? '—'} /><Metric label="Evaluated" value={insights?.evaluatedJobs ?? 0} /><Metric label="Average opportunity" value={insights?.averageOpportunity ?? '—'} /><Metric label="Average safety" value={insights?.averageSafety ?? '—'} /><Metric label="Sources" value={insights ? Object.keys(insights.sourceCounts).length : 0} /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><List title="Most common skill gaps" values={insights?.topGaps || []} empty="No recurring gaps yet." /><List title="Risk signals" values={insights?.topFlags || []} empty="No recurring risk signals." /></div>{insights && <div className="mt-5"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Pipeline</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(insights.stageCounts).map(([stage, count]) => <div key={stage} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="capitalize text-slate-500">{stage.replace('_', ' ')}</span><strong className="ml-2 text-slate-900">{count}</strong></div>)}</div></div>}</Dialog>;
}

function DiagnosticsDialog({ health, onClose, onRefresh }: { health: DetectorHealth[]; onClose: () => void; onRefresh: () => void }) {
  return <Dialog title="Detector diagnostics" onClose={onClose}><div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Checks the active supported tabs without reading unrelated sites.</p><button type="button" onClick={() => void onRefresh()} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh</button></div>{health.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No active supported job tabs were found.</p> : <div className="space-y-2">{health.map((item) => <div key={item.tabId} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900">{item.title || item.label}</strong><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${item.state === 'detected' ? 'bg-emerald-100 text-emerald-800' : item.state === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{item.state}</span></div><p className="mt-1 truncate text-xs text-slate-500">{item.company || 'No company extracted'} · {item.url}</p><p className="mt-1 text-[10px] text-slate-400">{item.strategy} · {Math.round(item.confidence * 100)}% confidence</p>{item.warnings.map((warning) => <p key={warning} className="mt-1 text-[11px] text-amber-700">⚠ {warning}</p>)}</div>)}</div>}</Dialog>;
}

function ManualDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (draft: ManualDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<ManualDraft>({ title: '', company: '', location: '', salary: '', jobUrl: '', description: '' });
  const [saving, setSaving] = useState(false);
  const update = (key: keyof ManualDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!draft.title.trim() || !draft.company.trim()) return; setSaving(true); try { await onSubmit(draft); } finally { setSaving(false); } };
  return <Dialog title="Add a job manually" onClose={onClose}><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><ManualField label="Title *" value={draft.title} onChange={(value) => update('title', value)} /><ManualField label="Company *" value={draft.company} onChange={(value) => update('company', value)} /><ManualField label="Location" value={draft.location} onChange={(value) => update('location', value)} /><ManualField label="Compensation" value={draft.salary} onChange={(value) => update('salary', value)} /><div className="sm:col-span-2"><ManualField label="Job URL" type="url" value={draft.jobUrl} onChange={(value) => update('jobUrl', value)} /></div><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Description</span><textarea rows={6} value={draft.description} onChange={(event) => update('description', event.target.value)} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-indigo-500" /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Evaluating…' : 'Add & evaluate'}</button></div></form></Dialog>;
}

function BackupDialog({ draft, busy, onClose, onConfirm }: { draft: BackupDraft; busy: boolean; onClose: () => void; onConfirm: (strategy: BackupConflictStrategy) => Promise<void> }) {
  const { preview } = draft;
  return <Dialog title="Review backup before restore" onClose={onClose}><div className="grid gap-3 sm:grid-cols-3"><Metric label="Jobs" value={preview.jobCount} /><Metric label="Events" value={preview.eventCount} /><Metric label="Conflicts" value={preview.conflictCount} /></div><p className="mt-4 text-sm leading-6 text-slate-600">This backup uses schema v{preview.schemaVersion}. {preview.hasProfile ? 'Candidate profile settings will be restored.' : 'No profile settings were included.'} {preview.hasPreferences ? 'Evaluation preferences will be restored.' : 'No evaluation preferences were included.'}</p>{preview.issues.length > 0 && <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><summary className="cursor-pointer font-semibold">{preview.issues.length} record warning(s)</summary><ul className="mt-2 list-disc pl-5">{preview.issues.slice(0, 12).map((issue, index) => <li key={`${issue.index}-${index}`}>{issue.reason}</li>)}</ul></details>}<div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void onConfirm('skip')} disabled={busy} className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Skip conflicts</button><button type="button" onClick={() => void onConfirm('overwrite')} disabled={busy} className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Restoring…' : 'Overwrite conflicts'}</button></div></Dialog>;
}

type ManualDraft = { title: string; company: string; location: string; salary: string; jobUrl: string; description: string };
function ManualField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></label>; }
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-950">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="cursor-pointer rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div>{children}</div></div>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl text-slate-950">{value}</strong><span className="text-[11px] text-slate-500">{label}</span></div>; }
function List({ title, values, empty }: { title: string; values: string[]; empty: string }) { return <div className="rounded-xl border border-slate-200 p-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>{values.length ? <ul className="mt-2 space-y-1 text-sm text-slate-700">{values.map((value) => <li key={value}>· {value}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">{empty}</p>}</div>; }
