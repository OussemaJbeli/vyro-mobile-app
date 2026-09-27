import {
  defaultSettings,
  settingsRegistry,
  type SettingKey,
  type Settings,
  type SettingValue,
} from '@/types/settings';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { type Db } from '../client';

import { nowIso } from './base';

function parse<K extends SettingKey>(key: K, raw: string): SettingValue<K> | undefined {
  try {
    const result = settingsRegistry[key].schema.safeParse(JSON.parse(raw));
    if (result.success) return result.data as SettingValue<K>;
  } catch {
    // fall through
  }
  logger.warn('Ignoring invalid stored setting', { key });
  return undefined;
}

/** Typed key/value settings (JSON in app_settings). Unknown or invalid values fall back to defaults. */
export function settingsRepo(db: Db) {
  return {
    async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
      const row = await db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [
        key,
      ]);
      return (row && parse(key, row.value)) ?? (defaultSettings[key] as SettingValue<K>);
    },
    async getAll(): Promise<Settings> {
      const rows = await db.all<{ key: string; value: string }>(
        'SELECT key, value FROM app_settings',
      );
      const out: Record<string, unknown> = { ...defaultSettings };
      for (const { key, value } of rows) {
        if (key in settingsRegistry) {
          const v = parse(key as SettingKey, value);
          if (v !== undefined) out[key] = v;
        }
      }
      return out as Settings;
    },
    async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
      const checked = settingsRegistry[key].schema.safeParse(value);
      if (!checked.success) throw new AppError('VALIDATION', `Invalid value for setting ${key}`);
      await db.run(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [key, JSON.stringify(checked.data), nowIso()],
      );
    },
  };
}
