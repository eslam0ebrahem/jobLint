import { useJobs } from '@/src/hooks/useJobs';
import { deleteJob, updateJobColumn, updateJobNotes, saveJob } from '@/src/lib/db';
import { evaluateJobWithAi } from '@/src/lib/evaluator';
import { exportJobsToCsv, exportJobsToJson, importJobsFromJson } from '@/src/lib/export';
import type { Column, Job } from '@/src/types/job';
import { useState } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { KanbanColumn } from './components/KanbanColumn';
import { JobDetailsDrawer } from './components/JobDetailsDrawer';
import { COLUMNS } from './constants';

export default function App() {
  const { jobs, loading, refresh } = useJobs();
  const [search, setSearch] = useState('');
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  const handleDrop = async (col: Column, e: React.DragEvent) => {
    e.preventDefault();

    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      await updateJobColumn(id, col);
      await refresh();
    }
  };

  const handleMove = async (id: string, col: Column) => {
    await updateJobColumn(id, col);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this job?')) {
      if (selectedJobId === id) setSelectedJobId(null);
      await deleteJob(id);
      await refresh();
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    await updateJobNotes(id, notes);
    await refresh();
  };

  const handleExportCsv = () => {
    if (!jobs.length) {
      alert('No jobs to export.');
      return;
    }
    exportJobsToCsv(jobs);
  };

  const handleExportJson = () => {
    if (!jobs.length) {
      alert('No jobs to export.');
      return;
    }
    exportJobsToJson(jobs);
  };

  const handleImportJson = async (file: File) => {
    const res = await importJobsFromJson(file);
    if (res.success) {
      await refresh();
      setFeedback(`Successfully imported ${res.count} job${res.count === 1 ? '' : 's'}!`);
      setTimeout(() => setFeedback(null), 4000);
    } else {
      alert(`Import failed: ${res.error || 'Unknown error'}`);
    }
  };

  const handleEvaluate = async (job: Job) => {
    setEvaluatingId(job.id);
    try {
      const res = await browser.storage.local.get('profile');
      const profile = (res.profile as Record<string, string>) || {};
      const evaluation = await evaluateJobWithAi(job, profile);
      await saveJob({ ...job, evaluation });
      await refresh();
    } catch {
      alert('Could not evaluate job.');
    } finally {
      setEvaluatingId(null);
    }
  };

  const filtered = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-screen p-4 sm:p-6 bg-slate-100 text-slate-900 font-sans box-border overflow-hidden">
      <DashboardHeader
        totalJobs={jobs.length}
        search={search}
        onSearchChange={setSearch}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      {feedback && (
        <div className="mb-3 px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shrink-0 animate-in fade-in duration-200">
          <span>✓ {feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-emerald-600 hover:text-emerald-800 text-sm leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          Loading jobs...
        </div>
      ) : (
        <div className="flex gap-4 flex-1 overflow-x-auto items-start pb-4 min-w-0">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              jobs={filtered.filter((j) => (j.column || 'to_apply') === col.id)}
              onDrop={handleDrop}
              onMove={handleMove}
              onDelete={handleDelete}
              onEvaluate={handleEvaluate}
              onSelect={(job) => setSelectedJobId(job.id)}
              evaluatingId={evaluatingId}
            />
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetailsDrawer
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onMove={handleMove}
          onDelete={handleDelete}
          onEvaluate={handleEvaluate}
          onUpdateNotes={handleUpdateNotes}
          isEvaluating={evaluatingId === selectedJob.id}
        />
      )}
    </div>
  );
}
