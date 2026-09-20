import { useState, useEffect, useRef } from 'react';

interface Props {
  totalJobs: number;
  search: string;
  onSearchChange: (value: string) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

export function DashboardHeader({
  totalJobs,
  search,
  onSearchChange,
  onExportCsv,
  onExportJson,
  onImportJson,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = () => setShowMenu(false);
    if (showMenu) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [showMenu]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  const openProfile = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/profile.html') });
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
  };

  return (
    <header className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 mb-4 bg-white px-4 py-3 rounded-xl shadow-xs border border-slate-200 shrink-0">
      <div className="flex items-center gap-2.5">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 m-0 whitespace-nowrap">
          JobLint Kanban
        </h1>
        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
          {totalJobs} jobs
        </span>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          type="text"
          placeholder="Search jobs or companies..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 transition-colors bg-white"
        />

        {/* Data Backup & Export Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            title="Data Backup & Export"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>💾</span>
            <span className="hidden sm:inline">Data</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs text-slate-700 font-sans"
            >
              <button
                onClick={() => {
                  onExportCsv();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span className="text-sm">📊</span>
                <div>
                  <div className="font-semibold text-slate-800">Export to CSV</div>
                  <div className="text-[10px] text-slate-400">For Excel, Google Sheets</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportJson();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span className="text-sm">📦</span>
                <div>
                  <div className="font-semibold text-slate-800">Backup all (JSON)</div>
                  <div className="text-[10px] text-slate-400">Full backup with notes</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors text-indigo-700"
              >
                <span className="text-sm">📥</span>
                <div>
                  <div className="font-semibold">Restore from JSON</div>
                  <div className="text-[10px] text-slate-400">Import backup records</div>
                </div>
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <button
          onClick={openProfile}
          title="Candidate Profile"
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>👤</span>
          <span className="hidden sm:inline">Profile</span>
        </button>
        <button
          onClick={openOptions}
          title="AI Settings"
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>⚙️</span>
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
