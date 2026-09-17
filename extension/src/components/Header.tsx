interface Props {
  count: number;
}

export function Header({ count }: Props) {
  const openDashboard = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
  };

  const openProfile = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/profile.html') });
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
  };

  return (
    <header className="flex justify-between items-center pb-2 border-b border-slate-200 mb-2">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold text-slate-900 m-0">JobLint</h1>
        <span className="bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-full">
          {count} saved
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={openProfile}
          title="Candidate Profile"
          className="p-1 border border-slate-300 rounded hover:bg-slate-100 text-xs transition-colors cursor-pointer"
        >
          👤
        </button>
        <button
          onClick={openOptions}
          title="AI Settings"
          className="p-1 border border-slate-300 rounded hover:bg-slate-100 text-xs transition-colors cursor-pointer"
        >
          ⚙️
        </button>
        <button
          onClick={openDashboard}
          title="Open Dashboard"
          className="p-1 border border-slate-300 rounded hover:bg-slate-100 text-xs transition-colors cursor-pointer"
        >
          📊
        </button>
      </div>
    </header>
  );
}
