import * as Haptics from 'expo-haptics';

/** Global switch, bound to the "Haptics" setting in step 12. */
let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

const safe = (fn: () => Promise<void>) => {
  if (!enabled) return;
  fn().catch(() => {
    // Haptics are best-effort (unsupported device, web): never surface an error.
  });
};

export const haptics = {
  tap: () => safe(() => Haptics.selectionAsync()),
  impact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
