import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { type ExerciseFilter, type HistoryFilter, type TemplateFilter } from '@/db/repositories';
import { type Range } from '@/db/repositories/body';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { asLocalDate, toDate, today } from '@/utils/dates';
import { DEFAULT_UNITS, type UnitPrefs } from '@/utils/units';

import { queryKeys } from './queryKeys';
import { useRepositories } from './RepositoriesProvider';

/** Read hooks (step 10). Each subscribes to one narrow key to avoid global re-renders. */

export function useProfile() {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => r.profile.get() });
}

export function useGoals(status?: 'active' | 'paused' | 'achieved' | 'abandoned') {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.goals(status), queryFn: () => r.goals.list(status) });
}

export function useEquipment() {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.equipment, queryFn: () => r.equipment.list() });
}

export function useExercises(filter: ExerciseFilter = {}) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.exercises(filter),
    queryFn: () => r.exercises.search(filter),
  });
}

export function useExercise(id: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.exercise(id ?? ''),
    queryFn: () => r.exercises.get(id!),
    enabled: !!id,
  });
}

export function useTemplates(filter: TemplateFilter = {}) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.templates(filter),
    queryFn: () => r.templates.list(filter),
  });
}

export function useTemplate(id: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.template(id ?? ''),
    queryFn: () => r.templates.get(id!),
    enabled: !!id,
  });
}

export function useSessionsForDate(date: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.sessionsForDate(date),
    queryFn: () => r.schedule.sessionsForDate(date),
  });
}

/** Logged work per session (Plan day/month scores). */
export function useSessionWork(from: string, to: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.sessionWork(from, to),
    queryFn: () => r.schedule.workForRange(from, to),
  });
}

export function useSessionsForRange(from: string, to: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.sessionsForRange(from, to),
    queryFn: async () => {
      // Looking past the materialized window extends it first (AD-09).
      await r.schedule.ensureMaterialized(today(), to);
      return r.schedule.sessionsForRange(from, to);
    },
  });
}

export function useScheduleRules() {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.scheduleRules, queryFn: () => r.schedule.rules.list() });
}

export function useSession(id: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['sessions', 'detail', id ?? ''],
    queryFn: () => r.schedule.getSession(id!),
    enabled: !!id,
  });
}

export function useActiveExecution() {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.activeExecution, queryFn: () => r.executions.getActive() });
}

export function useExecution(id: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.execution(id ?? ''),
    queryFn: () => r.executions.get(id!),
    enabled: !!id,
  });
}

/** "Last time" hints for the exercises of a workout; cached for the session. */
export function useLastPerformance(exerciseIds: string[], excludeExecutionId: string | null) {
  const r = useRepositories();
  const ids = [...new Set(exerciseIds)].sort();
  return useQuery({
    queryKey: queryKeys.lastPerformance(ids),
    queryFn: () => r.executions.lastPerformance(ids, excludeExecutionId),
    enabled: ids.length > 0,
  });
}

/** Completed executions between two local dates (inclusive), newest first. */
export function useCompletedBetween(from: string, to: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['history', 'between', from, to],
    queryFn: () =>
      r.executions.completedBetween(
        toDate(asLocalDate(from)).toISOString(),
        toDate(asLocalDate(addDaysIso(to, 1))).toISOString(),
      ),
  });
}

export function useDoneSets(filter: { from?: string; to?: string; exerciseId?: string } = {}) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['history', 'sets', filter],
    queryFn: () =>
      r.executions.doneSets({
        ...(filter.from ? { fromIso: toDate(asLocalDate(filter.from)).toISOString() } : {}),
        ...(filter.to
          ? { toIso: toDate(asLocalDate(addDaysIso(filter.to, 1))).toISOString() }
          : {}),
        ...(filter.exerciseId ? { exerciseId: filter.exerciseId } : {}),
      }),
  });
}

export function useTemplateStats(templateId: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['history', 'template', templateId ?? ''],
    queryFn: () => r.executions.templateStats(templateId!),
    enabled: !!templateId,
  });
}

/** Finished executions between two local dates (inclusive). */
export function useFinishedBetween(from: string, to: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['history', 'finished', from, to],
    queryFn: () =>
      r.executions.finishedBetween(
        toDate(asLocalDate(from)).toISOString(),
        toDate(asLocalDate(addDaysIso(to, 1))).toISOString(),
      ),
  });
}

export function useMeasurementsBetween(from: string, to: string) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['measurements', 'between', from, to],
    queryFn: () =>
      r.measurements.between({
        from: toDate(asLocalDate(from)).toISOString(),
        to: toDate(asLocalDate(addDaysIso(to, 1))).toISOString(),
      }),
  });
}

export function useHistory(filter: HistoryFilter = {}) {
  const r = useRepositories();
  return useInfiniteQuery({
    queryKey: queryKeys.history(filter),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => r.executions.listHistory(filter, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useWeights(range: Range = {}) {
  const r = useRepositories();
  return useQuery({ queryKey: queryKeys.weights(range), queryFn: () => r.weights.list(range) });
}

export function useLatestWeights(n = 2) {
  const r = useRepositories();
  return useQuery({
    queryKey: [...queryKeys.weightsLatest, n],
    queryFn: () => r.weights.latest(n),
  });
}

export function useMeasurementTypes() {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.measurementTypes,
    queryFn: () => r.measurements.types.list(),
  });
}

export function useMeasurements(typeId: string, range: Range = {}) {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.measurements(typeId, range),
    queryFn: () => r.measurements.list(typeId, range),
  });
}

export function useLatestMeasurements() {
  const r = useRepositories();
  return useQuery({
    queryKey: queryKeys.measurementsLatest,
    queryFn: () => r.measurements.latestPerType(),
  });
}

/** Images, GIFs and video links of one exercise. */
export function useExerciseMedia(exerciseId: string | undefined) {
  const r = useRepositories();
  return useQuery({
    queryKey: ['exercises', 'media', exerciseId ?? ''],
    queryFn: () => r.exerciseMedia.list(exerciseId!),
    enabled: !!exerciseId,
  });
}

/** exerciseId → first image/GIF path (library thumbnails). */
export function useExerciseThumbs() {
  const r = useRepositories();
  return useQuery({
    queryKey: ['exercises', 'thumbs'],
    queryFn: () => r.exerciseMedia.thumbnails(),
  });
}

export function usePhotoCategories() {
  const r = useRepositories();
  return useQuery({ queryKey: ['photos', 'categories'], queryFn: () => r.photos.categories() });
}

/** Every active photo, newest first (gallery, compare). */
export function useAllPhotos() {
  const r = useRepositories();
  return useQuery({ queryKey: ['photos', 'all'], queryFn: () => r.photos.all() });
}

export function useDeletedPhotos() {
  const r = useRepositories();
  return useQuery({ queryKey: ['photos', 'deleted'], queryFn: () => r.photos.deleted() });
}

export function usePhotos(category: string) {
  const r = useRepositories();
  return useInfiniteQuery({
    queryKey: queryKeys.photos(category),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => r.photos.list(category, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Display unit preferences from the profile (metric until a profile exists). */
export function useUnitPrefs(): UnitPrefs {
  const { data } = useProfile();
  if (!data) return DEFAULT_UNITS;
  return {
    weight: data.weightUnit,
    length: data.lengthUnit,
    distance: data.distanceUnit,
    speed: data.speedUnit,
  };
}

export function useEquipmentUsage() {
  const r = useRepositories();
  return useQuery({ queryKey: ['equipment', 'usage'], queryFn: () => r.equipment.usage() });
}

/** Whole library with equipment and alternatives (in-memory search and the alternative engine). */
export function useExerciseLibrary() {
  const r = useRepositories();
  return useQuery({
    queryKey: ['exercises', 'library'],
    queryFn: () => r.exercises.listWithEquipment(),
  });
}

export function useTemplateSummaries() {
  const r = useRepositories();
  return useQuery({ queryKey: ['templates', 'summaries'], queryFn: () => r.templates.summaries() });
}
