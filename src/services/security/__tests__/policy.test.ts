import {
  backoffMs,
  fromHex,
  hashPin,
  isValidPin,
  sameDigest,
  shouldLock,
  toHex,
  WORKOUT_TIMEOUT_S,
} from '../policy';

describe('PIN hashing', () => {
  const salt = fromHex('00112233445566778899aabbccddeeff');

  it('is salted, deterministic and never the PIN itself', async () => {
    const a = await hashPin('1234', salt, 1000);
    expect(a).toHaveLength(64);
    expect(a).not.toContain('1234');
    expect(await hashPin('1234', salt, 1000)).toBe(a);
    expect(await hashPin('1235', salt, 1000)).not.toBe(a);
    expect(await hashPin('1234', fromHex('ff'.repeat(16)), 1000)).not.toBe(a);
    expect(sameDigest(a, await hashPin('1234', salt, 1000))).toBe(true);
    expect(sameDigest(a, a.slice(0, -1) + (a.endsWith('0') ? '1' : '0'))).toBe(false);
    expect(toHex(salt)).toBe('00112233445566778899aabbccddeeff');
  });

  it('validates 4–6 digits', () => {
    expect(['1234', '123456'].every(isValidPin)).toBe(true);
    expect(['123', '1234567', '12a4', ''].some(isValidPin)).toBe(false);
  });
});

describe('attempt backoff', () => {
  it('first 5 misses are free, then 30 s, 1 min, 5 min, 15 min (capped)', () => {
    expect([0, 4].map(backoffMs)).toEqual([0, 0]);
    expect([5, 6, 7, 8, 12].map(backoffMs)).toEqual([30_000, 60_000, 300_000, 900_000, 900_000]);
  });
});

describe('auto-lock timeout', () => {
  const base = {
    enabled: true,
    backgroundAt: 1_000_000,
    timeoutS: 60,
    workoutActive: false,
    extendDuringWorkout: true,
  };
  it('locks after the timeout, never when disabled or never backgrounded', () => {
    expect(shouldLock({ ...base, now: 1_000_000 + 59_000 })).toBe(false);
    expect(shouldLock({ ...base, now: 1_000_000 + 60_000 })).toBe(true);
    expect(shouldLock({ ...base, timeoutS: 0, now: 1_000_001 })).toBe(true);
    expect(shouldLock({ ...base, enabled: false, now: 9e12 })).toBe(false);
    expect(shouldLock({ ...base, backgroundAt: null, now: 9e12 })).toBe(false);
  });
  it('an active workout extends the timeout to 15 min unless turned off', () => {
    const at = { ...base, workoutActive: true, now: 1_000_000 + 10 * 60_000 };
    expect(shouldLock(at)).toBe(false);
    expect(shouldLock({ ...at, now: 1_000_000 + WORKOUT_TIMEOUT_S * 1000 })).toBe(true);
    expect(shouldLock({ ...at, extendDuringWorkout: false })).toBe(true);
  });
});
