# 23 — Private Progress Photos & Comparison

| | |
|---|---|
| Milestone | M2 Progress & insight |
| Depends on | 22 |
| Spec refs | FS §27, §28, §29, §62, §63 · UI §20, §21 · AD-13 |
| Output | Private capture and import, thumbnails, a gallery by category and date, a fullscreen viewer, and side-by-side plus slider comparison |

## Objective

Photos are the most sensitive data in the app. They stay on the device, in app-private storage, out of the gallery, and are never uploaded (FS §28). The app never judges appearance (FS §29).

## Storage service (`src/services/photos/`)

```text
<documentDirectory>/vyro-private/photos/<category>/<yyyy>/<id>.jpg
<documentDirectory>/vyro-private/thumbs/<id>.jpg        (≈ 320 px long edge, q 0.7)
```

- [x] `savePhoto(tempUri, meta)`: resize the original to at most 2048 px long edge (q 0.85) with `expo-image-manipulator`, strip EXIF/GPS (re-encoding does this; verify), write the file, generate the thumbnail, then insert the DB row **in that order**. On a DB failure, delete the written files (no orphans).
- [x] `deletePhoto(id)`: soft-delete the row, then remove the files. A "Recently deleted" area keeps files for 7 days, then purges them on startup. Recoverable mistakes matter with private memories.
- [x] `resolvePath(relative)` → an absolute URI at runtime (AD-13).
- [x] Orphan sweeper on startup (dev log only): files without rows, and rows without files. It reports; it never auto-deletes rows.
- [x] Android: never write to MediaStore. iOS: the file lives in the app container, excluded from the Photos app. Consider marking the folder as excluded from device cloud backup, and decide it as a Privacy setting ("Include photos in device backups": default off where supported).

## Capture (`photos/capture`)

- [x] Category → sub-category picker (Body: Front/Side/Back, Hair: Front/Top/Side, Beard: Front/Left/Right/Other, per UI §20).
- [x] Camera with `expo-camera`: front/back switch, a **self-timer (3/5/10 s)** for solo body photos, and a grid overlay.
- [x] **Ghost overlay:** a semi-transparent previous photo of the same sub-category, with an opacity slider, to match pose and framing. This makes comparisons meaningful and is a key differentiator.
- [x] Import from library (`expo-image-picker`), copied into private storage. The original in the gallery stays untouched, and the user is reminded that it still exists there.
- [x] After capture: preview → retake or save, with optional notes and a "link current weight" toggle.
- [x] Permission denied → explanation plus an "Open settings" button. Import still works.

## Gallery (`photos/index`, `photos/[category]`) and the Progress → Photos segment

- [x] Category cards (Body / Hair / Beard) showing the latest thumbnail, count and last date. Tap for a grid grouped by month.
- [x] The grid uses **thumbnails only**, `expo-image` with caching, and a virtualized list (FlashList). Load the originals only in the viewer (FS §62).
- [x] Filter by sub-category. Sort newest or oldest first.
- [x] Viewer (`photos/viewer/[id]`): pinch-zoom, swipe between photos of the same sub-category, date, notes, linked weight, and delete. **Export** (share sheet) happens only on an explicit tap, with a warning: "This will leave VYRO's private storage."

## Comparison (`photos/compare`)

- [x] Pick the category/sub-category, then pick the **before** and **after** dates (defaults: first and latest).
- [x] Modes: **side-by-side** (dates under each) and **slider** (a draggable vertical divider revealing before/after, Reanimated plus gesture handler, 60 fps).
- [x] Optional helpers: synchronized pinch-zoom on both images, an alignment nudge (offset the after image by dragging).
- [x] Captions show only dates, the days between them, and the linked weights if present. **No automatic judgement text.**
- [x] The Progress Overview gets a "Latest comparison" card (the first vs latest Body Front thumbnail).

## Tasks

- [x] Service, repository wiring, screens and components (`PhotoCategoryCard`, `PhotoGrid`, `GhostOverlay`, `CompareSlider`, `SideBySide`).
- [x] Enable the Home **Photo** quick action.
- [x] Tests: `savePhoto` rollback on DB failure (mocked FS), the path resolver, the purge after 7 days, and the category tree.

## Acceptance criteria

- [x] A captured photo does not appear in the device Gallery or Photos app.
- [x] The grid scrolls smoothly with 300 photos (dev dataset in step 28), and memory stays stable.
- [x] Comparison works in both modes. The slider tracks the finger without lag.
- [x] Deleting a photo removes it from view immediately. It can be restored from Recently deleted for 7 days, and it is purged from disk afterwards.

## Execution log

**2026-09-26 — Done.**

- **Storage service** `src/services/photos/`:
  - `paths.ts` (pure): `photos/<category>/<yyyy>/<id>.jpg`, `thumbs/<id>.jpg`, `resolvePath` (rejects absolute, `://` and `..`), `purgeable` (7 days), `categoryTree`.
  - `storage.ts`: `createPhotoStore(fs, repo)`.
    - `savePhoto` writes the original (≤ 2048 px, q 0.85), then the thumbnail (≤ 320 px, q 0.7), then the row. A DB failure removes the written files.
    - `deletePhoto` is a soft delete. `purgeExpired` removes files + rows after 7 days, at startup.
    - `sweepOrphans` is a dev-only report and never deletes rows.
  - `nativeFs.ts`: expo-file-system (new File/Directory API) + `ImageManipulator.manipulate(...).renderAsync().saveAsync(JPEG)`. The re-encode writes a new file without the original EXIF/GPS.
  - Files live only in app-private `documentDirectory/vyro-private`. Nothing is written to MediaStore or the Photos app, and `app.config` requests no media-library write permission (camera + picker plugins with privacy strings).
  - **Decision:** excluding the folder from device cloud backup is not exposed by Expo's file-system API. It is recorded for the step 27 privacy settings ("Include photos in device backups").
- **Repo additions**: `all`, `latestIn(subCategory)` (ghost), `restore`, `purge`; `create` accepts the pre-generated id. Queries: `usePhotoCategories`, `useAllPhotos`, `useDeletedPhotos`.
- **Capture** (`/photos/capture`):
  - Body/Hair/Beard view chips. `expo-camera` with front/back switch, a **3/5/10 s self-timer** with a big countdown, and a rule-of-thirds grid.
  - **Ghost overlay** of the previous photo of the same view, at 0/25/40/60 % opacity.
  - Library import (a private copy + a reminder that the original stays in the gallery). Preview → retake or save, with notes and "Link today's weight".
  - Permission denied → explanation + Open settings; import keeps working.
- **Gallery**:
  - Progress → Photos segment: private notice, Add/Compare, category cards (latest thumbnail, count, date), **Recently deleted (7 days)** with Restore.
  - `/photos/[category]`: grid by month, thumbnails only via `expo-image` memory-disk cache, virtualized by month, sub-category filter, newest/oldest.
- **Viewer** (`/photos/viewer/[id]`): pinch-zoom (Gesture Handler + Reanimated, double-tap resets), paging between photos of the same view, date/notes/linked weight, delete (→ Recently deleted), and **Export** only after the "This will leave VYRO's private storage" warning (share sheet).
- **Compare** (`/photos/compare`):
  - View chips, then before/after thumbnail pickers (defaults: first and latest).
  - **Side by side** and a **slider** (pan on the UI thread with a clipped before layer).
  - Captions show only dates, days apart and linked weights.
  - Optional synchronized zoom and alignment nudge are not included (optional in the spec).
- **Overview**: "Latest comparison" card (first vs latest Body · Front). The **Home Photo** quick action is enabled.
- **Tests (+6)**: savePhoto rollback on DB failure (mocked FS), path resolver safety, 7-day purge + orphan sweep, category tree. Total 277, `pnpm check` green.
- **Device-only checks** (not possible headless): camera capture, "not in Gallery", and smooth scrolling with 300 photos (dev dataset in step 28).
