import type { Profile, UserPreferences } from '@/src/types/job';
import { normalizePreferences, normalizeProfile } from '@/src/domain/settings';

export interface SettingsRepository {
  readProfile(): Promise<unknown>;
  writeProfile(profile: Profile): Promise<void>;
  deleteProfile(): Promise<void>;
  readPreferences(): Promise<unknown>;
  writePreferences(preferences: UserPreferences): Promise<void>;
}

export interface SettingsEvents {
  onProfileChanged?(): void;
  onPreferencesChanged?(): void;
}

export interface SaveSettingsOptions {
  notify?: boolean;
}

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly events: SettingsEvents = {},
  ) {}

  async getProfile(): Promise<Profile> {
    return normalizeProfile(await this.repository.readProfile());
  }

  async saveProfile(profile: Profile, options: SaveSettingsOptions = {}): Promise<Profile> {
    const normalized = normalizeProfile(profile);
    await this.repository.writeProfile(normalized);
    if (options.notify !== false) this.events.onProfileChanged?.();
    return normalized;
  }

  async clearProfile(): Promise<void> {
    await this.repository.deleteProfile();
    this.events.onProfileChanged?.();
  }

  async getPreferences(): Promise<UserPreferences> {
    return normalizePreferences(await this.repository.readPreferences());
  }

  async savePreferences(preferences: UserPreferences, options: SaveSettingsOptions = {}): Promise<UserPreferences> {
    const normalized = normalizePreferences(preferences);
    await this.repository.writePreferences(normalized);
    if (options.notify !== false) this.events.onPreferencesChanged?.();
    return normalized;
  }
}
