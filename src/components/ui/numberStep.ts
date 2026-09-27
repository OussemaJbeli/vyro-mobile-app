/** Pure helpers for NumberStepper (unit-tested). */
export type StepBounds = { min?: number; max?: number; step: number; decimals?: number };

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function clampValue(value: number, { min, max }: StepBounds): number {
  let v = value;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}

/** Adds `delta` steps, snapping to the step grid so float drift (0.1 + 0.2) never shows. */
export function stepValue(value: number, delta: number, bounds: StepBounds): number {
  const decimals = bounds.decimals ?? decimalsOf(bounds.step);
  const next = roundTo(value + delta * bounds.step, decimals);
  return clampValue(next, bounds);
}

/** Parses typed text (accepts "," or "." as decimal separator). Returns null when invalid. */
export function parseTyped(text: string, bounds: StepBounds): number | null {
  const n = Number(text.replace(',', '.').trim());
  if (text.trim() === '' || !Number.isFinite(n)) return null;
  return clampValue(roundTo(n, bounds.decimals ?? decimalsOf(bounds.step)), bounds);
}

export function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/** Long-press acceleration: repeat interval in ms after `ticks` repeats. */
export function repeatDelay(ticks: number): number {
  if (ticks < 5) return 220;
  if (ticks < 15) return 110;
  return 50;
}
