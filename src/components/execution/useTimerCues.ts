import { useEffect, useRef } from 'react';

import { playCue } from '@/services/audio/cues';
import { useSettingsStore } from '@/store/settingsStore';
import { haptics } from '@/utils/haptics';

/**
 * 3-2-1 countdown cues for a running timer (rest, timed set): a tick at 3, 2 and 1 s left,
 * then "go" at zero. Beeps follow `training.countdownBeeps`; haptics follow the haptics setting.
 * `remainingMs` null = no timer.
 */
export function useTimerCues(remainingMs: number | null) {
  const beeps = useSettingsStore((s) => s.values['training.countdownBeeps']);
  const second = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const last = useRef<number | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = second;
    if (second === null || prev === null || second === prev) return;
    if (second >= 1 && second <= 3) {
      haptics.tap();
      if (beeps) playCue('tick');
    } else if (second === 0) {
      if (beeps) playCue('go');
    }
  }, [second, beeps]);
}
