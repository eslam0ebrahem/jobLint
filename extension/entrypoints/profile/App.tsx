import { useEffect, useState, type FormEvent } from 'react';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { DEFAULT_PREFERENCES, type Profile, type UserPreferences } from '@/src/types/job';
import { ClaimLedgerSection } from './components/ClaimLedgerSection';
import { PolicyConstraintsSection } from './components/PolicyConstraintsSection';

const FIELDS = [
  { key: 'name', label: 'Full name', ph: 'Alex Doe', type: 'text' },
  { key: 'email', label: 'Email', ph: 'alex.doe@example.com', type: 'email' },
  { key: 'phone', label: 'Phone', ph: '+1 (555) 019-2834', type: 'tel' },
  { key: 'location', label: 'Location', ph: 'New York, NY', type: 'text' },
  { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/in/username', type: 'url' },
  { key: 'github', label: 'GitHub', ph: 'https://github.com/username', type: 'url' },
  { key: 'roles', label: 'Target roles *', ph: 'Software Engineer, Full Stack Developer', type: 'text' },
  { key: 'skills', label: 'Skills and tech stack *', ph: 'TypeScript, React, Node.js, PostgreSQL, AWS', type: 'text' },
  { key: 'salary', label: 'Target compensation', ph: '$90K–$130K or comparable', type: 'text' },
  { key: 'visa', label: 'Work authorization', ph: 'Citizen / Permanent Resident / Work Permit', type: 'text' },
] as const;

function validOptionalUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validate(profile: Profile): string[] {
  const errors: string[] = [];
  if (!profile.roles?.trim()) errors.push('Target roles are required.');
  if (!profile.skills?.trim()) errors.push('Skills and tech stack are required.');
  if (profile.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errors.push('Enter a valid email address.');
  if (!validOptionalUrl(profile.linkedin || '')) errors.push('LinkedIn must be a valid http(s) URL.');
  if (!validOptionalUrl(profile.github || '')) errors.push('GitHub must be a valid http(s) URL.');
  return errors;
}

export default function App() {
  const [profile, setProfile] = useState<Profile>({});
  const [preferences, setPreferences] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      sendGatewayRequest({ action: 'get-profile' }),
      sendGatewayRequest({ action: 'get-preferences' }),
    ]).then(([nextProfile, nextPreferences]) => {
      if (!active) return;
      setProfile(nextProfile);
      setPreferences(nextPreferences);
      setLoadError(null);
    }).catch((reason: unknown) => {
      if (active) setLoadError(reason instanceof Error ? reason.message : 'Could not load profile settings.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const update = (key: keyof Profile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(profile);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setSaving(true);
    try {
      await sendGatewayRequest({ action: 'save-profile', profile });
      await sendGatewayRequest({ action: 'save-preferences', preferences });
      setNotice('Profile and evaluation preferences saved locally.');
    } catch (reason) {
      setErrors([reason instanceof Error ? reason.message : 'Could not save profile settings.']);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear your candidate profile? Saved jobs and evaluation reports will not be deleted.')) return;
    setSaving(true);
    try {
      await sendGatewayRequest({ action: 'clear-profile' });
      setProfile({});
      setErrors([]);
      setNotice('Candidate profile cleared. Saved jobs were kept.');
    } catch (reason) {
      setErrors([reason instanceof Error ? reason.message : 'Could not clear the profile.']);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CenteredMessage>Loading profile…</CenteredMessage>;
  if (loadError) return <CenteredMessage tone="error">{loadError}</CenteredMessage>;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800 font-sans">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Candidate context</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Profile & evaluation preferences</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            JobLint uses this context for deterministic, on-device scoring. Required fields are used only when you clip or evaluate a job.
          </p>
        </header>

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Please fix the following:</p>
            <ul className="mt-1 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Target and candidate details</h2>
          <p className="mt-1 text-xs text-slate-500">Avoid sensitive information that is not needed to compare a role.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, ph, type }) => (
              <div key={key} className={key === 'roles' || key === 'skills' ? 'sm:col-span-2' : ''}>
                <label htmlFor={key} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
                <input
                  id={key}
                  type={type}
                  value={profile[key] || ''}
                  onChange={(event) => update(key, event.target.value)}
                  placeholder={ph}
                  autoComplete={key === 'email' ? 'email' : key === 'name' ? 'name' : 'off'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <label htmlFor="summary" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Professional summary</label>
            <textarea
              id="summary"
              rows={4}
              value={profile.summary || ''}
              onChange={(event) => update('summary', event.target.value)}
              placeholder="Optional summary of your experience and career goals…"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </section>

        <ClaimLedgerSection onError={(message) => setErrors([message])} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Score weighting</h2>
          <p className="mt-1 text-xs text-slate-500">Safety always retains a 15% minimum contribution; these controls weight fit versus opportunity.</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <RangeControl
              id="fit"
              label="Profile fit"
              value={preferences.prioritizeFit}
              onChange={(prioritizeFit) => setPreferences((current) => ({ ...current, prioritizeFit }))}
            />
            <RangeControl
              id="opportunity"
              label="Opportunity"
              value={preferences.prioritizeOpportunity}
              onChange={(prioritizeOpportunity) => setPreferences((current) => ({ ...current, prioritizeOpportunity }))}
            />
          </div>
          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">Risk tolerance</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(['cautious', 'balanced', 'opportunistic'] as const).map((riskTolerance) => (
                <label key={riskTolerance} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium capitalize ${preferences.riskTolerance === riskTolerance ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  <input className="sr-only" type="radio" name="risk-tolerance" checked={preferences.riskTolerance === riskTolerance} onChange={() => setPreferences((current) => ({ ...current, riskTolerance }))} />
                  {riskTolerance}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <PolicyConstraintsSection onSaved={(message) => setNotice(message)} onError={(message) => setErrors([message])} />

        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
          <h2 className="font-bold">Privacy boundary</h2>
          <p className="mt-1">
            Jobs, evaluations, notes, and event history are stored in this browser&apos;s IndexedDB. Profile fields, scoring preferences, and workflow constraints are stored in <code>browser.storage.local</code>. The claim ledger lives in IndexedDB alongside your jobs. None of it is uploaded by JobLint.
          </p>
          <p className="mt-1">AI is separate and opt-in. If you explicitly enable AI review, only the job text needed for that request is sent directly to the endpoint you configure.</p>
        </section>

        <footer className="flex flex-wrap items-center justify-end gap-3 pb-6">
          <button type="button" onClick={handleClear} disabled={saving} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Clear profile</button>
          <button type="submit" disabled={saving} className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </footer>
      </form>
    </main>
  );
}

function RangeControl({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>{label}</span><span>{Math.round(value * 100)}%</span></span>
      <input id={id} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-indigo-600" />
    </label>
  );
}

function CenteredMessage({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return <main className={`flex min-h-screen items-center justify-center p-6 text-sm font-medium ${tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'}`}>{children}</main>;
}
