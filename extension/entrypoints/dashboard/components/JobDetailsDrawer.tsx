import { useEffect, useState } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import type { ApplicationEvent, ApplicationOutcome, Column, Job, RiskLevel } from '@/src/types/job';
import { COLUMNS } from '../constants';

interface Props {
  job: Job | null;
  onClose: () => void;
  onMove: (id: string, col: Column) => void | Promise<void>;
  onDelete: (id: string) => void;
  onEvaluate?: (job: Job, enhanceAi?: boolean) => void;
  onUpdateNotes?: (id: string, notes: string) => void | Promise<void>;
  onRecordOutcome?: (id: string, outcome: ApplicationOutcome) => void | Promise<void>;
  evaluationBusy?: { id: string; ai: boolean } | null;
}

const OUTCOMES: { value: ApplicationOutcome; label: string }[] = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export function JobDetailsDrawer({ job, onClose, onMove, onDelete, onEvaluate, onUpdateNotes, onRecordOutcome, evaluationBusy }: Props) {
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    setNotes(job?.notes || '');
    setNotesSaved(false);
    setConfirmDelete(false);
  }, [job?.id, job?.notes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!job) return;
    let active = true;
    setEventsLoading(true);
    sendGatewayRequest({ action: 'get-events', jobId: job.id })
      .then((nextEvents) => { if (active) setEvents(nextEvents); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [job?.id, job?.updatedAt]);

  if (!job) return null;
  const evaluation = job.evaluation;
  const busy = evaluationBusy?.id === job.id;
  const saveNotes = async () => {
    if (!onUpdateNotes) return;
    setSavingNotes(true);
    try {
      await onUpdateNotes(job.id, notes);
      setNotesSaved(true);
      window.setTimeout(() => setNotesSaved(false), 2200);
    } finally {
      setSavingNotes(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm"><div className="fixed inset-0" onClick={onClose} aria-hidden="true" /><aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl" aria-label={`Details for ${job.title}`}>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3"><div className="flex min-w-0 items-center gap-2"><span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-800">{job.source}</span><select value={job.column || 'to_apply'} onChange={(event) => void onMove(job.id, event.target.value as Column)} className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" aria-label="Job stage">{COLUMNS.map((column) => <option key={column.id} value={column.id}>Stage: {column.label}</option>)}</select></div><button type="button" onClick={onClose} aria-label="Close details" title="Close (Esc)" className="cursor-pointer rounded-md p-1 text-lg leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700">×</button></div>
    <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs text-slate-800">
      <header><h2 className="text-xl font-bold leading-snug text-slate-950">{job.title}</h2><p className="mt-1 text-sm text-slate-600">{job.company}{job.location ? ` · ${job.location}` : ''}</p><div className="mt-2 flex flex-wrap items-center gap-2">{job.salary && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{job.salary}</span>}<span className="text-[11px] text-slate-400">Clipped {new Date(job.clippedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span></div><div className="mt-3 flex flex-wrap gap-2">{job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-indigo-600 px-3.5 py-1.5 font-semibold text-white hover:bg-indigo-700">Apply now ↗</a>}{job.jobUrl && <a href={job.jobUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100">View posting ↗</a>}</div></header>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidence report</h3><div className="flex gap-1"><button type="button" onClick={() => onEvaluate?.(job, false)} disabled={Boolean(busy)} className="cursor-pointer rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-700 disabled:opacity-50">{evaluationBusy?.id === job.id && !evaluationBusy.ai ? 'Local…' : 'Local'}</button><button type="button" onClick={() => onEvaluate?.(job, true)} disabled={Boolean(busy)} title="AI is an advisory assessment; local score is retained" className="cursor-pointer rounded border border-violet-200 bg-white px-2 py-1 text-[10px] font-bold text-violet-700 disabled:opacity-50">{evaluationBusy?.id === job.id && evaluationBusy.ai ? 'AI…' : '✦ AI'}</button></div></div>{evaluation ? <EvaluationDetails evaluation={evaluation} /> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">This job has not been evaluated yet.</div>}</section>

      <section className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Application outcome</h3>{job.outcome && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600">{job.outcome.replace('_', ' ')}</span>}</div><select value={job.outcome || ''} onChange={(event) => { if (event.target.value) void onRecordOutcome?.(job.id, event.target.value as ApplicationOutcome); }} className="mt-3 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" aria-label="Application outcome"><option value="">No outcome recorded</option>{OUTCOMES.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select></section>

      <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Application notes</h3>{notesSaved && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}</div><textarea rows={4} value={notes} onChange={(event) => { setNotes(event.target.value); setNotesSaved(false); }} placeholder="Recruiter contacts, interview dates, follow-up notes…" className="w-full resize-y rounded-lg border border-slate-300 p-2.5 leading-relaxed outline-none focus:border-indigo-500" /><div className="flex justify-end"><button type="button" onClick={() => void saveNotes()} disabled={savingNotes} className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">{savingNotes ? 'Saving…' : 'Save notes'}</button></div></section>

      <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Activity timeline</h3>{eventsLoading ? <p className="text-xs text-slate-400">Loading activity…</p> : events.length ? <ol className="space-y-2 border-l-2 border-slate-200 pl-4">{[...events].reverse().map((event) => <li key={event.id} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-indigo-400" /><strong className="capitalize text-slate-700">{event.type.replace('_', ' ')}</strong><span className="ml-2 text-slate-400">{new Date(event.at).toLocaleString()}</span>{event.metadata?.reason && <span className="ml-2 text-slate-500">{event.metadata.reason}</span>}</li>)}</ol> : <p className="text-xs text-slate-400">No recorded events yet.</p>}</section>

      <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Job description</h3><div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 leading-relaxed text-slate-700">{job.description || <span className="italic text-slate-400">No job description was captured.</span>}</div>{job.detection?.warnings?.length ? <ul className="mt-2 space-y-1 text-[11px] text-amber-700">{job.detection.warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}</ul> : null}</section>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">{!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)} className="cursor-pointer text-xs font-semibold text-rose-600 hover:text-rose-800">Delete job</button> : <div className="flex items-center gap-2"><span className="text-xs text-rose-700">Delete this job and its history?</span><button type="button" onClick={() => { onDelete(job.id); onClose(); }} className="cursor-pointer rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">Yes, delete</button><button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer text-xs text-slate-500">Cancel</button></div>}<button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Close</button></div>
    </div>
  </aside></div>;
}

function EvaluationDetails({ evaluation }: { evaluation: NonNullable<Job['evaluation']> }) {
  const riskClass: Record<RiskLevel, string> = { low: 'bg-emerald-100 text-emerald-800', medium: 'bg-amber-100 text-amber-800', high: 'bg-rose-100 text-rose-800' };
  return <div className="mt-4 space-y-3"><div className={`flex items-center justify-between rounded-xl border p-3 font-bold ${evaluation.verdict === 'Apply' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : evaluation.verdict === 'Caution' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><div><p className="text-sm">{evaluation.verdictLabel}</p><p className="mt-0.5 text-[10px] font-medium opacity-75">{Math.round(evaluation.confidence * 100)}% confidence · {evaluation.legitimacy}</p></div><span className="rounded-lg border border-current bg-white/80 px-3 py-1.5 text-lg">{evaluation.score}<small className="ml-1 text-[9px]">/ 5</small></span></div><div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><Score label="Fit" value={evaluation.fitScore} /><Score label="Opportunity" value={evaluation.opportunityScore} /><Score label="Safety" value={evaluation.safetyScore} /></div><div className="flex flex-wrap gap-1.5 text-[10px]"><span className="rounded bg-slate-200/70 px-2 py-0.5">{evaluation.archetype}</span><span className="rounded bg-slate-200/70 px-2 py-0.5">{evaluation.seniority}</span><span className="rounded bg-slate-200/70 px-2 py-0.5">{evaluation.remote}</span><span className={`rounded px-2 py-0.5 font-bold capitalize ${riskClass[evaluation.riskLevel]}`}>{evaluation.riskLevel} risk</span>{evaluation.aiEnhanced && <span className="rounded bg-violet-100 px-2 py-0.5 font-bold text-violet-800">AI advisory attached</span>}</div><p className="rounded-lg border border-slate-200 bg-white p-2.5 leading-relaxed text-slate-700">{evaluation.reason}</p>{evaluation.redFlags.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900"><strong className="block text-[10px] uppercase">Risk signals</strong><ul className="mt-1 list-disc pl-4 text-[11px]">{evaluation.redFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}<div className="grid gap-2 sm:grid-cols-2"><SkillList title="Matched skills" values={evaluation.matchedSkills} tone="matched" /><SkillList title="Skill gaps" values={evaluation.missingSkills} tone="missing" /></div>{evaluation.missingData.length > 0 && <p className="text-[10px] text-slate-500"><strong>Missing evidence:</strong> {evaluation.missingData.join(' · ')}</p>}<details className="rounded-lg border border-slate-200 bg-white p-2.5"><summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence signals ({evaluation.evidence.length})</summary><ul className="mt-2 space-y-2">{evaluation.evidence.map((item) => <li key={item.id} className="border-l-2 border-indigo-200 pl-2 text-[10px]"><div className="flex justify-between gap-2 font-semibold"><span>{item.label}</span><span className="text-slate-400">{Math.round(item.confidence * 100)}%</span></div>{item.value && <p className="text-slate-600">{item.value}</p>}{item.detail && <p className="text-slate-400">{item.detail}</p>}</li>)}</ul></details>{evaluation.aiAssessment && <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-[10px] leading-relaxed text-violet-950"><strong>AI advisory:</strong> {evaluation.aiAssessment.reason || 'No rationale supplied.'} The local score and verdict were not replaced.</div>}</div>;
}

function Score({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-white p-2"><strong className="block text-base text-slate-900">{value}</strong><span>{label}</span></div>; }
function SkillList({ title, values, tone }: { title: string; values: string[]; tone: 'matched' | 'missing' }) { return <div className="rounded-lg border border-slate-200 bg-white p-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title} ({values.length})</p><div className="mt-1.5 flex flex-wrap gap-1">{values.length ? values.map((value) => <span key={value} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone === 'matched' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{tone === 'matched' ? '✓' : '×'} {value}</span>) : <span className="text-[10px] text-slate-400">None recorded</span>}</div></div>; }
