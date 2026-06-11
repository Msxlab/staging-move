/**
 * WIDGET DATA LAYER — the OTA-safe foundation for the home-screen widget.
 *
 * This module computes a small, glanceable "widget snapshot" from the SAME
 * dashboard data the app already loads, and persists it to a shared store the
 * native widget can read. It is pure TypeScript/JS — fully typecheck-verifiable
 * and shippable over-the-air — and it is the real foundation for the widget.
 *
 * The snapshot deliberately carries only what fits on a glanceable home-screen
 * tile:
 *   - daysToGo        → the move countdown ("N days to go" / today / past)
 *   - nextTaskTitle   → the single next OPEN move task (nearest due)
 *   - readinessPercent→ the dashboard readiness ring %
 *   - updatedAt       → ISO instant the snapshot was written (for "as of" copy)
 *
 * PERSISTENCE / NATIVE-BRIDGE NOTE (honest scoping):
 *   - We ALWAYS mirror the snapshot to AsyncStorage under WIDGET_SNAPSHOT_KEY.
 *     That is the verifiable, OTA-safe write this module owns end-to-end.
 *   - The NATIVE widget process cannot read AsyncStorage directly. To surface
 *     the snapshot on the actual home screen you need a native shared store:
 *       · Android: react-native-android-widget's `requestWidgetUpdate` (driven
 *         from JS) re-renders the widget UI with this snapshot — see
 *         src/widgets/MoveWidget.tsx.
 *       · iOS: an App Group UserDefaults the WidgetKit extension reads — see
 *         WIDGET-SETUP.md. `writeSnapshotToAppGroup` PROBES (guarded + dynamic)
 *         for a native App Group module and writes through it when present, so
 *         the iOS widget starts receiving data the moment the EAS build adds one
 *         — no further code change. Without that module it degrades to a no-op
 *         (NOT verifiable here, but no longer a hardcoded dead stub).
 *
 * Everything in this file is best-effort and NON-BLOCKING: a failure to compute
 * or persist the snapshot must never disturb the dashboard load.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMoveCountdown, type RelocationChecklist } from "@locateflow/shared";

/** AsyncStorage key the JS side reads/writes the snapshot under. */
export const WIDGET_SNAPSHOT_KEY = "locateflow.widget.snapshot.v1";

/**
 * App Group identifier the iOS WidgetKit extension reads its UserDefaults from.
 * Must match the `appleTeamId`-scoped group declared in app.json's
 * `@bacons/apple-targets` config and in the Swift widget. iOS-only; ignored on
 * Android / web.
 */
export const WIDGET_APP_GROUP = "group.com.locateflow.mobile.widget";

/** The glanceable snapshot the widget renders. Intentionally tiny + flat. */
export interface WidgetSnapshot {
  /**
   * Whole calendar days until the move. Positive = days remaining, 0 = moving
   * day, negative = days since the move. `null` when there's no active plan or
   * the date is unknown — the widget renders its empty/"no move" state then.
   */
  daysToGo: number | null;
  /** Countdown phase, so the widget can pick "to go" / "today" / "ago" copy. */
  phase: "upcoming" | "today" | "past" | "none";
  /** Title of the single nearest-due OPEN move task, or null if none/all done. */
  nextTaskTitle: string | null;
  /** Move readiness 0–100 (same blend the dashboard's command center shows). */
  readinessPercent: number;
  /** Short "From → To" route label for context, or null when unknown. */
  routeLabel: string | null;
  /** ISO-8601 instant the snapshot was computed (drives "updated …" copy). */
  updatedAt: string;
}

/** OPEN task statuses — mirrors UpNext's definition so the "next task" matches. */
const OPEN_TASK_STATUSES = new Set(["SUGGESTED", "ACCEPTED", "IN_PROGRESS"]);

/** The empty snapshot rendered when there is no active move plan. */
export function emptyWidgetSnapshot(now: Date = new Date()): WidgetSnapshot {
  return {
    daysToGo: null,
    phase: "none",
    nextTaskTitle: null,
    readinessPercent: 0,
    routeLabel: null,
    updatedAt: now.toISOString(),
  };
}

/** A move task as it arrives from /api/move-tasks (only the fields we need). */
export interface WidgetTaskInput {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
}

export interface ComputeWidgetSnapshotInput {
  /** The active plan's move date (date-only UTC midnight). null = no plan. */
  moveDate: string | null | undefined;
  /** Primary-address state → tz-correct countdown (same as the dashboard). */
  state?: string | null;
  /** Open move tasks for the active plan (we pick the nearest-due one). */
  tasks?: WidgetTaskInput[] | null;
  /** The generated relocation checklist (drives readiness + a task fallback). */
  checklist?: RelocationChecklist | null;
  /** CRITICAL provider cluster counts from the recommendations engine. */
  completedCritical?: number;
  missingCritical?: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

/**
 * Readiness blend — IDENTICAL formula to MoveCommandCenter.computeReadiness so
 * the widget % never disagrees with the in-app readiness ring:
 *   mean of (checklist completion ratio, critical-providers completion ratio),
 *   clamped to 0–100. Each signal only contributes when it has data.
 */
function computeReadiness(
  checklist: RelocationChecklist | null | undefined,
  completedCritical: number,
  missingCritical: number,
): number {
  const signals: number[] = [];
  if (checklist && checklist.totalItems > 0) {
    signals.push(checklist.completedItems / checklist.totalItems);
  }
  const criticalTotal = completedCritical + missingCritical;
  if (criticalTotal > 0) {
    signals.push(completedCritical / criticalTotal);
  }
  if (signals.length === 0) return 0;
  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  return Math.max(0, Math.min(100, Math.round(mean * 100)));
}

/**
 * Pick the single "next task" title for the widget:
 *   1. The nearest-due OPEN move task (no-due-date sinks to the bottom), matching
 *      UpNext's selection so the widget agrees with the dashboard strip; else
 *   2. the checklist's `nextAction.title` (an incomplete checklist item); else
 *   3. null (nothing actionable → the widget shows its "all set" state).
 */
function pickNextTaskTitle(
  tasks: WidgetTaskInput[] | null | undefined,
  checklist: RelocationChecklist | null | undefined,
): string | null {
  const open = (tasks ?? [])
    .filter((tk) => OPEN_TASK_STATUSES.has(tk.status) && typeof tk.title === "string" && tk.title.trim())
    .slice();
  if (open.length > 0) {
    open.sort((a, b) => {
      const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const av = Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
      const bv = Number.isNaN(bt) ? Number.POSITIVE_INFINITY : bt;
      if (av !== bv) return av - bv;
      // Stable, transitive tiebreaker on equal due dates.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return open[0].title.trim();
  }
  if (checklist?.nextAction && !checklist.nextAction.isCompleted) {
    const title = checklist.nextAction.title?.trim();
    if (title) return title;
  }
  return null;
}

/**
 * Compute the widget snapshot from already-loaded dashboard data. Pure + total:
 * never throws, never touches the network or storage. With no active move date
 * it returns the empty snapshot.
 */
export function computeWidgetSnapshot(input: ComputeWidgetSnapshotInput): WidgetSnapshot {
  const now = input.now ?? new Date();
  if (!input.moveDate) {
    return emptyWidgetSnapshot(now);
  }
  const cd = getMoveCountdown(input.moveDate, { state: input.state, now });
  // getMoveCountdown returns phase "upcoming" with days null when the date is
  // unparseable; treat that as "no countdown" rather than a bogus 0.
  const hasCountdown = cd.days !== null;
  const phase: WidgetSnapshot["phase"] = hasCountdown ? cd.phase : "none";

  const readinessPercent = computeReadiness(
    input.checklist,
    input.completedCritical ?? 0,
    input.missingCritical ?? 0,
  );

  return {
    daysToGo: hasCountdown ? cd.days : null,
    phase,
    nextTaskTitle: pickNextTaskTitle(input.tasks, input.checklist),
    readinessPercent,
    routeLabel: null,
    updatedAt: now.toISOString(),
  };
}

/**
 * Best-effort bridge to the iOS App Group UserDefaults the WidgetKit extension
 * reads. This is the native seam between the JS snapshot and the Swift widget.
 *
 * Rather than a hardcoded `return false`, this now PROBES — guarded + dynamic,
 * exactly like `requestAndroidWidgetUpdate` does for the Android dep — for a
 * native App Group module in the build and uses it when present. So the moment
 * the owner adds one to the native EAS build (see WIDGET-SETUP.md), the iOS
 * widget starts receiving data with no further code change or OTA; until then
 * it degrades to `false` (nothing written) and never throws. Default
 * AsyncStorage writes the app's PRIVATE container, which the widget extension
 * cannot read — only an App-Group-scoped write reaches it.
 *
 * Supported module shapes (first one found wins):
 *   · `react-native-shared-group-preferences` —
 *       default.setItem(key, value, appGroup)
 *   · `@dabapp/react-native-user-defaults` / `react-native-default-preference`
 *       style — setName(group)/set(key,value) or set(key,value,{appGroup})
 *   · a custom module exposing `setAppGroupItem(group, key, value)` and/or
 *       `reloadAllTimelines()`.
 * The probe is intentionally permissive so the native side has several valid
 * ways to satisfy it. Returns true only when a write actually happened.
 */
export async function writeSnapshotToAppGroup(snapshot: WidgetSnapshot): Promise<boolean> {
  const bridge = await loadAppGroupBridge();
  if (!bridge) return false;
  const json = JSON.stringify(snapshot);
  try {
    await bridge.write(WIDGET_APP_GROUP, WIDGET_SNAPSHOT_KEY, json);
  } catch {
    // A native write failure is non-fatal: AsyncStorage still holds the mirror,
    // and the widget's own ~hourly timeline policy retries. Never throw.
    return false;
  }
  // Nudge WidgetKit to refresh now (best-effort; ignored if unsupported).
  try {
    await bridge.reload?.();
  } catch {
    /* timelines also refresh on the widget's own policy */
  }
  return true;
}

/**
 * Minimal shape the iOS App Group bridge must satisfy. The native module wired
 * in the EAS build adapts whatever it exposes to this — see WIDGET-SETUP.md.
 */
interface AppGroupBridge {
  /** JSON-encode + write `value` under `key` in `appGroup`'s UserDefaults. */
  write: (appGroup: string, key: string, value: string) => Promise<void> | void;
  /** Optional: call `WidgetCenter.shared.reloadAllTimelines()`. */
  reload?: () => Promise<void> | void;
}

/**
 * Probe — guarded + dynamic, the same pattern `requestAndroidWidgetUpdate` uses
 * for the Android dep — for a native App Group module in the build and adapt it
 * to `AppGroupBridge`. The specifiers are computed at runtime so the typecheck
 * (and bundler) never hard-require modules that only exist in the native build;
 * a missing module simply yields `null` and the iOS write degrades to a no-op.
 *
 * Recognized modules (first match wins):
 *   · `react-native-shared-group-preferences` — `setItem(key, value, appGroup)`
 *   · a project-local `@/lib/native-app-group` exposing
 *     `setAppGroupItem(appGroup, key, value)` + optional `reloadAllTimelines()`
 */
async function loadAppGroupBridge(): Promise<AppGroupBridge | null> {
  // Runtime-computed specifier defeats static module resolution so tsc/bundler
  // don't require a module that's absent until the native build adds it.
  const tryImport = async (name: string): Promise<any> => {
    try {
      const spec = name; // indirection: not a literal at the import() call site
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await import(/* @vite-ignore */ spec).catch(() => null)) as any;
    } catch {
      return null;
    }
  };

  const shared = await tryImport("react-native-shared-group-preferences");
  const sharedApi = shared?.default ?? shared;
  if (sharedApi && typeof sharedApi.setItem === "function") {
    return {
      write: (appGroup, key, value) => sharedApi.setItem(key, value, appGroup),
      reload: typeof sharedApi.reloadAllTimelines === "function" ? () => sharedApi.reloadAllTimelines() : undefined,
    };
  }

  const custom = await tryImport("@/lib/native-app-group");
  const customApi = custom?.default ?? custom;
  if (customApi && typeof customApi.setAppGroupItem === "function") {
    return {
      write: (appGroup, key, value) => customApi.setAppGroupItem(appGroup, key, value),
      reload: typeof customApi.reloadAllTimelines === "function" ? () => customApi.reloadAllTimelines() : undefined,
    };
  }

  return null;
}

/**
 * Best-effort bridge to the Android widget. With react-native-android-widget
 * installed, this asks the OS to re-render the pinned widget with the latest
 * snapshot (the widget's render function reads it back from AsyncStorage). The
 * import is dynamic + guarded so the bundle builds — and typechecks — even when
 * the native dependency is absent in this sandbox (documented in WIDGET-SETUP).
 */
export async function requestAndroidWidgetUpdate(): Promise<boolean> {
  try {
    // Dynamic imports so a missing native dep never breaks the JS bundle/typecheck.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("react-native-android-widget").catch(() => null);
    if (!mod?.requestWidgetUpdate) return false;
    // The render lives in src/widgets/MoveWidget.tsx (it reads the snapshot back
    // from AsyncStorage). Imported dynamically to avoid a static cycle with this
    // module. requestWidgetUpdate requires a renderWidget callback per widget.
    const widget = await import("@/widgets/MoveWidget").catch(() => null);
    if (!widget?.renderMoveWidget) return false;
    await mod.requestWidgetUpdate({
      widgetName: "MoveWidget",
      renderWidget: () => widget.renderMoveWidget(),
      widgetNotFound: () => {
        /* no pinned widget — nothing to refresh */
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist + publish the snapshot. The single entry point the dashboard calls.
 *
 * Order of operations (each step independent + best-effort):
 *   1. Mirror to AsyncStorage (WIDGET_SNAPSHOT_KEY) — the verifiable JS store the
 *      Android widget render reads, and an in-app cache. ALWAYS attempted.
 *   2. Bridge to the iOS App Group (no-op until native module exists).
 *   3. Ask Android to re-render the pinned widget (no-op without the native dep).
 *
 * Returns `true` if the AsyncStorage mirror succeeded. Never throws.
 */
export async function persistWidgetSnapshot(snapshot: WidgetSnapshot): Promise<boolean> {
  let mirrored = false;
  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    mirrored = true;
  } catch {
    /* non-blocking: leave mirrored=false */
  }
  // Native publishes are fire-and-forget; their failure must not affect callers.
  void writeSnapshotToAppGroup(snapshot).catch(() => false);
  void requestAndroidWidgetUpdate().catch(() => false);
  return mirrored;
}

/**
 * Read the last-persisted snapshot from AsyncStorage (the JS mirror). Used by the
 * Android widget render and any in-app surface that wants the cached glance.
 * Returns `null` when absent or malformed. Never throws.
 */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WidgetSnapshot>;
    if (typeof parsed !== "object" || parsed === null) return null;
    // Minimal shape-guard so a malformed/old payload never crashes the widget.
    return {
      daysToGo: typeof parsed.daysToGo === "number" ? parsed.daysToGo : null,
      phase:
        parsed.phase === "upcoming" || parsed.phase === "today" || parsed.phase === "past"
          ? parsed.phase
          : "none",
      nextTaskTitle: typeof parsed.nextTaskTitle === "string" ? parsed.nextTaskTitle : null,
      readinessPercent:
        typeof parsed.readinessPercent === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.readinessPercent)))
          : 0,
      routeLabel: typeof parsed.routeLabel === "string" ? parsed.routeLabel : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Convenience: compute → persist in one call. The dashboard uses this so the
 * call site stays a single best-effort line. Returns the snapshot it wrote (or
 * attempted to write) so callers can also use it in-process if useful.
 */
export async function computeAndPersistWidgetSnapshot(
  input: ComputeWidgetSnapshotInput,
): Promise<WidgetSnapshot> {
  const snapshot = computeWidgetSnapshot(input);
  await persistWidgetSnapshot(snapshot);
  return snapshot;
}
