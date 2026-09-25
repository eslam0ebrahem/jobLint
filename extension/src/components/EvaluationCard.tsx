import type { DetectedJob, JobEvaluation, RiskLevel } from '@/src/types/job';

interface Props {
  job: DetectedJob & { evaluation: JobEvaluation };
  onAddToKanban: () => void;
  onCancel: () => void;
  saving?: boolean;
}

const verdictStyles = {
  Apply: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  Caution: 'border-amber-200 bg-amber-50 text-amber-900',
  Skip: 'border-rose-200 bg-rose-50 text-rose-900',
};

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-rose-100 text-rose-800',
};

export function EvaluationCard({ job, onAddToKanban, onCancel, saving = false }: Props) {
  const evaluation = job.evaluation;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-1 text-xs text-slate-800" aria-label="Evaluation report">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-600">Evidence-first report</p>
        <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-950">{job.title}</h2>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
      </div>

      <div className={`flex items-center justify-between gap-2 rounded-xl border p-3 font-bold ${verdictStyles[evaluation.verdict]}`}>
        <div><p className="text-sm">{evaluation.verdictLabel}</p><p className="mt-0.5 text-[10px] font-medium opacity-75">{Math.round(evaluation.confidence * 100)}% confidence · {evaluation.riskLevel} risk</p></div>
        <div className="text-right"><span className="block rounded-lg border border-current bg-white/80 px-2.5 py-1 text-base">{evaluation.score}</span><span className="text-[9px] font-medium">out of 5</span></div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <ScoreCell label="Profile fit" value={evaluation.fitScore} />
        <ScoreCell label="Opportunity" value={evaluation.opportunityScore} />
        <ScoreCell label="Safety" value={evaluation.safetyScore} />
      </div>

      <div className="flex flex-wrap gap-1">
        <Tag>{evaluation.archetype}</Tag><Tag>{evaluation.seniority}</Tag><Tag>{evaluation.remote}</Tag>
        {evaluation.level && <Tag>{evaluation.level}</Tag>}
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold capitalize ${riskStyles[evaluation.riskLevel]}`}>{evaluation.riskLevel} risk</span>
        {evaluation.aiEnhanced && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-800">AI assessment attached</span>}
      </div>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-4 text-slate-700">{evaluation.reason}</p>

      {evaluation.redFlags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900"><p className="font-bold">Risk signals</p><ul className="mt-1 list-disc pl-4">{evaluation.redFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>
      )}

      <SkillList title="Matched skills" values={evaluation.matchedSkills} tone="matched" />
      <SkillList title="Skill gaps" values={evaluation.missingSkills} tone="missing" />

      {evaluation.missingData.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Missing evidence</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{evaluation.missingData.join(' · ')}</p></div>
      )}

      <details className="rounded-lg border border-slate-200 bg-white p-2.5">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-500">Why this score ({evaluation.evidence.length} signals)</summary>
        <ul className="mt-2 space-y-2">{evaluation.evidence.map((item) => <li key={item.id} className="border-l-2 border-indigo-200 pl-2"><div className="flex justify-between gap-2 text-[10px] font-semibold"><span>{item.label}</span><span className="text-slate-400">{Math.round(item.confidence * 100)}%</span></div>{item.value && <p className="text-[10px] text-slate-600">{item.value}</p>}{item.detail && <p className="text-[9px] leading-4 text-slate-400">{item.detail}</p>}</li>)}</ul>
      </details>

      {evaluation.aiAssessment && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-[10px] leading-4 text-violet-950"><strong>AI advisory:</strong> {evaluation.aiAssessment.reason || 'No rationale supplied.'} The deterministic score and verdict remain unchanged.</div>
      )}

      <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white pt-3">
        <button type="button" onClick={onCancel} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={onAddToKanban} disabled={saving} className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : '+ Add to Kanban'}</button>
      </div>
    </section>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2 text-center"><strong className="block text-base text-slate-900">{value}</strong><span className="text-[9px] text-slate-500">{label}</span></div>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">{children}</span>;
}

function SkillList({ title, values, tone }: { title: string; values: string[]; tone: 'matched' | 'missing' }) {
  return <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{title} ({values.length})</p><div className="flex flex-wrap gap-1">{values.length ? values.map((value) => <span key={value} className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${tone === 'matched' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{tone === 'matched' ? '✓' : '×'} {value}</span>) : <span className="text-[10px] text-slate-400">None recorded</span>}</div></div>;
}
