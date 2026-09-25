import { useEffect, useState } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { DECISION_STATES, type DecisionInbox, type DecisionState, type JobComparison } from '@/src/types/decisions';
import type { PolicyLevel } from '@/src/types/policy';

const LEVEL_BADGE: Record<PolicyLevel, string> = {
  pass: 'bg-emerald-100 text-emerald-800',
  caution: 'bg-amber-100 text-amber-800',
  block: 'bg-rose-100 text-rose-800',
  unknown: 'bg-slate-100 text-slate-600',
};

interface Props {
  onClose: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

export function DecisionDialog({ onClose, onError, onNotice }: Props) {
  const [inbox, setInbox] = useState<DecisionInbox | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<JobComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextActions, setNextActions] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setInbox(await sendGatewayRequest({ action: 'get-decision-inbox' }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not load the decision inbox.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setDecision = async (jobId: string, state: DecisionState) => {
    setBusy(true);
    try {
      await sendGatewayRequest({ action: 'save-decision', jobId, state, nextAction: nextActions[jobId] });
      await load();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not save the decision.');
    } finally {
      setBusy(false);
    }
  };

  const compare = async () => {
    if (selected.length < 2) return;
    setBusy(true);
    try {
      setComparison(await sendGatewayRequest({ action: 'compare-jobs', ids: selected }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not compare those jobs.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (jobId: string) => {
    setSelected((current) => (current.includes(jobId)
      ? current.filter((id) => id !== jobId)
      : current.length >= 5 ? current : [...current, jobId]));
    setComparison(null);
  };

  const items = inbox?.items || [];

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">Decide</h2>
        <button type="button" onClick={onClose} aria-label="Close dialog" className="cursor-pointer rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
      </div>

      <p className="mb-4 max-w-3xl text-xs leading-5 text-slate-500">
        A decision records your intent and the next action. It never changes the local score and never moves a card on the board. Tick
        two to five jobs to compare them side by side on score, claim coverage, gates, gaps, compensation, and freshness.
      </p>

      {inbox && <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {DECISION_STATES.map((state) => <span key={state} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold capitalize text-slate-600">{state.replace('_', ' ')} {inbox.counts[state]}</span>)}
      </div>}

      {items.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nothing to decide yet. Clip a few jobs first.</p> : (
        <ul className="space-y-2">
          {items.map((item) => <li key={item.jobId} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <label className="flex min-w-0 cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={selected.includes(item.jobId)} onChange={() => toggle(item.jobId)} className="mt-1 accent-indigo-600" aria-label={`Compare ${item.title}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-950">{item.title}</span>
                  <span className="block truncate text-xs text-slate-600">{item.company}</span>
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{item.score === null ? 'Not evaluated' : `${item.score} / 5`}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_BADGE[item.policyLevel]}`}>{item.policyBlocked ? 'Blocked' : item.policyLevel}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={item.state}
                onChange={(event) => void setDecision(item.jobId, event.target.value as DecisionState)}
                disabled={busy}
                aria-label={`Decision for ${item.title}`}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium capitalize text-slate-700 outline-none focus:border-indigo-400"
              >
                {DECISION_STATES.map((state) => <option key={state} value={state}>{state.replace('_', ' ')}</option>)}
              </select>
              <input
                value={nextActions[item.jobId] ?? item.decision?.nextAction ?? ''}
                onChange={(event) => setNextActions((current) => ({ ...current, [item.jobId]: event.target.value }))}
                onBlur={(event) => { if (event.target.value.trim()) void setDecision(item.jobId, item.state); }}
                placeholder="Next action, e.g. send résumé by Friday"
                aria-label={`Next action for ${item.title}`}
                className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-400"
              />
            </div>
          </li>)}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4">
        <span className="text-xs text-slate-500">{selected.length} selected</span>
        <button type="button" onClick={() => void compare()} disabled={busy || selected.length < 2} className="cursor-pointer rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Compare</button>
        {comparison?.recommendedJobId && <span className="text-xs text-slate-600">Recommended: {comparison.rows.find((row) => row.jobId === comparison.recommendedJobId)?.title}</span>}
      </div>

      {comparison && <div className="mt-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Why this order</h3>
        <ul className="mb-4 list-disc pl-5 text-xs text-slate-600">{comparison.basis.map((item) => <li key={item}>{item}</li>)}</ul>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[42rem] text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['Role', 'Score', 'Gates', 'Claim coverage', 'Gaps', 'Compensation', 'Age', 'Decision'].map((header) => <th key={header} className="px-2.5 py-2 font-bold uppercase tracking-wide">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => <tr key={row.jobId} className={`border-t border-slate-100 ${row.jobId === comparison.recommendedJobId ? 'bg-indigo-50/60' : ''}`}>
                <td className="px-2.5 py-2">
                  <span className="block font-semibold text-slate-900">{row.title}</span>
                  <span className="block text-slate-500">{row.company}</span>
                  {row.jobId === comparison.recommendedJobId && <span className="mt-0.5 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">Recommended</span>}
                </td>
                <td className="px-2.5 py-2 font-bold text-slate-900">{row.score ?? '—'}</td>
                <td className="px-2.5 py-2">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${LEVEL_BADGE[row.policyLevel]}`}>{row.policyBlocked ? 'Blocked' : row.policyLevel}</span>
                  {row.policyIssues.length > 0 && <span className="mt-0.5 block text-[10px] text-slate-500">{row.policyIssues.join(', ')}</span>}
                </td>
                <td className="px-2.5 py-2">{row.coveredRequirements}/{row.totalRequirements}</td>
                <td className="px-2.5 py-2 text-slate-600">{row.gapRequirements.length ? row.gapRequirements.join(', ') : '—'}</td>
                <td className="px-2.5 py-2 text-slate-600">{row.compensationMax === null ? '—' : `${row.compensationCurrency || ''} ${row.compensationMax.toLocaleString()}`}</td>
                <td className="px-2.5 py-2 text-slate-600">{row.postingAgeDays === null ? '—' : `${row.postingAgeDays}d`}</td>
                <td className="px-2.5 py-2 capitalize text-slate-600">{row.decisionState.replace('_', ' ')}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => { setSelected([]); setComparison(null); onNotice('Comparison cleared.'); }} className="mt-2 cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-800">Clear selection</button>
      </div>}
    </div>
  </div>;
}
