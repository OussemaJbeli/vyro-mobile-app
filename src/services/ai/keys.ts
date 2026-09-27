import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { type ProviderId } from './types';

/**
 * API keys live in SecureStore (Keystore on Android), one per provider: never in SQLite,
 * settings, logs or backups. The web preview has no SecureStore, so keys stay in memory
 * for the session only there.
 */
const name = (id: ProviderId) => `vyro.ai.key.${id}`;
const memory = new Map<ProviderId, string>();
const web = Platform.OS === 'web';

export async function getKey(id: ProviderId): Promise<string | null> {
  if (web) return memory.get(id) ?? null;
  return SecureStore.getItemAsync(name(id));
}

export async function setKey(id: ProviderId, key: string): Promise<void> {
  const clean = key.trim();
  if (web) memory.set(id, clean);
  else await SecureStore.setItemAsync(name(id), clean);
}

export async function deleteKey(id: ProviderId): Promise<void> {
  if (web) memory.delete(id);
  else await SecureStore.deleteItemAsync(name(id));
}

/** "••••1234": the only part of a saved key the UI may show. */
export const maskKey = (key: string) => `••••${key.slice(-4)}`;
