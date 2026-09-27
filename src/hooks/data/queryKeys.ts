/**
 * Central query keys (step 10). The first segment is the invalidation root:
 * invalidating ['sessions'] refreshes every sessions query.
 */
export const queryKeys = {
  profile: ['profile'] as const,
  settings: ['settings'] as const,
  goals: (status?: string) => ['goals', status ?? 'all'] as const,
  equipment: ['equipment'] as const,
  exercises: (filter: object = {}) => ['exercises', filter] as const,
  exercise: (id: string) => ['exercises', 'detail', id] as const,
  templates: (filter: object = {}) => ['templates', filter] as const,
  template: (id: string) => ['templates', 'detail', id] as const,
  sessionsForDate: (date: string) => ['sessions', 'date', date] as const,
  sessionsForRange: (from: string, to: string) => ['sessions', 'range', from, to] as const,
  sessionWork: (from: string, to: string) => ['sessions', 'work', from, to] as const,
  scheduleRules: ['sessions', 'rules'] as const,
  activeExecution: ['execution', 'active'] as const,
  execution: (id: string) => ['execution', id] as const,
  lastPerformance: (ids: string[]) => ['history', 'last', ...ids] as const,
  history: (filter: object = {}) => ['history', filter] as const,
  weights: (range: object = {}) => ['weights', range] as const,
  weightsLatest: ['weights', 'latest'] as const,
  measurementTypes: ['measurements', 'types'] as const,
  measurements: (typeId: string, range: object = {}) => ['measurements', typeId, range] as const,
  measurementsLatest: ['measurements', 'latest'] as const,
  photos: (category: string) => ['photos', category] as const,
};

/**
 * Cross-aggregate invalidation (documented contract). A mutation in one area refreshes
 * every screen that derives from it. `analytics`, `streak` and `home` roots are used by
 * steps 21 and 24.
 */
export const invalidates = {
  profile: [['profile']],
  settings: [['settings']],
  goals: [['goals'], ['home']],
  equipment: [['equipment'], ['exercises'], ['templates']],
  exercises: [['exercises'], ['templates']],
  templates: [['templates'], ['sessions']],
  schedule: [['sessions'], ['home'], ['analytics'], ['streak']],
  executionProgress: [['execution']],
  executionFinished: [
    ['execution'],
    ['sessions'],
    ['history'],
    ['analytics'],
    ['streak'],
    ['home'],
  ],
  weights: [['weights'], ['home'], ['goals'], ['analytics']],
  measurements: [['measurements'], ['goals'], ['analytics']],
  photos: [['photos'], ['history']],
} as const satisfies Record<string, readonly (readonly string[])[]>;
