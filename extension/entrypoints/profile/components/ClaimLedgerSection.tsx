import { useEffect, useState, type FormEvent } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { CLAIM_KINDS, CLAIM_STATUSES, type ClaimKind, type ClaimLedgerSnapshot, type ClaimSource, type ClaimStatus } from '@/src/types/claims';

const STATUS_TONE: Record<ClaimStatus, string> = {
  verified: 'bg-emerald-100 text-emerald-800',
  asserted: 'bg-amber-100 text-amber-800',
  disputed: 'bg-rose-100 text-rose-800',
  archived: 'bg-slate-100 text-slate-600',
};

interface Props {
  onError: (message: string) => void;
}

export function ClaimLedgerSection({ onError }: Props) {
  const [ledger, setLedger] = useState<ClaimLedgerSnapshot | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ClaimKind>('skill');
  const [source, setSource] = useState<ClaimSource>('resume');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLedger(await sendGatewayRequest({ action: 'list-claims' }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not load the claim ledger.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addClaim = async (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await sendGatewayRequest({ action: 'save-claim', claim: { kind, label, source, reference: reference || undefined } });
      setLabel('');
      setReference('');
      await load();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not save the claim.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: ClaimStatus) => {
    try {
      await sendGatewayRequest({ action: 'set-claim-status', id, status });
      await load();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not update the claim.');
    }
  };

  const remove = async (id: string) => {
    try {
      await sendGatewayRequest({ action: 'delete-claim', id });
      await load();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not delete the claim.');
    }
  };

  const claims = ledger?.claims || [];

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-base font-bold text-slate-900">Claim ledger</h2>
    <p className="mt-1 text-xs leading-5 text-slate-500">
      Record what you can actually evidence, with where it came from. A verified claim is cited by application packets; an asserted
      claim is shown but flagged as unverified. Claims never change the local score.
    </p>

    <form onSubmit={addClaim} className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_8rem_auto] sm:items-end">
      <div>
        <label htmlFor="claim-label" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Claim *</label>
        <input id="claim-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="TypeScript" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div>
        <label htmlFor="claim-kind" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Kind</label>
        <select id="claim-kind" value={kind} onChange={(event) => setKind(event.target.value as ClaimKind)} className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
          {CLAIM_KINDS.map((option) => <option key={option} value={option}>{option.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="claim-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Source</label>
        <select id="claim-source" value={source} onChange={(event) => setSource(event.target.value as ClaimSource)} className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
          <option value="resume">Résumé</option>
          <option value="profile">Profile</option>
          <option value="manual">Manual</option>
          <option value="import">Imported</option>
        </select>
      </div>
      <button type="submit" disabled={saving || !label.trim()} className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? 'Saving…' : 'Add claim'}
      </button>
      <div className="sm:col-span-4">
        <label htmlFor="claim-reference" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Reference (optional)</label>
        <input id="claim-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="résumé line 12, portfolio URL, certificate name…" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </div>
    </form>

    {claims.length === 0 ? (
      <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No claims yet. JobLint will not assert a skill you have not recorded here.
      </p>
    ) : (
      <>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{claims.length} claims</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">{ledger?.statusCounts.verified || 0} verified</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">{ledger?.statusCounts.asserted || 0} asserted</span>
        </div>
        <ul className="mt-3 space-y-2">
          {claims.map((claim) => <li key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {claim.label}
                <span className="ml-2 text-[11px] font-normal text-slate-400">{claim.kind.replace('_', ' ')} · {claim.source}</span>
              </p>
              {claim.reference && <p className="mt-0.5 truncate text-[11px] text-slate-500">{claim.reference}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[claim.status]}`}>{claim.status}</span>
              <select
                value={claim.status}
                onChange={(event) => void setStatus(claim.id, event.target.value as ClaimStatus)}
                aria-label={`Status for ${claim.label}`}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400"
              >
                {CLAIM_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <button type="button" onClick={() => void remove(claim.id)} aria-label={`Delete ${claim.label}`} className="cursor-pointer rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50">×</button>
            </div>
          </li>)}
        </ul>
      </>
    )}
  </section>;
}
