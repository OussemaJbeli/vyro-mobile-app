import * as Network from 'expo-network';

import { type Database } from '@/db/client';

import { getKey } from './keys';
import { createProvider, providerMeta } from './providers';
import { createAIService, type AIConfig } from './service';

export { humanError } from './providers/http';
export { PROVIDERS, providerMeta, type ProviderMeta } from './providers';
export { deleteKey, getKey, maskKey, setKey } from './keys';
export type { AIConfig, AIService, InsightResult, Prepared, SuggestionPreview } from './service';
export type { Insight, Suggestion } from './schemas';
export type { AIMethod } from './summarizer';
export type { AIError, ProviderId } from './types';

/** Connectivity check before any request (FS §58: everything else works offline). */
export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true; // unknown: let the request try and report a clear error
  }
}

/** The app's AIService: provider + key resolved at call time from settings/SecureStore. */
export function createAppAIService(db: Database, config: () => AIConfig, today: () => string) {
  return createAIService({
    db,
    config,
    isOnline,
    today,
    provider: async (cfg) => {
      if (cfg.provider === 'mock') return createProvider('mock', '', cfg.model);
      const key = await getKey(cfg.provider);
      if (!key) return null;
      return createProvider(
        cfg.provider,
        key,
        cfg.model || providerMeta(cfg.provider)!.defaultModel,
      );
    },
  });
}
