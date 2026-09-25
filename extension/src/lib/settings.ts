import type { Profile, UserPreferences } from '@/src/types/job';
import { DEFAULT_PREFERENCES } from '@/src/types/job';

const PROFILE_KEY = 'profile';
const PREFERENCES_KEY = 'preferences';
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
  const value2 = value.trim();
  return value2 ? value2.slice(0, maxLength) : undefined;
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

export async function getProfile(): Promise<Profile> {
  const result = await browser.storage.local.get(PROFILE_KEY);
  return normalizeProfile(result[PROFILE_KEY]);
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const clean = normalizeProfile(profile);
  await browser.storage.local.set({ [PROFILE_KEY]: clean });
  return clean;
}

export async function clearProfile(): Promise<void> {
  await browser.storage.local.remove(PROFILE_KEY);
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
  };
}

export async function getPreferences(): Promise<UserPreferences> {
  const result = await browser.storage.local.get(PREFERENCES_KEY);
  return normalizePreferences(result[PREFERENCES_KEY]);
}

export async function savePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const value = normalizePreferences(preferences);
  await browser.storage.local.set({ [PREFERENCES_KEY]: value });
  return value;
}
