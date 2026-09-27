import { type UserProfile } from '@/types/domain';

import { type Db } from '../client';
import { tables } from '../mappers';

import { findMany, insertModel, nowIso, patchModel, type NewModel } from './base';

const spec = tables.userProfile;

export type ProfileInput = Partial<NewModel<typeof spec>>;

const DEFAULTS: NewModel<typeof spec> = {
  name: null,
  heightCm: null,
  dateOfBirth: null,
  weightUnit: 'kg',
  lengthUnit: 'cm',
  distanceUnit: 'km',
  speedUnit: 'kmh',
  weekStartsOn: 1,
  onboardingCompletedAt: null,
};

/** Single local user (FS §8): at most one active profile row. */
export function profileRepo(db: Db) {
  const get = async (): Promise<UserProfile | null> =>
    (await findMany(db, spec, 'deleted_at IS NULL', [], 'ORDER BY created_at LIMIT 1'))[0] ?? null;

  return {
    get,
    async upsert(input: ProfileInput): Promise<UserProfile> {
      const existing = await get();
      if (!existing) return insertModel(db, spec, { ...DEFAULTS, ...input });
      await patchModel(db, spec, existing.id, input);
      return (await get())!;
    },
    async completeOnboarding(): Promise<UserProfile> {
      const existing = await get();
      const at = nowIso();
      if (!existing) return insertModel(db, spec, { ...DEFAULTS, onboardingCompletedAt: at });
      await patchModel(db, spec, existing.id, { onboardingCompletedAt: at });
      return (await get())!;
    },
  };
}
