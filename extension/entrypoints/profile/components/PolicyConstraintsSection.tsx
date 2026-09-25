import { useEffect, useState, type FormEvent } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { DEFAULT_POLICY_CONSTRAINTS, type PolicyConstraints } from '@/src/types/policy';

interface Props {
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function splitList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function PolicyConstraintsSection({ onSaved, onError }: Props) {
  const [constraints, setConstraints] = useState<PolicyConstraints>({ ...DEFAULT_POLICY_CONSTRAINTS });
  const [companies, setCompanies] = useState('');
  const [domains, setDomains] = useState('');
  const [regions, setRegions] = useState('');
  const [compensation, setCompensation] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void sendGatewayRequest({ action: 'get-policy-constraints' })
      .then((value) => {
        if (!active) return;
        setConstraints(value);
        setCompanies(value.doNotApplyCompanies.join('\n'));
        setDomains(value.doNotApplyDomains.join('\n'));
        setRegions(value.authorizedRegions.join('\n'));
        setCompensation(value.minimumCompensation === null ? '' : String(value.minimumCompensation));
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (active) onError(reason instanceof Error ? reason.message : 'Could not load policy constraints.');
      });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await sendGatewayRequest({
        action: 'save-policy-constraints',
        constraints: {
          ...constraints,
          doNotApplyCompanies: splitList(companies),
          doNotApplyDomains: splitList(domains),
          authorizedRegions: splitList(regions),
          minimumCompensation: compensation.trim() ? Number(compensation) : null,
        },
      });
      setConstraints(saved);
      onSaved('Workflow constraints saved locally.');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not save the constraints.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-base font-bold text-slate-900">Workflow constraints</h2>
    <p className="mt-1 text-xs leading-5 text-slate-500">
      Gates answer &ldquo;should you be allowed to move forward on this posting?&rdquo; They are separate from the score: a strong role
      can still be blocked, and every block can be overridden with a recorded reason. An empty list means the check never runs &mdash; it
      never means &ldquo;allow&rdquo;.
    </p>
    {!loaded ? <p className="mt-4 text-sm text-slate-400">Loading constraints…</p> : <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <ListField id="policy-companies" label="Never apply to these companies" value={companies} onChange={setCompanies} placeholder={'one per line\nEvil Corp, Inc.'} />
      <ListField id="policy-domains" label="Never apply on these domains" value={domains} onChange={setDomains} placeholder={'example.com\nanother.example'} />
      <ListField id="policy-regions" label="Regions you are authorized to work in" value={regions} onChange={setRegions} placeholder={'United States\nCanada'} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="policy-compensation" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Minimum compensation</label>
          <input id="policy-compensation" type="number" min={0} value={compensation} onChange={(event) => setCompensation(event.target.value)} placeholder="120000" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label htmlFor="policy-stale" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Stale after (days)</label>
          <input id="policy-stale" type="number" min={1} max={365} value={constraints.stalePostingDays} onChange={(event) => setConstraints((current) => ({ ...current, stalePostingDays: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="policy-confidence" className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Minimum evaluation confidence</span>
          <span>{Math.round(constraints.minEvaluationConfidence * 100)}%</span>
        </label>
        <input id="policy-confidence" type="range" min={0} max={1} step={0.05} value={constraints.minEvaluationConfidence} onChange={(event) => setConstraints((current) => ({ ...current, minEvaluationConfidence: Number(event.target.value) }))} className="w-full accent-indigo-600" />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <button type="submit" disabled={saving} className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save constraints'}
        </button>
      </div>
    </form>}
  </section>;
}

function ListField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
    <textarea id={id} rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
  </div>;
}
