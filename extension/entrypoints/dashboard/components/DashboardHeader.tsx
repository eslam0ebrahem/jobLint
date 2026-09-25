import { useEffect, useRef, useState } from 'react';

interface Props {
  totalJobs: number;
  search: string;
  onSearchChange: (value: string) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onAddManual: () => void;
  onShowInsights: () => void;
  onShowDiscovery: () => void;
  onShowDiagnostics: () => void;
  discoveryCount: number;
}

export function DashboardHeader({ totalJobs, search, onSearchChange, onExportCsv, onExportJson, onImportJson, onAddManual, onShowInsights, onShowDiscovery, onShowDiagnostics, discoveryCount }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = () => setShowMenu(false);
    if (showMenu) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [showMenu]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportJson(file);
    event.target.value = '';
  };

  return (
    <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-nowrap">
      <div className="flex items-center gap-2.5"><h1 className="whitespace-nowrap text-lg font-bold text-slate-950">JobLint Kanban</h1><span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{totalJobs} jobs</span></div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <input type="search" placeholder="Search title, company, location…" value={search} onChange={(event) => onSearchChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-indigo-500 sm:w-56" />
        <button type="button" onClick={onAddManual} title="Add a job manually" className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">+ Add</button>
        <button type="button" onClick={onShowDiscovery} title="Open the discovery inbox" className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Inbox {discoveryCount > 0 && <span className="ml-1 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px]">{discoveryCount}</span>}</button>
        <button type="button" onClick={onShowInsights} title="Open search insights" className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Insights</button>
        <div className="relative">
          <button type="button" onClick={(event) => { event.stopPropagation(); setShowMenu((current) => !current); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200" aria-expanded={showMenu}>Data <span className="text-[10px] text-slate-400">▾</span></button>
          {showMenu && <div onClick={(event) => event.stopPropagation()} className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-xl">
            <MenuButton label="Export CSV" detail="Spreadsheet-ready job report" onClick={() => { onExportCsv(); setShowMenu(false); }} />
            <MenuButton label="Download full backup" detail="Jobs, events, profile, preferences" onClick={() => { onExportJson(); setShowMenu(false); }} />
            <div className="my-1 border-t border-slate-100" />
            <MenuButton label="Review and restore JSON" detail="Preview conflicts before import" onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }} />
            <MenuButton label="Detector diagnostics" detail="Check active supported tabs" onClick={() => { onShowDiagnostics(); setShowMenu(false); }} />
          </div>}
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
        </div>
        <button type="button" onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/profile.html') })} title="Candidate Profile" className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Profile</button>
        <button type="button" onClick={() => browser.runtime.openOptionsPage()} title="AI Settings" className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Settings</button>
      </div>
    </header>
  );
}

function MenuButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="w-full cursor-pointer px-3.5 py-2 text-left hover:bg-slate-50"><span className="block font-semibold text-slate-800">{label}</span><span className="block text-[10px] text-slate-400">{detail}</span></button>;
}
