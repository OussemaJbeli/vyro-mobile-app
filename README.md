# VYRO

**Train · Track · Evolve.** A private, offline-first personal training app built with Expo, React Native and TypeScript.
All data stays on the device. No account and no backend.

- Product spec: [docs/plan/](docs/plan/)
- Build roadmap and status: [docs/roadmap/00-overview.md](docs/roadmap/00-overview.md) · [docs/roadmap/tracking.md](docs/roadmap/tracking.md)

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript (strict) · Expo Router · expo-sqlite · Zustand · Zod · React Hook Form · i18next · Jest + Testing Library.

## Prerequisites

- Node 22 LTS and pnpm 10 or newer. The repo uses `node-linker=hoisted` in `.npmrc`, which Expo requires with pnpm.
- The **Expo Go** app on an Android phone, for daily development.
- An Expo account (`npx eas-cli@latest login`) for cloud builds. EAS project: `@devopst34/vyro`.
- Local native builds are optional and need JDK 17 plus the Android SDK.

## Install

```bash
pnpm install
```

Always add Expo or native packages with `npx expo install <pkg>`, so versions match the SDK.

## Run

### Daily development: Expo Go on your phone (no Java needed)

```bash
pnpm go          # Metro + tunnel for Expo Go, with automatic retries. Scan the QR code in Expo Go.
pnpm go:lan      # Same over the local network: faster, no tunnel (needs WSL mirrored networking)
```

- The tunnel is required when developing inside **WSL2** in its default NAT mode, because the phone cannot reach WSL's internal IP.
- `--go` is needed because `expo-dev-client` is installed. Without it, `expo start` expects a development build.
- Expo Go on the phone must support **SDK 57**. Update the app from the store if it reports an incompatible SDK.

#### "ngrok tunnel took too long to connect"

Expo CLI gives the tunnel a fixed 10 seconds, and Expo's shared ngrok service is sometimes slower. `pnpm go` (`scripts/dev/go-tunnel.sh`) therefore retries up to 5 times, but only failures during startup. Quitting a running session exits normally. If every attempt fails, check https://status.ngrok.com/ and try again a minute later, or switch to LAN mode.

#### LAN mode without a tunnel (recommended if tunnels keep failing)

1. On Windows 11, create or edit `%UserProfile%\.wslconfig`:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```
2. In PowerShell, run `wsl --shutdown`, then reopen the WSL terminal.
3. Allow inbound TCP 8081 for WSL once (PowerShell as administrator):
   ```powershell
   New-NetFirewallHyperVRule -Name "Expo Metro" -DisplayName "Expo Metro 8081" -Direction Inbound -VMCreatorId "{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}" -Protocol TCP -LocalPorts 8081
   ```
4. With the phone on the same Wi-Fi, run `pnpm go:lan` and scan the QR code.

### Development build (cloud, no Java needed)

Needed later for features Expo Go cannot fully cover (see AD-01 in the roadmap).

```bash
npx eas-cli@latest build --profile development -p android   # installable APK link when done
pnpm start                                                   # then open the dev build app
```

`pnpm android` builds locally and needs JDK 17 plus the Android SDK.

## Scripts

| Script           | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `pnpm start`     | Metro for the development build                                 |
| `pnpm android`   | Build and run the native Android app locally                    |
| `pnpm typecheck` | TypeScript, no emit                                             |
| `pnpm lint`      | ESLint with architecture and theme rules, zero warnings allowed |
| `pnpm format`    | Prettier write                                                  |
| `pnpm test`      | Jest (`jest-expo` preset)                                       |
| `pnpm check`     | typecheck + lint + test, the global gate for every roadmap step |
| `pnpm doctor`    | `expo-doctor` dependency health checks                          |

## Architecture rules

Layers may only import to their right (enforced by lint):

```text
src/app (routes) → components → hooks + store → domain + services → db/repositories → db/client
```

- `src/domain` is pure TypeScript: no React, React Native, Expo or SQL.
- UI code never imports `@/db`. It reads data through hooks.
- Raw colours (`#fff`, `rgb()`) are only allowed in `src/theme`.
- AI provider SDKs are only allowed in `src/services/ai`.

## Builds

| Profile     | Output                      | Command                                                     |
| ----------- | --------------------------- | ----------------------------------------------------------- |
| development | Dev client APK              | `npx eas-cli@latest build --profile development -p android` |
| preview     | Release APK for sideloading | `npx eas-cli@latest build --profile preview -p android`     |
| production  | Play Store AAB              | `npx eas-cli@latest build --profile production -p android`  |

Full release instructions arrive in roadmap step 30 (`docs/BUILD.md`).

new build methode => `pnpm build:apk`
