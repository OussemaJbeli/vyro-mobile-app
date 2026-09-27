import * as ScreenOrientation from 'expo-screen-orientation';

/** The app is portrait; only the running screen may rotate (treadmill holders, step 19). */
export function lockPortrait() {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}

export function allowRotation() {
  ScreenOrientation.unlockAsync().catch(() => {});
}
