import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Re-render clock for timers (AD-10): ticks every `intervalMs` while the app is visible,
 * paused in the background. It only triggers renders; timer state never depends on it.
 */
export function useNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTicking = () => {
      if (timer) return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active' || AppState.currentState === 'unknown') startTicking();
    const sub = AppState.addEventListener('change', (s) =>
      s === 'active' ? startTicking() : stop(),
    );
    return () => {
      stop();
      sub.remove();
    };
  }, [intervalMs, enabled]);
  return now;
}
