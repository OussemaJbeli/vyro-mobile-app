/**
 * App lock policy (step 26), pure and clock-injected. The lock is a privacy barrier, not
 * encryption: data stays readable to anyone with device-level access.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * PBKDF2 runs in plain JS (no native PBKDF2 in Expo), and Hermes has no JIT: 60k rounds
 * took minutes on a mid-range phone. A 4–6 digit PIN has at most 1M values, so stretching
 * adds little anyway; the real protection is the Keystore-backed SecureStore (the hash
 * never leaves it) plus the attempt backoff below. 1k rounds ≈ well under a second.
 * Hashes keep their own round count, so older (60k) PINs still verify and are re-hashed.
 */
export const PBKDF2_ITERATIONS = 1_000;
export const FREE_ATTEMPTS = 5;
export const WORKOUT_TIMEOUT_S = 15 * 60;

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

/** Delay before the next PIN attempt: none for the first 5 misses, then 30 s, 1 min, 5 min, 15 min… */
export function backoffMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  const steps = [30_000, 60_000, 300_000, 900_000];
  return steps[Math.min(failures - FREE_ATTEMPTS, steps.length - 1)]!;
}

/** Whether returning to the foreground must show the lock. */
export function shouldLock(opts: {
  enabled: boolean;
  backgroundAt: number | null;
  now: number;
  timeoutS: number;
  workoutActive: boolean;
  extendDuringWorkout: boolean;
}): boolean {
  if (!opts.enabled || opts.backgroundAt === null) return false;
  const timeout =
    opts.workoutActive && opts.extendDuringWorkout
      ? Math.max(opts.timeoutS, WORKOUT_TIMEOUT_S)
      : opts.timeoutS;
  return opts.now - opts.backgroundAt >= timeout * 1000;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string) =>
  new Uint8Array(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);

export async function hashPin(
  pin: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  return hex(
    // asyncTick: yield to the UI every 8 ms so the spinner keeps animating.
    await pbkdf2Async(sha256, new TextEncoder().encode(pin), salt, {
      c: iterations,
      dkLen: 32,
      asyncTick: 8,
    }),
  );
}

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { hex as toHex };
