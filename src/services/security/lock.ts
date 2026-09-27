import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { i18n } from '@/i18n';
import { logger } from '@/utils/logger';

import {
  backoffMs,
  fromHex,
  hashPin,
  isValidPin,
  PBKDF2_ITERATIONS,
  sameDigest,
  toHex,
} from './policy';

/** SecureStore keys: only the hash, salt, iteration count and attempt counter — never the PIN. */
const K = {
  hash: 'vyro.lock.pinHash',
  salt: 'vyro.lock.pinSalt',
  iter: 'vyro.lock.pinIter',
  attempts: 'vyro.lock.attempts',
};

type Attempts = { failures: number; lastAt: number };

async function readAttempts(): Promise<Attempts> {
  try {
    const raw = await SecureStore.getItemAsync(K.attempts);
    return raw ? (JSON.parse(raw) as Attempts) : { failures: 0, lastAt: 0 };
  } catch {
    return { failures: 0, lastAt: 0 };
  }
}

export async function hasPin(): Promise<boolean> {
  try {
    return !!(await SecureStore.getItemAsync(K.hash));
  } catch {
    return false;
  }
}

/** Lets React paint the loading state before the (CPU-heavy) hash starts. */
const nextFrame = () => new Promise<void>((r) => setTimeout(r, 32));

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4–6 digits');
  const salt = Crypto.getRandomBytes(16);
  await nextFrame();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(K.salt, toHex(salt));
  await SecureStore.setItemAsync(K.iter, String(PBKDF2_ITERATIONS));
  await SecureStore.setItemAsync(K.hash, hash);
  await SecureStore.deleteItemAsync(K.attempts);
}

/** Milliseconds until another PIN attempt is allowed (0 = now). */
export async function waitMs(now = Date.now()): Promise<number> {
  const a = await readAttempts();
  return Math.max(0, a.lastAt + backoffMs(a.failures) - now);
}

export type VerifyResult = { ok: true } | { ok: false; waitMs: number };

export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const wait = await waitMs(now);
  if (wait > 0) return { ok: false, waitMs: wait };
  const [hash, salt, iter] = await Promise.all([
    SecureStore.getItemAsync(K.hash),
    SecureStore.getItemAsync(K.salt),
    SecureStore.getItemAsync(K.iter),
  ]);
  if (!hash || !salt) return { ok: false, waitMs: 0 };
  await nextFrame();
  const rounds = Number(iter) || PBKDF2_ITERATIONS;
  const ok = sameDigest(await hashPin(pin, fromHex(salt), rounds), hash);
  if (ok) {
    await SecureStore.deleteItemAsync(K.attempts);
    // A PIN saved with the old, slower round count: re-hash it in the background so the
    // next unlock is fast.
    if (rounds > PBKDF2_ITERATIONS) void setPin(pin).catch(() => {});
    return { ok: true };
  }
  const a = await readAttempts();
  const next = { failures: a.failures + 1, lastAt: now };
  await SecureStore.setItemAsync(K.attempts, JSON.stringify(next));
  return { ok: false, waitMs: backoffMs(next.failures) };
}

/** Removes the lock only; photos and data stay on the device (the lock is not encryption). */
export async function clearPin(): Promise<void> {
  await Promise.all(Object.values(K).map((k) => SecureStore.deleteItemAsync(k).catch(() => {})));
}

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: i18n.t('settings:lock.prompt'),
      cancelLabel: i18n.t('common:cancel'),
      disableDeviceFallback: true,
    });
    if (r.success) await SecureStore.deleteItemAsync(K.attempts);
    return r.success;
  } catch (error) {
    logger.warn('Biometric authentication unavailable', { error });
    return false;
  }
}
