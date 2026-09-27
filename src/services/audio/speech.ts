import * as Speech from 'expo-speech';

import { i18n } from '@/i18n';

const VOICE_LANG: Record<string, string> = { en: 'en-US', fr: 'fr-FR' };

/** Spoken interval cue through the on-device TTS (setting `training.voiceCues`). Offline. */
export function speakCue(text: string) {
  try {
    Speech.stop().catch(() => {});
    Speech.speak(text, { language: VOICE_LANG[i18n.language] ?? 'en-US', rate: 1.0 });
  } catch {
    // TTS unavailable (web without voices, simulator): cues are best-effort.
  }
}
