// Global test setup. Native module mocks are added here as features need them.
// Gesture Handler's official Jest setup (native module stubs).
import 'react-native-gesture-handler/jestSetup';

import { setLanguage } from '@/i18n';
import { logger } from '@/utils/logger';

// Expected failures in tests are logged; keep them in the ring buffer, not the console.
logger.setConsoleEcho(false);

// Components read translations through react-i18next; pin English for stable assertions.
beforeAll(async () => {
  await setLanguage('en');
});

// jest-expo's expo-crypto mock returns undefined ids; use Node's real UUID v4.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual<object>('expo-crypto'),
  randomUUID: () =>
    (jest.requireActual('node:crypto') as { randomUUID: () => string }).randomUUID(),
}));

// Reanimated 4 + Worklets have no native runtime under Jest: use their official mocks.
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// expo-audio has no native module under Jest: stub the player used for countdown cues.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    play: jest.fn(),
    seekTo: () => Promise.resolve(),
    remove: jest.fn(),
  }),
  setAudioModeAsync: () => Promise.resolve(),
}));

// expo-video has no native module under Jest: the demo loop renders nothing in tests.
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: () => Promise.resolve(),
    status: 'idle',
    addListener: () => ({ remove: jest.fn() }),
  }),
  VideoView: () => null,
}));
