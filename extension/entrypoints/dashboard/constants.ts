import type { Column } from '@/src/types/job';

export interface ColumnDef {
  id: Column;
  label: string;
  dotColor: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: 'to_apply', label: 'To Apply', dotColor: 'bg-slate-500' },
  { id: 'applied', label: 'Applied', dotColor: 'bg-blue-600' },
  { id: 'assessment', label: 'Assessment', dotColor: 'bg-purple-600' },
  { id: 'interviewing', label: 'Interviewing', dotColor: 'bg-amber-500' },
  { id: 'offer', label: 'Offer', dotColor: 'bg-emerald-600' },
  { id: 'rejected', label: 'Rejected', dotColor: 'bg-red-600' },
];
