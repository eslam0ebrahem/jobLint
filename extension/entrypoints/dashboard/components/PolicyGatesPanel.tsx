import { useEffect, useState } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import type { PolicyDecision, PolicyLevel, PolicyReport } from '@/src/types/policy';

const LEVEL_TONE: Record<PolicyLevel, string> = {
  pass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  caution: 'bg-amber-50 text-amber-900 border-amber-200',
  block: 'bg-rose-50 text-rose-900 border-rose-200',
  unknown: 'bg-slate-50 text-slate-600 border-slate-200',
};

const LEVEL_BADGE: Record<PolicyLevel, string> = {
  pass: 'bg-emerald-100 text-emerald-800',
  caution: 'bg-amber-100 text-amber-800',
  block: 'bg-rose-100 text-rose-800',
  unknown: 'bg-slate-100 text-slate-600',
};

const LEVEL_LABEL: Record<PolicyLevel, string> = {
  pass: 'Clear',
  caution: 'Caution',
  block: 'Blocked',
  unknown: 'Not checked',
};

interface Props {
  jobId: string;
  jobUpdatedAt: string;
  onError: (message: string) => void;
}

export function PolicyGatesPanel({ jobId, jobUpdatedAt, onError }: Props) {
  const [report, setReport] = useState<PolicyReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openPolicy, setOpenPolicy] = useState(false);

  const load = async () => {
    try {
      setReport(await sendGatewayRequest({ action: 'get-policy-report', id: jobId }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not evaluate the policy gates.');
    }
  };

  useEffect(() => {
    setOpenPolicy(false);
    void load();
  }, [jobId, jobUpdatedAt]);

  const override = async (decision: PolicyDecision) => {
    setBusy(decision.code);
    try {
      setReport(await sendGatewayRequest({
        action: 'override-policy-gate',
        jobId,
        code: decision.code,
        level: decision.level === 'block' ? 'caution' : 'pass',
        note: 'Overridden from the job details drawer.',
      }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not save the override.');
    } finally {
      setBusy(null);
    }
  };

  const clear = async (decision: PolicyDecision) => {
    setBusy(decision.code);
    try {
      setReport(await sendGatewayRequest({ action: 'clear-policy-override', id: jobId, code: decision.code }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not clear the override.');
    } finally {
      setBusy(null);
    }
  };

  const decisions = report?.decisions || [];
  const flagged = decisions.filter((item) => (item.override?.level ?? item.level) !== 'pass');

  return <section className="rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow gates</h3>
      <div className="flex items-center gap-2">
        {report && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_BADGE[report.level]}`}>{LEVEL_LABEL[report.level]}</span>}
        <button type="button" onClick={() => setOpenPolicy((current) => !current)} className="cursor-pointer text-[10px] font-bold uppercase text-slate-500 hover:text-slate-800">
          {openPolicy ? 'Hide' : 'All'} {decisions.length}
        </button>
      </div>
    </div>

    {!report ? <p className="mt-3 text-xs text-slate-400">Evaluating gates…</p> : (
      <>
        {report.blocked && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] leading-5 text-rose-900">A gate is blocking this posting. The score is unchanged, but you should only override it if you know why.</p>}
        {report.unresolved > 0 && <p className="mt-2 text-[10px] text-slate-400">{report.unresolved} check(s) never ran because the matching constraint is not configured in Profile.</p>}
        {flagged.length === 0 && !report.blocked && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-900">No gate is cautioning on this posting.</p>}
        <ul className="mt-3 space-y-2">
          {(openPolicy ? decisions : flagged).map((decision) => {
            const level = decision.override?.level ?? decision.level;
            return <li key={decision.code} className={`rounded-xl border p-2.5 ${LEVEL_TONE[level]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[11px] uppercase tracking-wide">{decision.title}</strong>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase">{LEVEL_LABEL[level]}</span>
              </div>
              <p className="mt-1 text-[11px] leading-5">{decision.reason}</p>
              {decision.override && <p className="mt-1 text-[10px] opacity-75">Overridden {formatWhen(decision.override.at)}{decision.override.note ? ` — ${decision.override.note}` : ''}</p>}
              {decision.evidenceIds.length > 0 && <p className="mt-1 text-[10px] opacity-60">Evidence: {decision.evidenceIds.join(', ')}</p>}
              <div className="mt-2 flex gap-1.5">
                {decision.override
                  ? <button type="button" onClick={() => void clear(decision)} disabled={busy === decision.code} className="cursor-pointer rounded border border-current bg-white/80 px-2 py-0.5 text-[10px] font-bold disabled:opacity-50">Restore gate</button>
                  : decision.level !== 'pass' && decision.overridable && <button type="button" onClick={() => void override(decision)} disabled={busy === decision.code} className="cursor-pointer rounded border border-current bg-white/80 px-2 py-0.5 text-[10px] font-bold disabled:opacity-50">{busy === decision.code ? 'Saving…' : 'Override'}</button>}
              </div>
            </li>;
          })}
        </ul>
        {!openPolicy && flagged.length > 0 && <button type="button" onClick={() => setOpenPolicy(true)} className="mt-2 cursor-pointer text-[10px] font-semibold text-slate-500 hover:text-slate-800">Show the {decisions.length - flagged.length} gate(s) that passed</button>}
      </>
    )}
  </section>;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
