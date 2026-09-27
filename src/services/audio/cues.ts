import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { logger } from '@/utils/logger';

const SOURCES = {
  tick: require('../../../assets/sounds/tick.wav') as number,
  go: require('../../../assets/sounds/go.wav') as number,
};

export type Cue = keyof typeof SOURCES;

let players: Partial<Record<Cue, AudioPlayer>> = {};
let ready = false;

function player(cue: Cue): AudioPlayer | null {
  try {
    if (!ready) {
      ready = true;
      // Short cues mix with the user's music instead of stopping it.
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
        () => {},
      );
    }
    players[cue] ??= createAudioPlayer(SOURCES[cue]);
    return players[cue];
  } catch (error) {
    logger.warn('Audio cue unavailable', { error });
    return null;
  }
}

/** 3-2-1 countdown ticks and the final "go" (setting `training.countdownBeeps`). Best-effort. */
export function playCue(cue: Cue) {
  const p = player(cue);
  if (!p) return;
  p.seekTo(0)
    .then(() => p.play())
    .catch(() => {});
}

export function releaseCues() {
  Object.values(players).forEach((p) => p.remove());
  players = {};
}
