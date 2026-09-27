import { type ExecState } from './types';

/** Active (unpaused) milliseconds since start. Clamped at 0 if the device clock went back. */
export function activeMs(
  s: Pick<ExecState, 'startedAt' | 'pausedAt' | 'accumulatedPauseMs'>,
  now: number,
): number {
  const reference = s.pausedAt ?? now;
  return Math.max(0, reference - s.startedAt - s.accumulatedPauseMs);
}

/** Paused milliseconds so far, including a pause in progress. */
export function pausedMs(
  s: Pick<ExecState, 'pausedAt' | 'accumulatedPauseMs'>,
  now: number,
): number {
  return s.accumulatedPauseMs + (s.pausedAt !== null ? Math.max(0, now - s.pausedAt) : 0);
}

export function restRemainingMs(s: ExecState, now: number): number {
  if (!s.rest) return 0;
  return Math.max(0, s.rest.startActiveMs + s.rest.durationMs - activeMs(s, now));
}

export function workElapsedMs(s: ExecState, now: number): number {
  return s.workTimer ? Math.max(0, activeMs(s, now) - s.workTimer.startActiveMs) : 0;
}

export function intervalElapsedMs(s: ExecState, now: number): number {
  return s.current ? Math.max(0, activeMs(s, now) - s.current.startActiveMs) : 0;
}

export function intervalRemainingMs(s: ExecState, now: number): number {
  const iv = s.current ? s.intervals[s.current.index] : undefined;
  return iv ? Math.max(0, iv.targetSeconds * 1000 - intervalElapsedMs(s, now)) : 0;
}

/** An execution left active for more than 12 hours prompts "finish, resume or discard?". */
export const STALE_MS = 12 * 3600 * 1000;
export const isStale = (s: ExecState, now: number) =>
  s.lifecycle !== 'completed' && now - s.startedAt > STALE_MS;
