import type { Job } from '@/src/types/job';
import type { BackupPayload } from './messages';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Prevent spreadsheet applications from interpreting exported job fields as formulas.
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportJobsToCsv(jobs: Job[]): void {
  const headers = [
    'Title', 'Company', 'Stage', 'Location', 'Salary', 'Overall Score', 'Fit', 'Opportunity', 'Safety',
    'Risk', 'Confidence', 'Verdict', 'Archetype', 'Seniority', 'Remote', 'Matched Skills', 'Skill Gaps',
    'Red Flags', 'Outcome', 'Notes', 'Job URL', 'Apply URL', 'Clipped Date',
  ];
  const rows = jobs.map((job) => [
    job.title,
    job.company,
    job.column || 'to_apply',
    job.location || '',
    job.salary || '',
    job.evaluation?.score ?? '',
    job.evaluation?.fitScore ?? '',
    job.evaluation?.opportunityScore ?? '',
    job.evaluation?.safetyScore ?? '',
    job.evaluation?.riskLevel ?? '',
    job.evaluation?.confidence ?? '',
    job.evaluation?.verdict ?? '',
    job.evaluation?.archetype ?? '',
    job.evaluation?.seniority ?? '',
    job.evaluation?.remote ?? '',
    (job.evaluation?.matchedSkills || []).join(', '),
    (job.evaluation?.missingSkills || []).join(', '),
    (job.evaluation?.redFlags || []).join(', '),
    job.outcome || '',
    job.notes || '',
    job.jobUrl || '',
    job.applyUrl || '',
    job.clippedAt || '',
  ].map(escapeCsv));
  const csv = `\uFEFF${[headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')}`;
  downloadTextFile(csv, `joblint-jobs-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

export function exportBackupToJson(payload: BackupPayload): void {
  downloadTextFile(
    JSON.stringify(payload, null, 2),
    `joblint-backup-${payload.exportedAt.slice(0, 10)}.json`,
    'application/json',
  );
}

export async function readBackupFile(file: File): Promise<unknown> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Backup files must be smaller than 25 MB.');
  try {
    return JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
}
