import type {
  CompensationFacts,
  DeadlineKind,
  DetectedJob,
  EmploymentType,
  JobDeadline,
  JobFacts,
  WorkMode,
} from '@/src/types/job';
import { extractSkills } from '@/src/lib/evaluation/skills';
import { cleanString, isRecord } from './shared';

const BENEFITS = [
  'health insurance', 'dental', 'vision', 'paid time off', 'pto', 'retirement', '401(k)', 'stock options',
  'equity', 'remote work', 'hybrid', 'learning budget', 'professional development', 'parental leave',
  'flexible hours', 'wellness', 'commuter', 'bonus', 'relocation',
];
const QUALIFICATION_MARKERS = /required|qualification|must have|you have|minimum|we're looking for|we are looking for|experience|degree|bachelor|master|proficiency/i;
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function validDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? dateOnly(date) : undefined;
}

function parseDateText(value: string, reference: Date): { date: string; confidence: number } | undefined {
  const text = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const relative = text.match(/\b(?:in\s+)?(\d{1,2})\s+(day|days|week|weeks)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2] || 'day';
    const date = new Date(reference);
    date.setUTCDate(date.getUTCDate() + (unit.startsWith('week') ? amount * 7 : amount));
    return { date: dateOnly(date), confidence: 0.72 };
  }
  if (/\btoday\b/.test(text)) return { date: dateOnly(reference), confidence: 0.7 };
  if (/\btomorrow\b/.test(text)) {
    const date = new Date(reference);
    date.setUTCDate(date.getUTCDate() + 1);
    return { date: dateOnly(date), confidence: 0.74 };
  }
  const iso = text.match(/\b(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)\b/);
  if (iso) {
    const date = validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date ? { date, confidence: 0.96 } : undefined;
  }
  const slash = text.match(/\b([01]?\d)[-/]([0-3]?\d)[-/](20\d{2})\b/);
  if (slash) {
    const date = validDate(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]));
    return date ? { date, confidence: 0.9 } : undefined;
  }
  const monthFirst = text.match(/([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})/);
  const dayFirst = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\s*,?\s*(20\d{2})/);
  const monthMatch = monthFirst || dayFirst;
  if (monthMatch) {
    const monthName = monthMatch[1];
    const month = monthName ? MONTHS[monthName] : undefined;
    const dayText = monthFirst ? monthMatch[2] : monthMatch[1];
    const year = monthMatch[3];
    if (!dayText || !year) return undefined;
    const day = Number(dayText);
    const date = month === undefined ? undefined : validDate(Number(year), month, day);
    return date ? { date, confidence: 0.93 } : undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return { date: dateOnly(new Date(parsed)), confidence: 0.82 };
  return undefined;
}

function extractDeadline(text: string, reference: Date): JobDeadline | undefined {
  const match = text.match(/(?:apply\s+(?:by|before)|application\s+deadline|deadline|closes?\s+(?:on|by)|last\s+date(?:\s+to\s+apply)?)[^\n.;]{0,100}/i);
  if (!match) return undefined;
  const parsed = parseDateText(match[0], reference);
  if (!parsed) return undefined;
  const lower = match[0].toLowerCase();
  const kind: DeadlineKind = /interview|event|screening/.test(lower) ? 'event' : /posted|published/.test(lower) ? 'posting' : 'application';
  return { kind, date: parsed.date, raw: match[0].trim().slice(0, 160), confidence: parsed.confidence, source: 'description' };
}

function extractPostedAt(text: string, reference: Date): string | undefined {
  const match = text.match(/(?:posted|published|date posted|listed)\s*(?:on|:)?\s*([^\n.;]{0,80})/i);
  if (!match?.[1]) return undefined;
  return parseDateText(match[1], reference)?.date;
}

function extractEmploymentType(text: string): EmploymentType {
  if (/\b(?:intern|internship|co-?op)\b/i.test(text)) return 'internship';
  if (/\b(?:temporary|contract)\b/i.test(text)) return /contract/i.test(text) ? 'contract' : 'temporary';
  if (/\bpart[- ]time\b/i.test(text)) return 'part-time';
  if (/\bfull[- ]time\b/i.test(text)) return 'full-time';
  if (/\bvolunteer|unpaid\b/i.test(text)) return 'volunteer';
  return 'other';
}

function extractWorkMode(text: string): WorkMode {
  if (/\b(?:remote|distributed|work from home)\b/i.test(text)) return 'remote';
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\bon[- ]site|in office|onsite\b/i.test(text)) return 'on-site';
  return 'unknown';
}

function extractCompensation(rawValue: string | undefined): CompensationFacts | undefined {
  const raw = cleanString(rawValue, 1_000);
  if (!raw) return undefined;
  const currency = /£|gbp/i.test(raw) ? 'GBP' : /€|eur/i.test(raw) ? 'EUR' : /\$|usd/i.test(raw) ? 'USD' : /\b(?:cad|ca\$)\b/i.test(raw) ? 'CAD' : /\baud\b/i.test(raw) ? 'AUD' : undefined;
  const period = /\b(?:hour|hourly|hr)\b/i.test(raw) ? 'hour' : /\bday\b/i.test(raw) ? 'day' : /\bweek\b/i.test(raw) ? 'week' : /\bmonth\b/i.test(raw) ? 'month' : /\b(?:year|annum|annual)\b/i.test(raw) ? 'year' : undefined;
  const values = [...raw.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:k\b)?/gi)]
    .map((match) => Number(match[0].replace(/,/g, '').replace(/\s*k\b/i, '')) * (/\s*k\b/i.test(match[0]) ? 1_000 : 1))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 10_000_000);
  const min = values.length ? Math.min(...values) : undefined;
  const max = values.length > 1 ? Math.max(...values) : min;
  return { raw, currency, min, max, period };
}

function extractQualifications(text: string): string[] {
  return text.split(/[\n.!?]+/).map((line) => line.trim()).filter((line) => line.length >= 12 && line.length <= 280 && QUALIFICATION_MARKERS.test(line)).slice(0, 12);
}

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 30) : [];
}

function normalizeDeadline(value: unknown): JobDeadline | undefined {
  if (!isRecord(value)) return undefined;
  const date = typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : undefined;
  const raw = cleanString(value.raw, 200);
  if (!date || !raw) return undefined;
  const kind: DeadlineKind = value.kind === 'application' || value.kind === 'posting' || value.kind === 'event' ? value.kind : 'unknown';
  const source = value.source === 'description' || value.source === 'title' || value.source === 'url' || value.source === 'manual' ? value.source : 'description';
  return { kind, date, raw, confidence: Math.min(1, Math.max(0, Number(value.confidence) || 0.5)), source };
}

function normalizeCompensation(value: unknown): CompensationFacts | undefined {
  if (!isRecord(value)) return undefined;
  const raw = cleanString(value.raw, 1_000);
  if (!raw) return undefined;
  const period = value.period === 'hour' || value.period === 'day' || value.period === 'week' || value.period === 'month' || value.period === 'year' ? value.period : undefined;
  const number = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0 ? item : undefined;
  return { raw, currency: cleanString(value.currency, 10), min: number(value.min), max: number(value.max), period };
}

export function extractJobFacts(job: Pick<DetectedJob, 'title' | 'company' | 'location' | 'salary' | 'description' | 'requirements' | 'jobUrl'>, extractedAt = new Date().toISOString()): JobFacts {
  const text = [job.title, job.company, job.location, job.salary, job.description, job.requirements].filter(Boolean).join('\n');
  const reference = new Date(extractedAt);
  const evidence: string[] = [];
  if (job.description || job.requirements) evidence.push('description');
  if (job.salary) evidence.push('compensation');
  if (job.location) evidence.push('location');
  if (job.title) evidence.push('title');
  if (job.jobUrl) evidence.push('url');
  return {
    version: 1,
    employmentType: extractEmploymentType(text),
    workMode: extractWorkMode(text),
    seniority: /\b(?:intern|junior|entry|mid|intermediate|senior|lead|principal|staff)\b/i.exec(job.title)?.[0]?.toLowerCase(),
    skills: extractSkills(text).slice(0, 30),
    benefits: BENEFITS.filter((benefit) => text.toLowerCase().includes(benefit)).slice(0, 15),
    qualifications: extractQualifications(text),
    compensation: extractCompensation(job.salary),
    deadline: extractDeadline(text, reference),
    postedAt: extractPostedAt(text, reference),
    extractedAt,
    evidence,
  };
}

export function normalizeJobFacts(value: unknown, job: Pick<DetectedJob, 'title' | 'company' | 'location' | 'salary' | 'description' | 'requirements' | 'jobUrl'>, extractedAt = new Date().toISOString()): JobFacts {
  const extracted = extractJobFacts(job, extractedAt);
  const input = isRecord(value) ? value : {};
  const inputEmploymentType = input.employmentType === 'full-time' || input.employmentType === 'part-time' || input.employmentType === 'contract' || input.employmentType === 'temporary' || input.employmentType === 'internship' || input.employmentType === 'volunteer' || input.employmentType === 'other' ? input.employmentType : undefined;
  const inputWorkMode = input.workMode === 'remote' || input.workMode === 'hybrid' || input.workMode === 'on-site' || input.workMode === 'unknown' ? input.workMode : undefined;
  const inputSkills = normalizeArray(input.skills);
  const inputBenefits = normalizeArray(input.benefits);
  const inputQualifications = normalizeArray(input.qualifications);
  return {
    version: 1,
    employmentType: extracted.employmentType !== 'other' ? extracted.employmentType : inputEmploymentType || extracted.employmentType,
    workMode: extracted.workMode !== 'unknown' ? extracted.workMode : inputWorkMode || extracted.workMode,
    seniority: extracted.seniority || cleanString(input.seniority, 100),
    skills: extracted.skills.length ? extracted.skills : inputSkills,
    benefits: extracted.benefits.length ? extracted.benefits : inputBenefits,
    qualifications: extracted.qualifications.length ? extracted.qualifications : inputQualifications,
    compensation: extracted.compensation || normalizeCompensation(input.compensation),
    deadline: extracted.deadline || normalizeDeadline(input.deadline),
    postedAt: extracted.postedAt || (typeof input.postedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.postedAt) ? input.postedAt : undefined),
    extractedAt,
    evidence: extracted.evidence.length ? extracted.evidence : normalizeArray(input.evidence),
  };
}
