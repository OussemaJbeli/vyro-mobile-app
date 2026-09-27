# 01 — Project Bootstrap

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | — |
| Spec refs | FS §4, §6, §48, §85 · Overview AD-01, AD-02, AD-19 |
| Output | An Expo + TypeScript + Expo Router project that runs as a development build on Android, with quality gates wired in |

## Objective

Create the VYRO project at the repository root (`/home/evops34/pnpm/data/vyro`) next to the existing `docs/` folder. Configure strict TypeScript, linting with architecture rules, formatting, tests and a dev build. Nothing product-specific yet. This step builds the foundation that every later step relies on.

## Scope

**In:** project creation, dependencies baseline, tooling, folder skeleton, app identity config, dev build, scripts.
**Out:** theme, screens, database (later steps).

## Tasks

### 1. Create the project

- [x] Check the current stable Expo SDK:
  ```bash
  npx create-expo-app@latest --help
  ```
  Use the **default TypeScript template with Expo Router**. Scaffold into a temp folder, then move the files into the repo root so `docs/` stays untouched.
- [x] Add `.npmrc` with:
  ```ini
  node-linker=hoisted
  ```
- [x] Reinstall with `pnpm install` and confirm `pnpm expo start` boots.
- [x] Remove template demo screens, components and assets. Routes live in `src/app/` (SDK 57 default). Keep an empty `src/app/_layout.tsx` and `src/app/index.tsx` that renders "VYRO".
- [x] `git init`. Add a `.gitignore` covering `node_modules`, `.expo`, `android/`, `ios/`, `*.keystore`, `.env*`, `coverage/`.

### 2. TypeScript strict

- [x] In `tsconfig.json`, enable `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `exactOptionalPropertyTypes` (drop the last one only if a dependency makes it unworkable, and note it).
- [x] Path alias `@/*` → `src/*`. Configure it for both TypeScript and Babel/Metro (Expo supports `tsconfig` paths natively; verify it).

### 3. Folder skeleton

Create these folders, each with a short `README.md` describing its responsibility:

```text
src/components/{ui,brand,workout,running,planner,execution,progress,dashboard,ai}
src/db/{migrations,repositories,seed}
src/domain/{workouts,running,scheduling,execution,progress,analytics,goals,streaks}
src/store  src/services/{notifications,photos,backup,security,ai}
src/hooks  src/i18n  src/theme  src/utils  src/types  src/constants
assets/{brand,images,fonts}
e2e/
```

### 4. Linting, formatting and architecture rules

- [x] ESLint using `eslint-config-expo` (flat config) plus `@typescript-eslint`, `eslint-plugin-react-hooks` and `eslint-plugin-import`.
- [x] Prettier: single quotes, trailing commas, width 100.
- [x] **Layer rule** with `import/no-restricted-paths`:
  - `src/domain/**` must not import `react`, `react-native`, `expo-*`, `@/db`, `@/components`, `@/store`.
  - `src/db/**` must not import `@/components`, `@/store`, `@/hooks`, `@/app/*`.
  - `src/components/**` must not import `@/db/**` directly (it uses hooks).
  - Nothing outside `src/services/ai/**` imports AI provider SDKs.
- [x] **No raw colors rule:** `no-restricted-syntax` flagging string literals matching `/^#([0-9a-f]{3}){1,2}$/i` or `rgb(` outside `src/theme/**`.

### 5. Testing

- [x] `jest-expo` preset, `@testing-library/react-native`, and a `jest.setup.ts`.
- [x] Add a sample test in `src/domain/__tests__/sanity.test.ts` to prove the pipeline runs.
- [ ] Coverage thresholds for `src/domain/**`: 90 % lines. Enforced from step 16 onward (set now, allow empty).

### 6. App identity (`app.json` / `app.config.ts`)

- [x] Convert to `app.config.ts` for typed configuration.
- [x] `name: "VYRO"`, `slug: "vyro"`, `scheme: "vyro"`, `orientation: "portrait"`, `userInterfaceStyle: "automatic"`.
- [x] `android.package` and `ios.bundleIdentifier` = `ca.evoxai.vyro` (confirm with the owner, see AD-19).
- [x] `android.edgeToEdgeEnabled: true` if the SDK supports it. Placeholder icon and splash until step 02.
- [x] `experiments.typedRoutes: true`.

### 7. Baseline dependencies

Install with `npx expo install` so versions match the SDK:

```bash
npx expo install expo-dev-client expo-router expo-sqlite expo-file-system expo-crypto \
  expo-secure-store expo-notifications expo-local-authentication expo-image-picker \
  expo-camera expo-image expo-image-manipulator expo-haptics expo-keep-awake \
  expo-localization expo-font expo-splash-screen expo-sharing expo-document-picker \
  expo-linear-gradient expo-blur react-native-reanimated react-native-gesture-handler \
  react-native-safe-area-context react-native-screens react-native-svg
pnpm add zustand zod react-hook-form @hookform/resolvers i18next react-i18next date-fns
```

Only install libraries later steps actually use. Charts, bottom sheet and drag-and-drop come in their own steps after compatibility checks.

### 8. Dev build

- [x] `pnpm add -g eas-cli` (or use `npx eas`). Add `eas.json` with `development`, `preview` (APK) and `production` profiles.
- [x] EAS project created and linked (`@devopst34/vyro`, `extra.eas.projectId` in `app.config.ts`). Cloud dev build available with `npx eas-cli@latest build --profile development -p android` when a later step needs it (AD-01).
- [x] Open the app in **Expo Go** on the phone (`pnpm go`) and confirm hot reload works.

### 9. Scripts (`package.json`)

```json
{
  "start": "expo start --dev-client",
  "android": "expo run:android",
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --max-warnings=0",
  "format": "prettier --write .",
  "test": "jest",
  "test:watch": "jest --watch",
  "doctor": "npx expo-doctor"
}
```

### 10. Project README

- [x] Root `README.md` covering prerequisites, install, run the dev build, the scripts, and links to `docs/roadmap/`.

## Acceptance criteria

- [x] `pnpm typecheck`, `pnpm lint` and `pnpm test` all pass.
- [x] `npx expo-doctor` reports no critical issues.
- [x] The app launches on the Android phone in Expo Go and shows "VYRO".
- [x] A deliberate violation (a `#fff` literal in a component, or `domain/` importing `react-native`) fails lint.

## Pitfalls

- Without `node-linker=hoisted`, pnpm breaks Metro resolution and native autolinking.
- Always use `npx expo install` for native modules. Plain `pnpm add` can pull incompatible versions.
- Under WSL2, the Android emulator usually runs on Windows. Use `adb connect` or a physical device over USB/IP. Document what you use in the README.

## Handoff

Step 02 adds the real brand assets. Step 03 builds the theme on top of this skeleton.

## Execution log (2026-09-24)

- Scaffolded with `create-expo-app@latest` (default template): **Expo SDK 57.0.25, React Native 0.86.3, React 19.2.3, TypeScript 6.0**. Routes live in `src/app/` (SDK 57 default); the roadmap was updated to match.
- ESLint is pinned to **9.x**: ESLint 10 is not yet supported by `eslint-plugin-react` / `eslint-plugin-import` inside `eslint-config-expo`.
- `@testing-library/react-native` 14 needs the `test-renderer` package, which declares a peer of React 19.3. It works with React 19.2.3 (tests pass). Recheck when React is upgraded.
- Kept the web dependencies (`react-dom`, `react-native-web`) for quick visual checks in a browser. Android remains the only target.
- `app.config.ts` uses `ca.evoxai.vyro` (AD-19) and the brand background `#01070C` for the adaptive icon and splash. Icons are still the Expo placeholders until step 02.
- Verified: `pnpm check` passes, `expo-doctor` passes 21/21, `expo export --platform android` produces a Hermes bundle, and lint rejects a raw colour, a UI → `@/db` import and a domain → `react-native` import.
- **Coverage gate:** the 90 % threshold for `src/domain` is written in `jest.config.js` but commented out. Jest fails a path threshold that matches no files. Enable it in step 16.
- EAS login done by the owner. `eas build` failed with "Cannot automatically write to dynamic config": fixed by adding `owner` and `extra.eas.projectId` to `app.config.ts` by hand.
- Switched daily development to **Expo Go** (AD-01 updated). Added `@expo/ngrok` and the `pnpm go` script (Expo Go + tunnel, needed from WSL2). Verified the tunnel connects.
- Owner confirmed "VYRO" runs in Expo Go on the phone and on web. Step done.
