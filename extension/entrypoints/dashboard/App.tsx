import { useJobs } from '@/src/hooks/useJobs';
import { deleteJob, updateJobColumn } from '@/src/lib/db';
import type { Column } from '@/src/types/job';
import { useState } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { KanbanColumn } from './components/KanbanColumn';
import { COLUMNS } from './constants';

export default function App() {
  const { jobs, loading, refresh } = useJobs();
  const [search, setSearch] = useState('');

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
      await deleteJob(id);
      await refresh();
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
      />

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
