import type { Profile, UserPreferences } from '@/src/types/job';
import type { PolicyConstraints } from '@/src/types/policy';
import { normalizePreferences, normalizeProfile } from '@/src/domain/settings';
import { normalizePolicyConstraints } from '@/src/domain/policy';

const PROFILE_KEY = 'profile';
const PREFERENCES_KEY = 'preferences';
const POLICY_CONSTRAINTS_KEY = 'policyConstraints';

export const browserSettingsRepository = {
  async readProfile(): Promise<unknown> {
    const result = await browser.storage.local.get(PROFILE_KEY);
    return result[PROFILE_KEY];
  },
  async writeProfile(profile: Profile): Promise<void> {
    await browser.storage.local.set({ [PROFILE_KEY]: profile });
  },
  async deleteProfile(): Promise<void> {
    await browser.storage.local.remove(PROFILE_KEY);
  },
  async readPreferences(): Promise<unknown> {
    const result = await browser.storage.local.get(PREFERENCES_KEY);
    return result[PREFERENCES_KEY];
  },
  async writePreferences(preferences: UserPreferences): Promise<void> {
    await browser.storage.local.set({ [PREFERENCES_KEY]: preferences });
  },
  async readPolicyConstraints(): Promise<unknown> {
    const result = await browser.storage.local.get(POLICY_CONSTRAINTS_KEY);
    return result[POLICY_CONSTRAINTS_KEY];
  },
  async writePolicyConstraints(constraints: PolicyConstraints): Promise<void> {
    await browser.storage.local.set({ [POLICY_CONSTRAINTS_KEY]: constraints });
  },
};

export async function getProfile(): Promise<Profile> {
  return normalizeProfile(await browserSettingsRepository.readProfile());
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const normalized = normalizeProfile(profile);
  await browserSettingsRepository.writeProfile(normalized);
  return normalized;
}

export async function clearProfile(): Promise<void> {
  await browserSettingsRepository.deleteProfile();
}

export async function getPreferences(): Promise<UserPreferences> {
  return normalizePreferences(await browserSettingsRepository.readPreferences());
}

export async function savePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const normalized = normalizePreferences(preferences);
  await browserSettingsRepository.writePreferences(normalized);
  return normalized;
}

export async function getPolicyConstraints(): Promise<PolicyConstraints> {
  return normalizePolicyConstraints(await browserSettingsRepository.readPolicyConstraints());
}

export async function savePolicyConstraints(constraints: PolicyConstraints): Promise<PolicyConstraints> {
  const normalized = normalizePolicyConstraints(constraints);
  await browserSettingsRepository.writePolicyConstraints(normalized);
  return normalized;
}
