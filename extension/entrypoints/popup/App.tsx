import { useState } from 'react';
import { saveJob, deleteJob } from '@/src/lib/db';
import { useJobs } from '@/src/hooks/useJobs';
import { Header } from '@/src/components/Header';
import { JobList } from '@/src/components/JobList';
import { Footer } from '@/src/components/Footer';
import './App.css';

export default function App() {
  const { jobs, loading, refresh } = useJobs();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClip = async () => {
    setFeedback(null);
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      const res = await browser.tabs.sendMessage(tab.id, { action: 'clip-job' });
      if (res?.job) {
        const { isNew } = await saveJob({ ...res.job, column: 'to_apply', status: 'active' });
        await refresh();
        setFeedback(isNew ? `Saved: ${res.job.title}` : `Updated: ${res.job.title}`);
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert('No job detected on this page.');
      }
    } catch {
      alert('Could not connect. Refresh the job page and try again.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteJob(id);
    await refresh();
  };

  return (
    <div className="popup-container">
      <Header count={jobs.length} />
      {feedback && <div className="success-banner">✓ {feedback}</div>}
      <JobList jobs={jobs} loading={loading} onDelete={handleDelete} />
      <Footer onClip={handleClip} />
    </div>
  );
}
