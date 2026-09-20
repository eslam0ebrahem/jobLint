import type { Job, NewJob } from '@/src/types/job';
import { saveJob } from './db';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJobsToCsv(jobs: Job[]) {
  const headers = [
    'Title',
    'Company',
    'Stage',
    'Location',
    'Salary',
    'Match Score',
    'Verdict',
    'Archetype',
    'Seniority',
    'Remote',
    'Matched Skills',
    'Skill Gaps',
    'Notes',
    'Job URL',
    'Apply URL',
    'Clipped Date',
  ];

  const rows = jobs.map((j) => [
    escapeCsv(j.title),
    escapeCsv(j.company),
    escapeCsv(j.column || 'to_apply'),
    escapeCsv(j.location || ''),
    escapeCsv(j.salary || ''),
    escapeCsv(j.evaluation?.score ?? ''),
    escapeCsv(j.evaluation?.verdict ?? ''),
    escapeCsv(j.evaluation?.archetype ?? ''),
    escapeCsv(j.evaluation?.seniority ?? ''),
    escapeCsv(j.evaluation?.remote ?? ''),
    escapeCsv((j.evaluation?.matchedSkills || []).join(', ')),
    escapeCsv((j.evaluation?.missingSkills || []).join(', ')),
    escapeCsv(j.notes || ''),
    escapeCsv(j.jobUrl || ''),
    escapeCsv(j.applyUrl || ''),
    escapeCsv(j.clippedAt || ''),
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const date = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `joblint-jobs-${date}.csv`, 'text/csv;charset=utf-8;');
}

export function exportJobsToJson(jobs: Job[]) {
  const date = new Date().toISOString().slice(0, 10);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: jobs.length,
    jobs,
  };
  downloadFile(
    JSON.stringify(payload, null, 2),
    `joblint-backup-${date}.json`,
    'application/json',
  );
}

export async function importJobsFromJson(file: File): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const list: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.jobs)
        ? data.jobs
        : [];

    if (!list.length) {
      return { success: false, count: 0, error: 'No valid job records found in file' };
    }

    let count = 0;
    for (const item of list) {
      if (item && typeof item === 'object' && 'title' in item && 'company' in item) {
        const candidate = item as Partial<Job> & NewJob;
        await saveJob({
          ...candidate,
          status: candidate.status || 'active',
          column: candidate.column || 'to_apply',
        });
        count++;
      }
    }

    return { success: true, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON file';
    return { success: false, count: 0, error: msg };
  }
}
