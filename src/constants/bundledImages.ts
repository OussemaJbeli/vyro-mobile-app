/**
 * Images dropped into assets/images/{workouts,exercises,equipment,execution}/ show up by name,
 * with no code change: `<cover_key>.webp` (workouts) and `<slug>.webp` (exercises,
 * equipment); .png and .jpg work too. Metro watches the folders (`require.context`), so a
 * new file appears on the next reload. A picture chosen in the app always wins.
 */
type Folder = 'workouts' | 'exercises' | 'equipment' | 'execution';

type Context = { keys(): string[]; (id: string): unknown };

function index(ctx: Context | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!ctx) return out;
  for (const key of ctx.keys()) {
    const name = /([^/]+)\.(webp|png|jpe?g|mp4)$/i.exec(key)?.[1];
    // First match wins, so a .webp next to an older .png is preferred only if listed first.
    if (name && !(name in out)) out[name] = ctx(key) as number;
  }
  return out;
}

// `require.context` is Metro-only; Jest has no bundle, so tests see empty folders.
const hasContext = typeof require.context === 'function';

const images: Record<Folder, Record<string, number>> = {
  workouts: index(
    hasContext
      ? require.context('../../assets/images/workouts', false, /\.(webp|png|jpe?g)$/)
      : null,
  ),
  exercises: index(
    hasContext
      ? require.context('../../assets/images/exercises', false, /\.(webp|png|jpe?g)$/)
      : null,
  ),
  execution: index(
    hasContext
      ? require.context('../../assets/images/execution', false, /\.(webp|png|jpe?g)$/)
      : null,
  ),
  equipment: index(
    hasContext
      ? require.context('../../assets/images/equipment', false, /\.(webp|png|jpe?g)$/)
      : null,
  ),
};

const videos: Record<string, number> = index(
  hasContext ? require.context('../../assets/videos/exercises', false, /\.mp4$/) : null,
);

/** Bundled looping video for an exercise slug (assets/videos/exercises/<slug>.mp4). */
export const bundledVideo = (slug: string | null | undefined): number | null =>
  (slug && videos[slug]) || null;

/** Bundled image for a workout cover key or an exercise/equipment slug, if one exists. */
export const bundledImage = (folder: Folder, name: string | null | undefined): number | null =>
  (name && images[folder][name]) || null;
