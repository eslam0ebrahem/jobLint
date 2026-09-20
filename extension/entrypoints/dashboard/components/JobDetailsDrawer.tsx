import { useState, useEffect } from 'react';
import type { Column, Job } from '@/src/types/job';
import { COLUMNS } from '../constants';

interface Props {
  job: Job | null;
  onClose: () => void;
  onMove: (id: string, col: Column) => void;
  onDelete: (id: string) => void;
  onEvaluate?: (job: Job) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  isEvaluating?: boolean;
}

export function JobDetailsDrawer({
  job,
  onClose,
  onMove,
  onDelete,
  onEvaluate,
  onUpdateNotes,
  isEvaluating,
}: Props) {
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    setNotes(job?.notes || '');
    setNotesSaved(false);
  }, [job?.id, job?.notes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!job) return null;

  const e = job.evaluation;
  const matched = Array.isArray(e?.matchedSkills) ? e.matchedSkills : [];
  const missing = Array.isArray(e?.missingSkills) ? e.missingSkills : [];
  const flags = Array.isArray(e?.redFlags) ? e.redFlags : [];

  const handleSaveNotes = () => {
    onUpdateNotes?.(job.id, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const verdictStyles =
    e?.verdict === 'Apply'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : e?.verdict === 'Caution'
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-rose-50 border-rose-200 text-rose-900';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded capitalize bg-indigo-100 text-indigo-800">
              {job.source}
            </span>
            <select
              value={job.column || 'to_apply'}
              onChange={(ev) => onMove(job.id, ev.target.value as Column)}
              className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  Stage: {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 text-base leading-none cursor-pointer"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-slate-800 text-xs">
          {/* Header */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug break-words">
              {job.title}
            </h2>
            <div className="text-sm font-medium text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
              <span>{job.company}</span>
              {job.location && <span>• {job.location}</span>}
              {job.salary && (
                <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded text-xs ml-1">
                  {job.salary}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Clipped: {new Date(job.clippedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </div>

            {/* Quick Links */}
            <div className="flex gap-2 mt-3">
              {job.applyUrl && (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>🚀</span> Apply Now
                </a>
              )}
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔗</span> View Posting
              </a>
            </div>
          </div>

          {/* Evaluation Card */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Fit Evaluation
              </h3>
              {e && (
                <button
                  onClick={() => onEvaluate?.(job)}
                  disabled={isEvaluating}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  ↻ {isEvaluating ? 'Evaluating...' : 'Re-evaluate'}
                </button>
              )}
            </div>

            {e ? (
              <>
                <div className={`p-2.5 rounded-lg border flex items-center justify-between font-bold ${verdictStyles}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{e.verdictLabel}</span>
                    {e.aiEnhanced && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 text-white uppercase tracking-wider font-semibold">
                        AI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/90 border border-current font-semibold">
                      {e.score} / 5.0
                    </span>
                    {e.legitimacy && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/70 border border-slate-300 font-medium text-slate-700">
                        {e.legitimacy}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap text-[11px] font-medium text-slate-600">
                  {e.archetype && <span className="bg-slate-200/70 px-2 py-0.5 rounded">{e.archetype}</span>}
                  {e.seniority && <span className="bg-slate-200/70 px-2 py-0.5 rounded">{e.seniority}</span>}
                  {e.level && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                      🏷️ {e.level}
                    </span>
                  )}
                  {e.remote && <span className="bg-slate-200/70 px-2 py-0.5 rounded">{e.remote}</span>}
                </div>

                {/* Reason */}
                {e.reason && (
                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 italic leading-relaxed">
                    "{e.reason}"
                  </p>
                )}

                {/* Red flags */}
                {flags.length > 0 && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    ⚠️ <span className="font-semibold">Red Flags:</span> {flags.join(', ')}
                  </div>
                )}

                {/* Matched Skills */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-700">
                    Matched Skills ({matched.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matched.length ? (
                      matched.map((s) => (
                        <span
                          key={s}
                          className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium text-[11px]"
                        >
                          ✓ {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-xs">No matching skills detected</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills / Skill Gaps */}
                {missing.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Skill Gaps to Address ({missing.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {missing.map((s) => (
                        <span
                          key={s}
                          className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium text-[11px]"
                        >
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 bg-white rounded-lg border border-dashed border-slate-200">
                <p className="text-slate-500 mb-2">Job not evaluated yet</p>
                <button
                  onClick={() => onEvaluate?.(job)}
                  disabled={isEvaluating}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <span>⚡</span> {isEvaluating ? 'Evaluating...' : 'Evaluate Job Now'}
                </button>
              </div>
            )}
          </section>

          {/* Notes Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Application Notes
              </h3>
              {notesSaved && (
                <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>
              )}
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add recruiter contacts, interview dates, follow-up notes..."
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 transition-colors resize-y leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </section>

          {/* Job Description */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Job Description
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-700 font-sans text-xs">
              {job.description || (
                <span className="text-slate-400 italic">No job description text available.</span>
              )}
            </div>
          </section>

          {/* Danger zone */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this job?')) {
                  onDelete(job.id);
                  onClose();
                }
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              Delete Job
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
