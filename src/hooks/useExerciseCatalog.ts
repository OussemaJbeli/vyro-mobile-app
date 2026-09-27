import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isAvailable, type EngineContext } from '@/domain/workouts/alternatives';
import { type Equipment } from '@/types/domain';
import { displayName } from '@/utils/seedNames';

import { useEquipment, useExerciseLibrary } from './data';

type LibraryItem = NonNullable<ReturnType<typeof useExerciseLibrary>['data']>[number];

export type CatalogExercise = LibraryItem & {
  label: string;
  available: boolean;
  equipment: Equipment[];
  /** "Barbell, Flat bench" or "Bodyweight". */
  equipmentLabel: string;
};

/**
 * Library + equipment + translated names in one place (step 13), plus the context the
 * alternative engine needs. Everything is computed in memory: the library is small.
 */
export function useExerciseCatalog() {
  const { t } = useTranslation(['exercises', 'seed']);
  const library = useExerciseLibrary();
  const equipment = useEquipment();

  return useMemo(() => {
    const eq = equipment.data ?? [];
    const eqById = new Map(eq.map((e) => [e.id, e]));
    const available = new Set(eq.filter((e) => e.available).map((e) => e.id));
    const tr = (k: string, o?: { defaultValue?: string }) =>
      t(k as 'exercises:title', { defaultValue: o?.defaultValue ?? k });
    const items: CatalogExercise[] = (library.data ?? []).map((x) => {
      const req = x.equipmentIds.map((id) => eqById.get(id)).filter((e): e is Equipment => !!e);
      return {
        ...x,
        label: displayName('exercise', x, tr),
        available: isAvailable(x, available),
        equipment: req,
        equipmentLabel: req.length
          ? req.map((e) => displayName('equipment', e, tr)).join(', ')
          : t('bodyweight'),
      };
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    const engine: EngineContext = {
      available,
      library: items,
      mappings: items.flatMap((i) => i.alternatives),
    };
    return {
      items,
      byId,
      engine,
      isLoading: library.isLoading || equipment.isLoading,
    };
  }, [library.data, library.isLoading, equipment.data, equipment.isLoading, t]);
}

/** Case- and accent-insensitive match on the translated and stored names. */
export function matchesQuery(item: { label: string; name: string }, query: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const q = norm(query.trim());
  return !q || norm(item.label).includes(q) || norm(item.name).includes(q);
}
