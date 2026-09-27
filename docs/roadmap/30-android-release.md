# 30 — Android Build & APK Release

| | |
|---|---|
| Milestone | M4 Ship V1 |
| Depends on | 29 |
| Spec refs | FS §85 · AD-19 |
| Output | A signed release APK (and AAB), release configuration, versioning, and complete build documentation |

## Objective

Produce an installable, signed VYRO APK that runs with no backend (FS §85), plus instructions that let anyone rebuild it.

## Tasks

### 1. Release configuration
- [x] `app.config.ts`: final name **VYRO**, package `ca.evoxai.vyro`, `version: "1.0.0"`, `android.versionCode: 1` (automated through `eas.json` `autoIncrement`, or a script).
- [x] Permissions audit. Request only what V1 uses: `CAMERA`, `POST_NOTIFICATIONS`, `USE_BIOMETRIC`, `VIBRATE`. Add `SCHEDULE_EXACT_ALARM` only if inexact alarms make rest timers noticeably late; document the trade-off either way.
- [x] Keep `INTERNET` (Expo updates and the future AI layer need it), but no V1 feature may depend on it.
- [x] Block legacy storage permissions (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`) unless the image picker requires them. Modern Android uses the system Photo Picker.
- [x] Remove the dev routes from release (`src/app/dev/*` guarded by `__DEV__` plus a redirect). Confirm the `featureFlags.ai = false` default.
- [ ] Final icon, adaptive icon, monochrome icon and splash (step 02) verified on Android 12+ (the splash screen API).
- [ ] ProGuard/R8 is enabled by default in release builds. Test that nothing breaks (SQLite, Reanimated, Skia).

### 2. Signing
- [ ] Generate an upload keystore (or let EAS manage credentials). **Back up the keystore and passwords** in a password manager. Losing it means you can never update the app.
- [x] Never commit keystores. `.gitignore` already covers `*.keystore`.

### 3. Builds
- [ ] **EAS (recommended):**
  ```bash
  eas build --platform android --profile preview      # APK for sideloading
  eas build --platform android --profile production   # AAB for Play Store
  ```
  `eas.json` preview profile: `"android": { "buildType": "apk" }`.
- [ ] **Local alternative:**
  ```bash
  npx expo prebuild --platform android --clean
  cd android && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
  ```
- [ ] Install the APK on 2 physical devices and run a smoke subset of step 29 (onboarding, a workout, a run, a photo, a notification, export).

### 4. Documentation (`docs/BUILD.md`)
- [x] Prerequisites (Node, pnpm, JDK 17, Android SDK, EAS CLI), environment setup on WSL2, development run, dev build, APK and AAB generation, signing, versioning policy (semver, and the versionCode rule), and troubleshooting.

### 5. Release artefacts
- [x] `CHANGELOG.md` with the 1.0.0 entry (features by section).
- [x] Store listing draft (if publishing): short and full description, screenshots of the 5 core screens in dark mode and one in light mode, and a privacy statement: "All data stays on your device. No account. No tracking."
- [ ] Tag `v1.0.0` in git.

## Acceptance criteria

- [ ] A signed release APK installs and runs on a clean device in airplane mode.
- [ ] Upgrading from the previous preview build keeps all data (migrations run).
- [ ] `docs/BUILD.md` lets someone reproduce the build from a clean clone.
- [ ] **🎉 V1 complete.** Update tracking.md so milestones M0–M4 are Done.
