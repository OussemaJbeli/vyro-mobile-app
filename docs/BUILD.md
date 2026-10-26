# Building VYRO

VYRO is an Expo SDK 57 app (React Native 0.86) with no backend: every build runs fully
offline. Android is the V1 target.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS | `node -v` |
| pnpm | 10+ | `corepack enable` · the repo uses `node-linker=hoisted` (`.npmrc`) |
| EAS CLI | latest | run as `npx eas-cli@latest …` (no global install needed) |
| Expo account | — | project `@devopst34/vyro` (`extra.eas.projectId` in `app.config.ts`) |
| JDK 17 + Android SDK | — | **only** for local native builds; EAS builds in the cloud without them |

### WSL2

The dev machine is WSL2 without an Android toolchain, so:

- Day-to-day: **Expo Go** on the phone through a tunnel: `pnpm go` (retries ngrok start-up).
- Native builds: **EAS** (cloud). Download the APK on the phone, or `adb install` from Windows.
- Local Gradle builds need JDK 17 and the Android SDK inside WSL (`ANDROID_HOME`), and
  `adb` from Windows for USB devices.

## Development

```bash
pnpm install
pnpm go                  # Expo Go via tunnel (phone)
pnpm web                 # web preview (photos/covers use browser storage there)
pnpm check               # typecheck + lint + tests: the gate before every change is done
pnpm db:lock             # after adding a migration (checksum lock)
```

Add Expo/native packages with `npx expo install <pkg>` so versions match SDK 57.

## Development build (native modules beyond Expo Go)

```bash
npx eas-cli@latest build --platform android --profile development
pnpm start               # expo start --dev-client
```

## Release builds

Profiles live in `eas.json`:

| Profile | Output | Use |
|---|---|---|
| `preview` | signed **APK** | sideloading / QA (step 29) |
| `production` | signed **AAB** | Google Play |

```bash
npx eas-cli@latest build --platform android --profile preview      # APK
npx eas-cli@latest build --platform android --profile production   # AAB
```

Local alternative (needs JDK 17 + Android SDK):

```bash
npx expo prebuild --platform android --clean   # android/ is generated (CNG): never edit it
cd android && ./gradlew assembleRelease        # app/build/outputs/apk/release/app-release.apk
```

R8/ProGuard is on by default for release. Smoke-test SQLite, Reanimated and the SVG charts on
every release build.

## Signing

- **Recommended:** let EAS create and store the upload keystore on the first build
  (`eas credentials` to view or download it).
- **Back up the keystore and its passwords** in a password manager. Losing it means the app
  can never be updated.
- Never commit keystores (`*.keystore`, `*.jks` are in `.gitignore`).

## Versioning

- `version` in `app.config.ts` is semver: **MAJOR** for data-format breaks, **MINOR** for
  features, **PATCH** for fixes. V1 = `1.0.0`.
- `versionCode` is managed by EAS (`cli.appVersionSource: "remote"`, `production.autoIncrement`):
  it only ever goes up. For local Gradle builds, raise `android.versionCode` by hand.
- A schema change is always a new append-only migration (`src/db/migrations`) + `pnpm db:lock`.
  Updates keep data: migrations run at startup, with a safety copy first.

## Permissions (Android)

Requested: `CAMERA` (progress photos), `POST_NOTIFICATIONS` (reminders), `USE_BIOMETRIC`
(app lock), `VIBRATE` (haptics), `INTERNET` (kept for Expo updates and the future AI layer;
no V1 feature depends on it).

Blocked in `app.config.ts` (`android.blockedPermissions`): legacy storage and media reads
(the system Photo Picker needs none), `RECORD_AUDIO`.

`SCHEDULE_EXACT_ALARM` is **not** requested: rest and interval timers run in the foreground
from the engine clock, and reminder notifications tolerate Android's inexact delivery (a few
minutes). Revisit only if QA finds late alarms that matter.

## Release checklist

1. `pnpm check` is green; `expo-doctor` has no errors (`npx expo-doctor`).
2. Bump `version` if needed; update `CHANGELOG.md`.
3. `preview` build → install on 2 devices → step 29 smoke subset (onboarding, a workout, a
   run, a photo, a notification, export) in **airplane mode**.
4. Install the new build **over** the previous one: data must survive (migrations).
5. `production` build (AAB) for the store.
6. Tag the release: `git tag v1.0.0 && git push --tags`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `request to https://api.expo.dev/graphql failed` / `ETIMEDOUT` (WSL) | WSL has no working IPv6 and Node gives up too fast: use `pnpm build:apk`, or export `NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection'` |
| Tunnel fails to start | `pnpm go` retries; or set `GO_TUNNEL_ATTEMPTS=10` |
| "Incompatible package versions" | `npx expo install --fix` |
| Native module missing in Expo Go | it needs a development build (see above) |
| Migration checksum mismatch | a released migration was edited: revert it and add a new one |
| Images dropped in `assets/images/*` don't appear | reload; if still missing, restart `npx expo start` (Metro `require.context`) |
| Web preview: SQLite errors | Metro must send COOP/COEP headers (`metro.config.js`, already set) |
