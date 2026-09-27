# 26 — App Lock & Privacy Hardening

| | |
|---|---|
| Milestone | M3 Platform services |
| Depends on | 23 |
| Spec refs | FS §28, §63 · UI §38 · `expo-local-authentication`, `expo-secure-store` |
| Output | Biometric/PIN lock, a privacy shield in the app switcher, auto-lock policy, and a privacy settings screen |

## Objective

Protect body photos, measurements and history with a lock that is fast for the owner and safe against casual access (UI §38).

## Lock model

| Setting | Options | Default |
|---|---|---|
| App lock | off / on | off (offered in onboarding) |
| Method | Biometrics with PIN fallback · PIN only | biometrics if enrolled |
| Auto-lock after background | immediately · 1 min · 5 min · 15 min | 1 min |
| Lock scope | whole app · Photos only | whole app |
| Hide previews | blur the app in the switcher | on when the lock is on |

- **PIN:** 4–6 digits. Store a **salted, stretched hash** (PBKDF2-SHA256 via `@noble/hashes`, random 16-byte salt from `expo-crypto`, about 100k iterations tuned so it takes under 300 ms on device), never the PIN itself. Hash and salt live in `expo-secure-store`.
- **Attempts:** after 5 wrong PINs, add increasing delays (30 s, 1 min, 5 min…). Show no hint about the PIN.
- **Forgotten PIN:** the recovery path is biometric unlock if enrolled. Otherwise, "Reset lock" requires confirming that locally protected data remains, and resetting only removes the lock (the data stays on the device and is not destroyed). Document this honestly: the lock is a privacy barrier, not encryption.

## Tasks

- [x] `src/services/security/lock.ts`: `isEnabled`, `authenticate()` (biometrics → PIN fallback), `setPin`, `verifyPin`, `disable` (requires authentication).
- [x] `LockGate` (from step 05) becomes real. On cold start and on returning from background past the timeout, it renders `lock.tsx` over the app. Navigation state is preserved underneath.
- [x] **Execution exception:** if a workout is active, the auto-lock timeout extends to 15 min, so a quick glance during rest doesn't force re-authentication. The user can turn this off.
- [x] **Privacy shield:** on `AppState` `inactive/background`, overlay a branded blur/`VyroMark` screen so the switcher never shows content. On Android, apply `FLAG_SECURE` (screenshots blocked) on photo screens at least, with a setting for the whole app. This needs a small config plugin or library; verify availability.
- [x] Lock screen UI: VyroMark, "Unlock VYRO", a biometric button, a PIN pad with large keys, haptics, and accessibility labels.
- [x] Settings → **Privacy** (`settings/privacy`): the lock options, the screenshot-block toggle, "Include photos in device backups" (from step 23), "Clear recently deleted photos now", and a plain-language "What stays on your device" explainer (everything; nothing is uploaded).
- [x] Settings → **App lock** (`settings/app-lock`): enable/disable, change PIN, method, timeout.
- [x] Onboarding step 9 now runs the real setup.
- [x] Tests for PIN hashing and verification, the attempt backoff, and the timeout logic (pure functions with an injected clock).

## Acceptance criteria

- [x] With the lock on, backgrounding for longer than the timeout and returning shows the lock, and biometrics unlock it.
- [x] The app switcher never shows photo or measurement content.
- [x] The PIN is never stored in plain text. Inspecting SecureStore shows only the hash and salt.
- [x] Disabling the lock requires authentication.

## Execution log

**2026-09-26 — Done.**

- **Policy** `services/security/policy.ts` (pure, tested):
  - PIN = 4–6 digits. Hash = **PBKDF2-SHA256** (`@noble/hashes`, async) with a random 16-byte salt (`expo-crypto`) and 60k iterations. The count is tuned down from the ~100k target to keep Hermes unlock under a second; the stored iteration count allows raising it later.
  - Constant-time compare.
  - Backoff: 5 free attempts, then 30 s / 1 min / 5 min / 15 min.
  - `shouldLock` with an injected clock; an active workout extends the timeout to 15 min (setting).
- **Lock service** `services/security/lock.ts`:
  - SecureStore holds **only** the hash, salt, iteration count and attempt counter, never the PIN. The attempt counter survives an app kill.
  - `setPin`, `verifyPin` (backoff), `hasPin`, `clearPin`, `biometricsAvailable`, `authenticateBiometric`.
- **`LockGate` is real**:
  - "Armed" = `lock.enabled` **and** a PIN exists, so a setting alone can never lock anyone out.
  - It locks once at cold start and on return after the timeout (immediately / 1 / 5 / 15 min).
  - The lock renders **over** the app, so navigation is preserved.
- **Privacy shield**: while inactive/backgrounded, a branded VyroMark overlay. On iOS, `enableAppSwitcherProtectionAsync`; on Android, `FLAG_SECURE` via `expo-screen-capture` (hides switcher thumbnails, blocks screenshots). This works in Expo Go and dev builds without a custom plugin.
  - **Photo screens always block screenshots** (`PhotoPrivacy`). The "Block screenshots" setting extends this to the whole app.
- **Lock scope "Photos only"**: photo screens and the Photos segment show the lock screen in place of their content until unlocked.
- **Lock screen**: VyroMark, "Unlock VYRO", an automatic biometric prompt (when the method is biometric and biometrics are enrolled), a large-key PIN pad (76 dp, haptics, a11y labels, dots announced), and a wait message after misses.
  - **Forgot PIN**: biometric recovery if enrolled; otherwise "Reset lock" with the honest text (removes only the lock; data stays, the lock is not encryption).
- **Settings → App lock**:
  - Enable runs PIN setup (choose + confirm). Change PIN and **disable require authentication** (`AuthSheet`: PIN or biometrics).
  - Method (biometrics + PIN / PIN only), auto-lock timeout, scope (whole app / photos only), relax during workouts.
- **Settings → Privacy**: lock status, hide previews, block screenshots, "Clear recently deleted photos now" (`purgeAllDeleted`), a plain-language "What stays on your device" and a device-backup explanation.
- **Backups (decision)**: `android.allowBackup: false`, so there is no Android cloud auto-backup of data or photos. On iOS, app data can be part of the user's encrypted device backup; Expo exposes no per-folder exclusion. Settings explain this, and step 27 provides a user-controlled export.
- **Onboarding step 9** runs the real PIN setup; "Not now" leaves the lock off.
- **Web preview**: SecureStore is unavailable, so the lock is never armed there. It runs on devices.
- **Tests (+5)**: hashing/verification, validation, backoff, timeouts including the workout extension. Total 295, `pnpm check` green. A headless web sweep of the 7 touched routes showed no render errors.
