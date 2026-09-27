/**
 * Forward migration of older backup files (step 27). Each upgrader turns format N into
 * N + 1; files from a newer app are refused. The checksum is re-computed by the importer
 * over the upgraded data only after validating the original.
 */
export type RawBackup = Record<string, unknown> & { formatVersion?: number };

export const UPGRADERS: Record<number, (b: RawBackup) => RawBackup> = {
  // Format 0 (pre-release test builds) stored weigh-ins under "weights" and had no counts.
  0: (b) => {
    const data = { ...(b.data as Record<string, unknown>) };
    if ('weights' in data) {
      data.weight_entries = data.weights;
      delete data.weights;
    }
    return { ...b, data, formatVersion: 1 };
  },
};

export function upgrade(raw: RawBackup, target: number): RawBackup {
  let b = raw;
  for (let v = b.formatVersion ?? 0; v < target; v++) {
    const step = UPGRADERS[v];
    if (!step) throw new Error(`No upgrader from format ${v}`);
    b = step(b);
  }
  return b;
}
