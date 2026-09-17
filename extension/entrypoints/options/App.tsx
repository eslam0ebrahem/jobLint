import { useState, useEffect } from 'react';
import { fetchAiModels } from '@/src/lib/ai';

export default function App() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    browser.storage.local
      .get(['baseUrl', 'apiKey', 'model', 'models'])
      .then((res) => {
        if (res.baseUrl) setBaseUrl(res.baseUrl as string);
        if (res.apiKey) setApiKey(res.apiKey as string);
        if (res.model) setModel(res.model as string);
        if (Array.isArray(res.models)) setModels(res.models as string[]);
      });
  }, []);

  const handleFetchModels = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) return;
    setLoading(true);
    setStatus(null);

    const res = await fetchAiModels(baseUrl, apiKey);
    if (res.success && res.models.length > 0) {
      setModels(res.models);
      if (!model || !res.models.includes(model)) setModel(res.models[0] || '');
      setStatus({ ok: true, msg: `Found ${res.models.length} models` });
      await browser.storage.local.set({ models: res.models });
    } else {
      setStatus({ ok: false, msg: res.error || 'Failed to fetch models' });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    await browser.storage.local.set({
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
      model: model.trim(),
      models,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-start text-slate-800">
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h1 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          AI Settings
        </h1>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 uppercase">
            Base URL
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setStatus(null);
            }}
            placeholder="https://api.minimax.io/v1"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 uppercase">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setStatus(null);
            }}
            placeholder="sk-..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={loading || !baseUrl.trim() || !apiKey.trim()}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? 'Fetching...' : 'Fetch Models'}
          </button>

          {status && (
            <span
              className={`text-xs font-medium ${status.ok ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {status.ok ? '✓' : '✕'} {status.msg}
            </span>
          )}
        </div>

        <div className="space-y-1 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-600 uppercase">
            Model
          </label>
          {models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-white focus:outline-indigo-500 cursor-pointer"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter model name or fetch above"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-indigo-500"
            />
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
          >
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
