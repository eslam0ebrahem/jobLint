import type { Profile, UserPreferences } from '@/src/types/job';
import { DEFAULT_PREFERENCES } from '@/src/types/job';

const PROFILE_FIELDS: (keyof Profile)[] = [
  'name',
  'email',
  'phone',
  'location',
  'linkedin',
  'github',
  'roles',
  'skills',
  'salary',
  'visa',
  'summary',
];

function cleanText(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function normalizeProfile(value: unknown): Profile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: Profile = {};
  for (const key of PROFILE_FIELDS) {
    const item = cleanText(input[key], key === 'summary' ? 4_000 : 1_000);
    if (item) output[key] = item;
  }
  return output;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizePreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_PREFERENCES };
  const input = value as Record<string, unknown>;
  const riskTolerance = input.riskTolerance === 'cautious' || input.riskTolerance === 'opportunistic'
    ? input.riskTolerance
    : 'balanced';
  return {
    autoEnhanceWithAi: input.autoEnhanceWithAi === true,
    prioritizeFit: boundedNumber(input.prioritizeFit, DEFAULT_PREFERENCES.prioritizeFit, 0, 1),
    prioritizeOpportunity: boundedNumber(input.prioritizeOpportunity, DEFAULT_PREFERENCES.prioritizeOpportunity, 0, 1),
    riskTolerance,
    remindersEnabled: input.remindersEnabled === true,
    reminderLeadDays: boundedNumber(input.reminderLeadDays, DEFAULT_PREFERENCES.reminderLeadDays || 3, 0, 30),
  };
}

export function isProfileFilled(profile?: Profile | null): boolean {
  return Boolean(profile?.roles?.trim() && profile?.skills?.trim());
}

export function getProfileMissingNotice(profile?: Profile | null): string | null {
  if (!profile || (!profile.roles?.trim() && !profile.skills?.trim())) {
    return 'Please complete your Profile (Target Roles & Skills) before evaluating jobs.';
  }
  if (!profile.roles?.trim()) return 'Please set your Target Roles in Profile before evaluating jobs.';
  if (!profile.skills?.trim()) return 'Please set your Skills & Tech Stack in Profile before evaluating jobs.';
  return null;
}
