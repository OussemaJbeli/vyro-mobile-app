import type { ConfigContext, ExpoConfig } from 'expo/config';

// Brand colours are duplicated here on purpose: app config is evaluated in Node
// before the theme module exists. Keep them in sync with src/theme (step 03).
const BRAND_BACKGROUND = '#01070C';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'VYRO',
  slug: 'vyro',
  owner: 'devopst34',
  version: '1.0.0',
  scheme: 'vyro',
  // Portrait everywhere (locked at startup); the running screen unlocks rotation (step 19).
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/brand/icon.png',
  backgroundColor: BRAND_BACKGROUND,
  ios: {
    bundleIdentifier: 'ca.evoxai.vyro',
    supportsTablet: false,
  },
  android: {
    // Privacy (step 26): no Android cloud auto-backup of local data and photos.
    allowBackup: false,
    package: 'ca.evoxai.vyro',
    adaptiveIcon: {
      backgroundColor: BRAND_BACKGROUND,
      foregroundImage: './assets/brand/adaptive-foreground.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Permissions audit (step 30). V1 uses CAMERA, POST_NOTIFICATIONS, USE_BIOMETRIC and
    // VIBRATE. Library import goes through the system Photo Picker, which needs no storage
    // permission; nothing is written to shared storage; no audio is recorded.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.RECORD_AUDIO',
    ],
  },
  web: {
    output: 'single',
    favicon: './assets/brand/favicon.png',
  },
  plugins: [
    ['expo-screen-orientation', { initialOrientation: 'PORTRAIT_UP' }],
    // Private progress photos (step 23): camera + library import only; nothing is saved
    // to the gallery, so no media-library write permission is requested.
    [
      'expo-camera',
      {
        cameraPermission:
          'VYRO uses the camera to take private progress photos that stay on this device.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'VYRO lets you import a photo; a private copy stays on this device.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-router',
      {
        // Needed by expo-sqlite on web (SharedArrayBuffer) when hosted.
        headers: {
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Opener-Policy': 'same-origin',
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: BRAND_BACKGROUND,
        image: './assets/brand/splash-mark.png',
        imageWidth: 160,
      },
    ],
    'expo-sqlite',
    'expo-secure-store',
    'expo-localization',
    'expo-sharing',
  ],
  extra: {
    eas: {
      projectId: '44900f5f-64b7-4ba0-8019-27ceb49b2e2d',
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
