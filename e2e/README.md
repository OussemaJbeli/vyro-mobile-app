# e2e (Maestro, step 29)

Flows for the release-like `preview` build on an emulator or a USB device.

```bash
# once: https://maestro.mobile.dev (needs Java 17 and adb)
curl -fsSL "https://get.maestro.mobile.dev" | bash
adb install vyro-preview.apk
maestro test e2e/flows            # the whole suite
maestro test e2e/flows/execute_gym_workout.yaml
```

- `subflows/fresh_install_skip.yaml` clears app data and skips onboarding. After that, the
  default routine (docs/plan/weak.md) is applied, so every day already has sessions.
- Selectors are the app's `testID`s (Maestro `id:`) plus visible English text. Run with the
  device language set to English.
- **Status:** written against the current testIDs but **not run yet** (no emulator in the
  dev environment). The first emulator run will need small selector fixes; record them in
  `docs/roadmap/qa-issues.md` and re-run until three consecutive passes.
- `export_import_roundtrip` stops at the system share sheet / file picker (system UI);
  finish that part by hand.
