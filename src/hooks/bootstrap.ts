/**
 * App bootstrap (step 10): work that must finish before the splash hides.
 * Imported once by the root layout; registers tasks that DatabaseProvider runs after
 * migrations and seeding.
 */
import { registerStartupTask } from '@/db/DatabaseProvider';
import { applyRoutine } from '@/db/routine';
import { executionRepo } from '@/db/repositories/executions';
import { photoRepo } from '@/db/repositories/photos';
import { profileRepo } from '@/db/repositories/profile';
import { scheduleRepo } from '@/db/repositories/schedule';
import { settingsRepo } from '@/db/repositories/settings';
import { createNotificationAlarm } from '@/services/execution/alarms';
import { createRunner } from '@/services/execution/runner';
import { photoFs, photosSupported } from '@/services/photos/nativeFs';
import { hydrateWebPhotos } from '@/services/photos/webFs';
import { createPhotoStore } from '@/services/photos/storage';
import { useAppStore } from '@/store/appStore';
import { useExecutionStore } from '@/store/executionStore';
import { bindSettingsPersistence, useSettingsStore } from '@/store/settingsStore';
import { weekStart } from '@/domain/scheduling/recurrence';
import { today } from '@/utils/dates';
import { DEFAULT_UNITS } from '@/utils/units';
import { logger } from '@/utils/logger';

registerStartupTask(async (db) => {
  const settings = settingsRepo(db);
  useSettingsStore.getState().hydrate(await settings.getAll());
  bindSettingsPersistence((key, value) => settings.set(key, value));

  const profile = await profileRepo(db).get();
  useAppStore.getState().setOnboardingCompleted(!!profile?.onboardingCompletedAt);

  // Execution engine (step 17): bind the runner, then resume an active execution exactly.
  const runner = createRunner(executionRepo(db), {
    settings: () => {
      const v = useSettingsStore.getState().values;
      return { autoRest: v['training.autoStartRest'], keepAwake: v['training.keepAwake'] };
    },
    notifier: createNotificationAlarm({
      units: async () => {
        const p = await profileRepo(db).get();
        return p
          ? {
              weight: p.weightUnit,
              length: p.lengthUnit,
              distance: p.distanceUnit,
              speed: p.speedUnit,
            }
          : DEFAULT_UNITS;
      },
    }),
  });
  const store = useExecutionStore.getState();
  store.bind(runner);
  const resumed = await runner.resume();
  store.setState(resumed);
  // Time kept passing while killed: settle rest expiry / interval auto-advance now.
  if (resumed) await store.dispatch({ type: 'TICK' });
  runner.watchAppState(
    () => useExecutionStore.getState().state,
    () => void useExecutionStore.getState().dispatch({ type: 'TICK' }),
  );

  // Private photos: web preview loads its IndexedDB copies; purge the 7-day "Recently
  // deleted" window; dev-only orphan report (phone files).
  if (!photosSupported) {
    await hydrateWebPhotos().catch((e: unknown) =>
      logger.warn('Web photo storage unavailable', { error: e }),
    );
  }
  const photoStore = createPhotoStore(photoFs, photoRepo(db));
  photoStore
    .purgeExpired()
    .then(() => (__DEV__ && photosSupported ? photoStore.sweepOrphans() : null))
    .catch((e: unknown) => logger.warn('Photo maintenance failed', { error: e }));

  // The owner's routine (docs/default programs): applied once, and again whenever the
  // plan has no active rule. A fresh apply fills the whole current week (from Monday).
  let routineFrom: string | null = null;
  if (profile) {
    const applied = await applyRoutine(db, { today: today() }).catch((e: unknown) => {
      logger.error('Routine apply failed', { error: e });
      return false;
    });
    if (applied) routineFrom = weekStart(today(), 1);
  }

  // Keep 8 weeks of rule occurrences materialized (AD-09). Never blocks startup.
  await scheduleRepo(db)
    .materialize(routineFrom ?? today())
    .catch((e: unknown) => logger.warn('Materialization failed', { error: e }));
});
