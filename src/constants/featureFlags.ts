/** Compile-time feature flags. AI module available (step 31); users opt in via the "ai.enabled" setting. */
export const featureFlags = {
  ai: true,
  devTools: __DEV__,
  /** Home quick actions light up when their screens land (steps 22–23). */
  weightLog: true,
  measurements: true,
  photos: true,
} as const;
