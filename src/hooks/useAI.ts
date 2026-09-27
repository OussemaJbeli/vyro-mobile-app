import { useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { currentLanguage } from '@/i18n';
import { createAppAIService, providerMeta, type AIConfig } from '@/services/ai';
import { useSettingsStore } from '@/store/settingsStore';
import { today } from '@/utils/dates';

/** Current AI settings (read at call time, so a changed key/provider applies at once). */
export function readAIConfig(): AIConfig {
  const v = useSettingsStore.getState().values;
  const provider = v['ai.provider'];
  return {
    enabled: v['ai.enabled'],
    provider,
    model: v['ai.models'][provider] || providerMeta(provider)!.defaultModel,
    prefs: { tone: v['ai.tone'], language: currentLanguage() === 'fr' ? 'fr' : 'en' },
    includeNotes: v['ai.includeNotes'],
  };
}

/** The AIService for this app (one per mount; stateless apart from the DB). */
export function useAI() {
  const db = useDatabase();
  const [service] = useState(() => createAppAIService(db, readAIConfig, today));
  return service;
}
