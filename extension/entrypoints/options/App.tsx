import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_AI_CONFIG, PROVIDER_PRESETS } from '@/src/lib/ai';
import { sendGatewayRequest } from '@/src/lib/gateway';
import { DEFAULT_PREFERENCES, type AiConfig, type AiProviderId, type UserPreferences } from '@/src/types/job';

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export default function App() {
  const [config, setConfig] = useState<AiConfig>({ ...DEFAULT_AI_CONFIG });
  const [preferences, setPreferences] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      sendGatewayRequest({ action: 'get-ai-config' }),
      sendGatewayRequest({ action: 'get-preferences' }),
    ])
      .then(([nextConfig, nextPreferences]) => {
        if (active) {
          setConfig(nextConfig);
          setPreferences(nextPreferences);
        }
      })
      .catch((reason: unknown) => { if (active) setErrors([errorMessage(reason, 'Could not load AI settings.')]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const provider = useMemo(() => PROVIDER_PRESETS.find((preset) => preset.id === config.provider), [config.provider]);
  const canDiscover = Boolean(config.baseUrl.trim() && (provider?.requiresApiKey ? config.apiKey.trim() : true));

  const chooseProvider = (nextProvider: AiProviderId) => {
    const next = PROVIDER_PRESETS.find((preset) => preset.id === nextProvider);
    setConfig((current) => ({
      ...current,
      provider: nextProvider,
      baseUrl: next?.baseUrl || '',
      apiKey: next?.requiresApiKey === false ? '' : current.apiKey,
      autoEnhance: false,
    }));
    setModels([]);
    setStatus(null);
    setErrors([]);
  };

  const discoverModels = async () => {
    setDiscovering(true);
    setErrors([]);
    setStatus(null);
    try {
      const result = await sendGatewayRequest({
        action: 'fetch-ai-models',
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
      });
      if (!result.success) {
        setErrors([result.error || 'The endpoint returned no models.']);
        return;
      }
      setModels(result.models);
      if (!config.model || !result.models.includes(config.model)) setConfig((current) => ({ ...current, model: result.models[0] || '' }));
      setStatus(`Found ${result.models.length} model${result.models.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setErrors([errorMessage(reason, 'Could not connect to the model endpoint.')]);
    } finally {
      setDiscovering(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    setStatus(null);
    try {
      const saved = await sendGatewayRequest({ action: 'save-ai-config', config });
      await sendGatewayRequest({
        action: 'save-preferences',
        preferences: {
          ...preferences,
          autoEnhanceWithAi: saved.autoEnhance,
        },
      });
      setConfig(saved);
      setStatus('AI settings saved locally. Automatic enhancement remains off unless explicitly enabled.');
    } catch (reason) {
      setErrors([errorMessage(reason, 'Could not save AI settings.')]);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Clear the saved AI endpoint, API key, and model selection? Your local evaluations and jobs will remain.')) return;
    setSaving(true);
    setErrors([]);
    try {
      await sendGatewayRequest({ action: 'clear-ai-config' });
      const clearedPreferences = { ...preferences, autoEnhanceWithAi: false };
      await sendGatewayRequest({ action: 'save-preferences', preferences: clearedPreferences });
      setPreferences(clearedPreferences);
      setConfig({ ...DEFAULT_AI_CONFIG });
      setModels([]);
      setStatus('AI configuration cleared.');
    } catch (reason) {
      setErrors([errorMessage(reason, 'Could not clear AI settings.')]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">Loading AI settings…</main>;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800 font-sans">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Optional network layer</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">AI review settings</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Local scoring works without this page. When you explicitly request AI review, JobLint sends a bounded job snapshot directly from your browser to the endpoint below and keeps the local report as the source score.
          </p>
        </header>

        {errors.length > 0 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
        {status && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{status}</div>}

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Provider</span>
              <select value={config.provider} onChange={(event) => chooseProvider(event.target.value as AiProviderId)} className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500">
                {PROVIDER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Request timeout</span>
              <select value={config.timeoutMs} onChange={(event) => setConfig((current) => ({ ...current, timeoutMs: Number(event.target.value) }))} className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500">
                <option value={5_000}>5 seconds</option>
                <option value={20_000}>20 seconds</option>
                <option value={45_000}>45 seconds</option>
                <option value={60_000}>60 seconds</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">OpenAI-compatible base URL</span>
            <input type="url" value={config.baseUrl} onChange={(event) => { setConfig((current) => ({ ...current, baseUrl: event.target.value })); setStatus(null); }} placeholder="https://api.example.com/v1" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-500" />
            <span className="mt-1 block text-[11px] text-slate-500">HTTPS is required except for localhost Ollama endpoints.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600"><span>API key {provider?.requiresApiKey === false ? '(not required for local Ollama)' : ''}</span><button type="button" onClick={() => setShowKey((value) => !value)} className="cursor-pointer normal-case text-violet-600 hover:text-violet-800">{showKey ? 'Hide' : 'Show'}</button></span>
            <input type={showKey ? 'text' : 'password'} value={config.apiKey} onChange={(event) => { setConfig((current) => ({ ...current, apiKey: event.target.value })); setStatus(null); }} autoComplete="off" placeholder={provider?.requiresApiKey === false ? 'Optional for local endpoints' : 'Paste a key only if you trust this endpoint'} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-500" />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={discoverModels} disabled={discovering || !canDiscover} className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50">{discovering ? 'Discovering…' : 'Discover models'}</button>
            <span className="text-xs text-slate-500">Discovery sends only an authenticated request to the configured endpoint.</span>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Model</span>
            {models.length > 0 ? (
              <select value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500">
                <option value="">Select a model…</option>
                {models.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            ) : (
              <input type="text" value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} placeholder="Enter a model ID" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-500" />
            )}
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Toggle checked={config.enabled} onChange={(enabled) => setConfig((current) => ({ ...current, enabled, autoEnhance: enabled ? current.autoEnhance : false }))} label="Enable explicit AI review" description="Adds an AI review action to the popup and dashboard. Ordinary local clipping remains deterministic." />
          <Toggle checked={config.autoEnhance} disabled={!config.enabled} onChange={(autoEnhance) => setConfig((current) => ({ ...current, autoEnhance }))} label="Enhance new clips automatically" description="When enabled, a newly clipped job is sent for AI review after local scoring. This is off by default and can be used only after AI review is enabled." />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <h2 className="font-bold">Network disclosure</h2>
          <p className="mt-1">JobLint has no backend and no telemetry. The optional AI request includes a bounded description, title, company, location, and the profile fields you chose to include, sent directly to <strong>{config.baseUrl || 'your configured endpoint'}</strong>. Review that provider&apos;s retention and training policies before enabling it.</p>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <button type="button" onClick={clear} disabled={saving} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Clear AI configuration</button>
          <button type="button" onClick={save} disabled={saving} className="cursor-pointer rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save AI settings'}</button>
        </footer>
      </div>
    </main>
  );
}

function Toggle({ checked, disabled = false, onChange, label, description }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return (
    <label className={`flex gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" />
      <span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span>
    </label>
  );
}
