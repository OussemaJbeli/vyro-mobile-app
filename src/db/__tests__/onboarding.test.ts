import { type OnboardingDraft } from '@/types/onboarding';

import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { commitOnboarding } from '../onboarding';
import { createRepositories } from '../repositories';
import { seedId } from '../seed/ids';
import { seedDatabase } from '../seed/seed';
import { openNodeDriver } from '../testing/nodeDriver';

const base: OnboardingDraft = {
  mode: 'first',
  step: 'done',
  name: 'Alex',
  units: { weight: 'kg', length: 'cm', distance: 'km', speed: 'kmh' },
  heightCm: 180,
  weightKg: 74.6,
  goal: { kind: 'lose_weight', targetWeightKg: 70, sessionsPerWeek: null, customTitle: null },
  equipmentPreset: 'full_gym',
  equipmentIds: null,
  trainingDays: [1, 3, 5],
  trainingTime: '18:00',
  acceptPlan: true,
  notifications: true,
  appLock: false,
};

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
});
afterEach(() => db.driver.close());

describe('commitOnboarding', () => {
  it('redo replaces the weekly plan and skips an unchanged weigh-in', async () => {
    const r = createRepositories(db);
    await commitOnboarding(db, base, { today: '2026-09-24', goalTitle: 'Lose weight' });
    expect(await r.schedule.rules.list()).toHaveLength(4);
    await commitOnboarding(
      db,
      { ...base, mode: 'redo', trainingDays: [2, 4], goal: null },
      { today: '2026-09-25', goalTitle: '' },
    );
    const rules = await r.schedule.rules.list();
    expect(rules).toHaveLength(3); // 2 templates + rest, old ones replaced
    expect(rules.every((x) => x.startDate === '2026-09-25')).toBe(true);
    expect(await r.weights.latest(5)).toHaveLength(1); // same 74.6 kg: no duplicate
    expect(await r.goals.list()).toHaveLength(1); // original goal kept, none added
  });

  it('saves a full run: profile, weigh-in, goal, equipment, weekly rules and preferences', async () => {
    const r = createRepositories(db);
    await r.settings.set('onboarding.draft', base);
    const ids = [seedId.equipment('dumbbells'), seedId.equipment('flat_bench')];
    const result = await commitOnboarding(
      db,
      { ...base, equipmentPreset: 'home_dumbbells', equipmentIds: ids },
      { today: '2026-09-24', goalTitle: 'Lose weight' },
    );

    expect(await r.profile.get()).toMatchObject({
      name: 'Alex',
      heightCm: 180,
      weightUnit: 'kg',
      onboardingCompletedAt: expect.any(String),
    });
    expect((await r.weights.latest())[0]).toMatchObject({ valueKg: 74.6, unitEntered: 'kg' });
    expect(await r.goals.list()).toEqual([
      expect.objectContaining({
        type: 'weight',
        title: 'Lose weight',
        targetValue: 70,
        startValue: 74.6,
      }),
    ]);
    expect(
      (await r.equipment.list())
        .filter((e) => e.available)
        .map((e) => e.id)
        .sort(),
    ).toEqual(ids.sort());

    // Lose weight, 3 days, home: home_workout, interval run, abs + one rest rule.
    const rules = await r.schedule.rules.list();
    expect(result.rules).toBe(4);
    expect(rules.map((x) => [x.type, x.byWeekday, x.startTime]).sort()).toEqual(
      [
        ['abs', [5], '18:00'],
        ['home', [1], '18:00'],
        ['rest', [2, 4, 6, 7], null],
        ['running', [3], '18:00'],
      ].sort(),
    );
    expect(
      rules.every(
        (x) => x.freq === 'weekly' && x.materializedUntil === null && x.startDate === '2026-09-24',
      ),
    ).toBe(true);

    expect(await r.settings.get('notifications.enabled')).toBe(true);
    expect(await r.settings.get('lock.enabled')).toBe(false);
    expect(await r.settings.get('onboarding.draft')).toBeNull();
  });

  it('handles a skipped setup: profile only, no goal, weigh-in or plan', async () => {
    const r = createRepositories(db);
    const result = await commitOnboarding(
      db,
      { ...base, name: null, heightCm: null, weightKg: null, goal: null, acceptPlan: false },
      { today: '2026-09-24', goalTitle: '' },
    );
    expect(result).toEqual({ rules: 0, plan: null });
    expect((await r.profile.get())?.onboardingCompletedAt).toBeTruthy();
    expect(await r.goals.list()).toEqual([]);
    expect(await r.weights.latest()).toEqual([]);
    expect(await r.schedule.rules.list()).toEqual([]);
    expect((await r.equipment.list()).every((e) => e.available)).toBe(true); // untouched
  });

  it('writes nothing when any part fails', async () => {
    const r = createRepositories(db);
    const broken = { ...base, weightKg: 900 }; // violates the weight CHECK / schema
    await expect(
      commitOnboarding(db, broken, { today: '2026-09-24', goalTitle: 'x' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(await r.profile.get()).toBeNull();
    expect(await r.schedule.rules.list()).toEqual([]);
  });
});
