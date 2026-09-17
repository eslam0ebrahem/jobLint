import { useState, useEffect } from 'react';

const FIELDS = [
  { key: 'name', label: 'Full Name', ph: 'Eslam Abdelgalil' },
  { key: 'email', label: 'Email', ph: 'name@example.com' },
  { key: 'phone', label: 'Phone', ph: '+34 744 76 3716' },
  { key: 'location', label: 'Location', ph: 'Alicante, Spain' },
  { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/in/username' },
  { key: 'github', label: 'GitHub', ph: 'https://github.com/username' },
  { key: 'roles', label: 'Target Roles', ph: 'Backend Developer, Software Engineer' },
  { key: 'skills', label: 'Skills & Tech Stack', ph: 'Node.js, Express, MongoDB, TypeScript, React' },
  { key: 'salary', label: 'Target Salary', ph: '€20K - €60K' },
  { key: 'visa', label: 'Work Authorization', ph: 'Work Permit / Citizen / Sponsorship' },
] as const;

export default function App() {
  const [data, setData] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    browser.storage.local.get('profile').then((res) => {
      if (res.profile) setData(res.profile as Record<string, string>);
    });
  }, []);

  const handleSave = async () => {
    await browser.storage.local.set({ profile: data });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = async () => {
    setData({});
    await browser.storage.local.remove('profile');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-start text-slate-800 font-sans">
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h1 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Profile Settings
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, ph }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase">{label}</label>
              <input
                type="text"
                value={data[key] || ''}
                onChange={(e) => setData((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={ph}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-indigo-500"
              />
            </div>
          ))}
        </div>

        <div className="space-y-1 pt-1">
          <label className="text-xs font-semibold text-slate-600 uppercase">Bio / Summary</label>
          <textarea
            rows={3}
            value={data.summary || ''}
            onChange={(e) => setData((prev) => ({ ...prev, summary: e.target.value }))}
            placeholder="Brief summary of your experience and career goals..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-500 resize-y"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
          >
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
