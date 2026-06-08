# Home-Screen Widget — Setup & Verification

This is the **foundation** for the LocateFlow home-screen widget: a glanceable tile
showing the **move countdown** ("N days to go"), the **single next task**, and a
**readiness %**. This document is the exact recipe to make the widget actually
appear on a device, and — honestly — what is already verified here versus what
**requires your native EAS build + a device test**.

> **The widget will NOT appear from an OTA update.** A widget is a native
> surface (an Android `AppWidgetProvider` / an iOS WidgetKit app-extension). It
> ships only in a **new native binary** built with `eas build`, then installed on
> a device. The JS/data layer below is OTA-safe and already works; the on-device
> widget render is gated on that native build.

---

## What's verified here vs. what needs your native build

### Verified in this repo (JS/TS, typecheck + unit tests green)

- **Data layer** — `src/lib/widget-data.ts`
  - `computeWidgetSnapshot()` computes `{ daysToGo, phase, nextTaskTitle,
    readinessPercent, routeLabel, updatedAt }` from the dashboard data the app
    already loads. Countdown uses the same `getMoveCountdown` from
    `@locateflow/shared`; readiness uses the **identical blend** the in-app Move
    Command Center uses; next-task uses the same open-task selection as the Up
    Next strip.
  - `persistWidgetSnapshot()` mirrors the snapshot to **AsyncStorage**
    (`locateflow.widget.snapshot.v1`) and best-effort publishes to the native
    surfaces. `readWidgetSnapshot()` reads it back with a shape-guard.
  - **Tests:** `src/lib/widget-data.test.ts` — 18 cases (countdown phases,
    next-task selection/sorting, readiness blend/clamp, persist↔read round-trip,
    malformed-JSON guard). `pnpm --filter @locateflow/mobile exec vitest run
    src/lib/widget-data.test.ts` ✅
  - **Typecheck:** `pnpm --filter @locateflow/mobile exec tsc --noEmit` ✅
- **Dashboard wiring** — `app/(tabs)/index.tsx`
  - At the end of each dashboard load it calls `computeAndPersistWidgetSnapshot(...)`
    **additively, best-effort, never blocking** (wrapped + fire-and-forget; any
    failure is swallowed and can't disturb the dashboard).
- **Android widget UI (JS)** — `src/widgets/MoveWidget.tsx`
  - The widget tree (`FlexWidget`/`TextWidget` from `react-native-android-widget`)
    is **plain JS, so it typechecks**. `renderMoveWidget()` reads the snapshot and
    returns the tree; `widgetTaskHandler` re-renders on widget lifecycle events.
- **Config** — `app.json` (widget config plugin + iOS App Group entitlement),
  `index.js` (registers the Android widget task handler before the router boots),
  `package.json` (`main` → `index.js`, both deps added).

### NOT verifiable here — needs your native EAS build + an on-device test

- **The actual on-device widget** (Android) — native `AppWidgetProvider`
  registration + the headless render only run in a real build on a device.
- **The iOS WidgetKit render** (Swift) — `targets/widget/MoveWidget.swift` is
  **scaffolded but cannot be compiled or rendered remotely**. Every Swift/native
  file carries the header: *"UNVERIFIED — requires a native EAS build + device
  test; native rendering not checked remotely."*
- **The iOS App Group write bridge** — the JS→App Group UserDefaults hop
  (`writeSnapshotToAppGroup`) is a documented **no-op placeholder** until a native
  App Group module is wired in the build (see iOS step 3 below).

---

## Dependencies (installed)

Both installed successfully into `apps/mobile` in this session:

```bash
pnpm --filter @locateflow/mobile add react-native-android-widget     # ^0.20.3  (dep)
pnpm --filter @locateflow/mobile add -D @bacons/apple-targets        # ^4.0.7   (devDep)
```

If you ever need to reinstall, those are the exact commands.

---

## Build & install (the only way the widget appears)

A widget requires a **native build**, not an OTA update.

```bash
cd apps/mobile

# Regenerate native projects so the config plugins inject the widget targets.
# (--clean is required so @bacons/apple-targets relinks the iOS target.)
npx expo prebuild --clean

# Build a NATIVE binary (dev client or production), per platform:
pnpm build:dev:android      # or: pnpm build:android
pnpm build:dev:ios          # or: pnpm build:ios   (needs an Apple paid dev account for App Groups)
```

Then **install the build on a device** and **add the widget**:

- **Android:** long-press the home screen → **Widgets** → find **"LocateFlow
  Move"** → drag to the home screen.
- **iOS:** long-press the home screen → **+** (top-left) → search **"LocateFlow
  Move"** → add. (WidgetKit widgets do not show in the simulator's widget gallery
  as reliably as on a real device — prefer a device.)

Open the app once (so the dashboard runs and writes a snapshot), then check the
widget. After the first load it shows your real countdown / next task / readiness.

---

## Platform wiring details

### Android (`react-native-android-widget`)

1. **Config plugin** — `app.json` → `plugins` has:
   ```json
   ["react-native-android-widget", { "widgets": [{ "name": "MoveWidget", ... }] }]
   ```
   The widget `name` **must** match the `widgetName` used in
   `requestWidgetUpdate` and `registerWidgetTaskHandler` (both `"MoveWidget"`).
2. **Task handler registration** — `index.js` (the app's `main`) calls
   `registerWidgetTaskHandler(widgetTaskHandler)` **before** `expo-router/entry`.
   This runs in a headless JS context when the OS updates the widget, so it must
   be at the entry point, outside any component. It's guarded so a missing native
   module is a no-op (web / non-widget builds boot normally).
3. **Updates** — `requestAndroidWidgetUpdate()` (called from
   `persistWidgetSnapshot`) asks the OS to re-render the pinned widget; the OS
   calls `renderMoveWidget()`, which reads the latest snapshot from AsyncStorage.
   The config also sets `updatePeriodMillis: 1800000` (30 min, the platform
   minimum) as a safety-net refresh.

### iOS (WidgetKit via `@bacons/apple-targets`) — UNVERIFIED, needs your build

1. **Config plugin** — `app.json` → `plugins` includes `"@bacons/apple-targets"`,
   which auto-discovers `targets/widget/` (the `expo-target.config.js` +
   `MoveWidget.swift`) on `expo prebuild --clean` and links a WidgetKit extension
   target into the Xcode project.
2. **App Group** — `app.json` → `ios.entitlements`
   (`"com.apple.security.application-groups": ["group.com.locateflow.mobile.widget"]`)
   is mirrored to the widget target by `expo-target.config.js`. This is the
   shared container the extension reads. **App Groups require a paid Apple
   Developer account** and the group registered on the Apple Developer portal /
   in your EAS credentials.
3. **The JS → App Group bridge (TODO on the native build).** The iOS WidgetKit
   extension reads `UserDefaults(suiteName: "group.com.locateflow.mobile.widget")`
   for key `locateflow.widget.snapshot.v1`. The data layer exposes
   `writeSnapshotToAppGroup()` as the seam, but it is a **no-op placeholder**
   today — React Native's default AsyncStorage does **not** write to an App Group.
   To finish iOS, on the native build wire one of:
   - a tiny native module (or `expo-app-group-storage`-style helper) that does
     `UserDefaults(suiteName: WIDGET_APP_GROUP).set(json, forKey: WIDGET_SNAPSHOT_KEY)`
     then `WidgetCenter.shared.reloadAllTimelines()`, and call it from
     `writeSnapshotToAppGroup`; **or**
   - configure AsyncStorage's iOS App Group support so its backing store is the
     group container, then point the Swift `UserDefaults(suiteName:)` at the same
     key.
   Until that lands, the **Android** widget is fully driven by the JS snapshot and
   the **iOS** widget renders its empty/placeholder state.
4. **Keys must stay in sync** across three places:
   - `src/lib/widget-data.ts` → `WIDGET_APP_GROUP`, `WIDGET_SNAPSHOT_KEY`
   - `app.json` → `ios.entitlements[...application-groups]`
   - `targets/widget/expo-target.config.js` + `targets/widget/MoveWidget.swift`

---

## Caveats / honesty notes

- **OTA can ship the data + JS widget UI, but NOT the native surface.** Once a
  native build with the widget exists, snapshot/data changes do flow OTA; adding
  or changing the *widget target itself* needs a new native build.
- **iOS is partially unverified by design.** The Swift extension and the App Group
  write path can only be validated on your `eas build` + device. The header
  comment on every Swift file says exactly that.
- **No new permissions / data collection.** The widget only mirrors data the app
  already has locally; nothing new is sent off-device.
- **Best-effort everywhere.** The dashboard wiring, the native publish calls, and
  the registration are all wrapped so they can never break app boot or the
  dashboard load.

## Verify-it-yourself checklist

```bash
# JS/TS foundation (works here):
pnpm --filter @locateflow/mobile exec tsc --noEmit
pnpm --filter @locateflow/mobile exec vitest run src/lib/widget-data.test.ts

# Native (needs your machine + device — NOT verifiable remotely):
cd apps/mobile && npx expo prebuild --clean
pnpm build:dev:android   # add the "LocateFlow Move" widget on a device
pnpm build:dev:ios       # iOS render pending the App Group bridge (see above)
```
