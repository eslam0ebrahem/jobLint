interface Props {
  totalJobs: number;
  search: string;
  onSearchChange: (value: string) => void;
}

export function DashboardHeader({ totalJobs, search, onSearchChange }: Props) {
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
      <input
        type="text"
        placeholder="Search jobs or companies..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-64 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors bg-white"
      />
    </header>
  );
}
