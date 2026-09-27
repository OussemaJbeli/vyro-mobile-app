# 13 — Exercise Library & Alternatives

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 12 |
| Spec refs | FS §11, §12, §73, §79 · UI §15, §16 |
| Output | Searchable, filterable library, exercise detail, custom exercises, alternative editing, and the deterministic **alternative engine** |

## Objective

Make the library fast to browse and make equipment awareness a visible superpower. When equipment is missing, the app proposes compatible alternatives without AI (UI §16).

## Alternative engine (`src/domain/workouts/alternatives.ts`)

Pure function, fully unit-tested:

```ts
suggestAlternatives(
  exercise: ExerciseWithEquipment,
  ctx: { available: Set<EquipmentId>; library: ExerciseWithEquipment[]; mappings: AlternativeMapping[] },
  limit = 3,
): Suggestion[]   // { exercise, reason: 'mapped' | 'same_muscle_equipment_ok', score }
```

Algorithm:

1. **Mapped alternatives** first, sorted by `priority`, keeping only those whose required equipment is all available.
2. If fewer than `limit`, add **heuristic** candidates: same `primary_muscle`, same `tracking` family, all equipment available, not archived. Score = shared secondary muscles + difficulty closeness + "is bodyweight" bonus when nothing else is available.
3. Never suggest the exercise itself or an unavailable one. Return the reason so the UI can say *why* ("Same muscles · uses Dumbbells").

`isAvailable(exercise, available)` returns true when every required equipment is available. It is used across the Train list, builder and execution.

## Screens

### Library (`exercise/index`), also reachable from Train
- [x] Search bar (local `LIKE` over name and translated name, debounced 150 ms).
- [x] Filter chips: category (Chest, Back, Shoulders, Arms, Legs, Core, Full body, Cardio, Mobility), "Available with my equipment", "Custom".
- [x] Rows: name, primary muscle, equipment icons, and an **"Unavailable"** tag (icon + text) when equipment is missing.
- [x] Sections grouped by category. `FlashList` (or `FlatList` with `getItemLayout`) for 70+ rows.

### Detail (`exercise/[id]`)
- [x] Muscles (primary highlighted, secondary list), equipment with availability ticks, instructions as numbered steps, defaults (sets × reps / duration / rest).
- [x] "Alternatives" section: mapped ones with priority plus live suggestions. Each row shows its availability.
- [x] Personal stats placeholder (best set, last done). Populated in step 24.
- [x] Actions: Edit (custom exercises fully, seeded ones rename/notes/defaults only), Archive, Duplicate as custom.

### Create/Edit custom (`exercise/new`)
- [x] Name, category, primary muscle (picker), secondary muscles (multi), tracking type, equipment (multi), defaults, difficulty, instructions, alternatives (search and add, drag to set priority).

## Tasks

- [x] Implement the engine plus tests: unavailable-equipment scenario (cable_fly with no cable → dumbbell_fly), nothing-available scenario (falls back to bodyweight), and a cyclical mappings sanity check.
- [x] Screens and components: `ExerciseRow`, `EquipmentIcons`, `MuscleChips`, `AlternativeRow`.
- [x] An "Unavailable" state never relies on colour only (icon + label).

## Acceptance criteria

- [x] Search results appear in under 50 ms for the seed library on a mid-range device.
- [x] Turning off "Cable machine" in Equipment makes cable exercises show "Unavailable", and their detail suggests valid alternatives.
- [x] A custom exercise can be created, edited, given alternatives and archived. Archived exercises disappear from pickers but remain in history.

## Execution log (2026-09-26)

- **Engine** (`src/domain/workouts/alternatives.ts`): `isAvailable()` (every required item; bodyweight is always available) and `suggestAlternatives()`: mapped alternatives by priority, filtered to what you can do, then same-muscle exercises in the same tracking family (weight/reps ≈ reps; duration and distance separate). Scoring: shared secondary muscles, difficulty closeness, and a bodyweight bonus that grows when little equipment is available. Order is stable, and each suggestion carries a reason (`mapped` / `same_muscle`). Tests: cable fly without a cable machine → dumbbell fly first, no equipment → bodyweight, no cross-family picks, limit and stability, cyclical/self mappings.
- **Catalog hook** (`src/hooks/useExerciseCatalog.ts`): the library, equipment and translated names in memory, plus the engine context. Search is accent- and case-insensitive over both the translated and stored names. A seeded row shows its translated name until renamed (`src/utils/seedNames.ts`).
- **Library** (`/exercise`): search, All/Available/Custom scope, category chips, count, a SectionList grouped by category, "Unavailable" shown with icon and text, empty states, and "New exercise". Reachable from the Train tab placeholder until step 14.
- **Detail** (`/exercise/[id]`): primary and secondary muscles, equipment with ✓/unavailable, defaults and rest, numbered instructions, up to 5 alternatives with the reason line, a stats placeholder (step 24), Edit, Duplicate as custom (`exerciseRepo.duplicate` copies equipment and alternatives), and Archive/Restore for custom exercises.
- **Form** (`/exercise/new`, `?id=` to edit): custom exercises edit everything, including ordered alternatives (add from a searchable sheet, move up/down, remove). Library exercises: name and defaults only. Invalid submits show a toast.
- New `exercises` namespace (EN/FR) with categories, 29 muscles, tracking, difficulty and form labels.
- **Bug found and fixed (affects steps 12–13):** after a successful save, the unsaved-changes guard blocked the post-save navigation and showed "Discard changes?". `useUnsavedGuard` now returns `{ dialog, leave }`; `leave(go)` switches the guard off and navigates on the next render. The profile, goal and exercise forms use it. The form test now fails if the guard is still blocking at redirect (verified by reverting the fix).
- **Test infrastructure:** Jest now mocks Reanimated 4 and Worklets (official mocks) so full screens render in tests. `createQueryClient({ forTests: true })` disables the query garbage-collection timers that kept Jest from exiting.
- Headless web pass: 68 exercises, search, cable machine off → Cable Fly "Unavailable" with Dumbbell Fly as the recommended alternative, create a custom exercise, profile save returns to Settings. Zero console errors.
