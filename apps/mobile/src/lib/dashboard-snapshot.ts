/**
 * OFFLINE COLD-START SNAPSHOT — the dashboard's "last-known info" cache.
 *
 * Problem this solves: opening the app mid-move with no signal showed a blank
 * wall (or the error state) until the live fetch landed — useless exactly when
 * the user is standing in a half-packed kitchen on cellular dead-zone. This
 * module persists a COMPACT, read-only snapshot of what the dashboard already
 * rendered on the last SUCCESSFUL load, so the next cold start can hydrate the
 * visible UI instantly and then reconcile against the network.
 *
 * Design (mirrors src/lib/widget-data.ts deliberately):
 *   - Pure compute (`buildDashboardSnapshot`) + a tiny AsyncStorage persist/read
 *     pair. Compute never throws, never touches the network/storage.
 *   - Best-effort + NON-BLOCKING everywhere: a snapshot read/write failure must
 *     never disturb the dashboard. The live fetch is always the source of truth;
 *     the snapshot is a stale-but-useful placeholder.
 *   - Shape-guarded read-back: a malformed / old payload yields `null` (or
 *     sanitized fields), never a crash.
 *
 * PRIVACY: the snapshot carries ONLY what the dashboard already shows the signed-in
 * user on their own screen (their move route, their task titles, their own saved
 * providers' name + phone). No tokens, no auth, no other users' PII. It is the
 * same data the user could read off the screen a moment ago. Still, it lives in
 * the app's private AsyncStorage and is cleared on logout via clearDashboardSnapshot().
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatRelativeTime, getMoveCountdown } from "@locateflow/shared";

/** AsyncStorage key. Versioned so a shape change can bump without colliding. */
export const DASHBOARD_SNAPSHOT_KEY = "locateflow.dashboard.snapshot.v1";

/** A single "Up Next" task as it appears on the dashboard strip. */
export interface SnapshotTask {
  title: string;
  /** Pre-formatted short due label (e.g. "Jun 12"), or null when undated. */
  due: string | null;
}

/** A primary address chip — nickname/city/state only, no street/PII. */
export interface SnapshotAddress {
  nickname: string | null;
  city: string | null;
  state: string | null;
}

/** A saved provider the dashboard already shows (name + phone the user entered). */
export interface SnapshotProvider {
  name: string;
  phone: string | null;
}

/** Coarse budget summary — the same rounded monthly figure the stat grid shows. */
export interface SnapshotBudget {
  monthlyExpenses: number;
  serviceCount: number;
}

/**
 * The persisted dashboard snapshot. Intentionally flat + compact: it is a frozen
 * echo of the last good render, NOT a live model. Everything is optional-friendly
 * so a partial last-load still produces a useful card.
 */
export interface DashboardSnapshot {
  /** Greeting name, e.g. "Sam". null = generic greeting. */
  firstName: string | null;
  /** Whole calendar days to the move (positive=upcoming, 0=today, negative=past). */
  daysToGo: number | null;
  /** Countdown phase so the hydrated UI picks the right copy without recompute. */
  phase: "upcoming" | "today" | "past" | "none";
  /** Move route, e.g. { from: "Austin", to: "Denver" }. null fields when unknown. */
  route: { from: string | null; to: string | null } | null;
  /** ISO move date (so a re-hydrate can recompute the countdown against "now"). */
  moveDate: string | null;
  /** The next 2-3 open task titles + due labels (already sorted nearest-first). */
  nextTasks: SnapshotTask[];
  /** Move readiness 0-100 (same blend the command center shows). */
  readinessPercent: number;
  /** Primary saved addresses (nickname/city/state chips). */
  addresses: SnapshotAddress[];
  /** Saved providers the dashboard surfaces (name + phone). Capped, deduped. */
  providers: SnapshotProvider[];
  /** Coarse budget summary mirroring the stat grid. */
  budget: SnapshotBudget | null;
  /** ISO instant this snapshot was written (drives the "last updated" chip). */
  updatedAt: string;
}

/** How many of each list we keep — enough to be useful, small enough to be cheap. */
const MAX_TASKS = 3;
const MAX_ADDRESSES = 4;
const MAX_PROVIDERS = 6;

/** Coerce to a trimmed non-empty string or null. */
function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Coerce to a finite, non-negative, rounded number (defaults to 0). */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Inputs `buildDashboardSnapshot` derives the snapshot from — all already in hand. */
export interface BuildDashboardSnapshotInput {
  firstName?: string | null;
  /** Active plan's move date (date-only UTC midnight) or null. */
  moveDate?: string | null;
  /** Primary-address state → tz-correct countdown (same as the dashboard). */
  state?: string | null;
  route?: { from?: string | null; to?: string | null } | null;
  /** Open tasks (already sorted nearest-due first by the caller). */
  tasks?: Array<{ title?: string | null; due?: string | null }> | null;
  readinessPercent?: number;
  addresses?: Array<{ nickname?: string | null; city?: string | null; state?: string | null }> | null;
  providers?: Array<{ name?: string | null; phone?: string | null }> | null;
  budget?: { monthlyExpenses?: number | null; serviceCount?: number | null } | null;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

/**
 * Compute the snapshot from already-loaded dashboard data. Pure + total: never
 * throws, never touches the network or storage. Trims/dedupes/caps so the
 * persisted payload stays small and clean.
 */
export function buildDashboardSnapshot(input: BuildDashboardSnapshotInput): DashboardSnapshot {
  const now = input.now ?? new Date();

  // Countdown: reuse the SAME tz-correct helper the dashboard/widget use so the
  // hydrated number never disagrees with what the live UI will compute.
  let daysToGo: number | null = null;
  let phase: DashboardSnapshot["phase"] = "none";
  if (input.moveDate) {
    const cd = getMoveCountdown(input.moveDate, { state: input.state, now });
    if (cd.days !== null) {
      daysToGo = cd.days;
      phase = cd.phase;
    }
  }

  const route =
    input.route && (str(input.route.from) || str(input.route.to))
      ? { from: str(input.route.from), to: str(input.route.to) }
      : null;

  const nextTasks: SnapshotTask[] = (input.tasks ?? [])
    .map((tk) => ({ title: str(tk?.title), due: str(tk?.due) }))
    .filter((tk): tk is SnapshotTask => tk.title !== null)
    .slice(0, MAX_TASKS);

  const addresses: SnapshotAddress[] = (input.addresses ?? [])
    .map((a) => ({ nickname: str(a?.nickname), city: str(a?.city), state: str(a?.state) }))
    .filter((a) => a.nickname || a.city || a.state)
    .slice(0, MAX_ADDRESSES);

  // Dedupe providers by name (case-insensitive) so a multi-address user with the
  // same carrier twice doesn't repeat. Keep the first phone we see for a name.
  const providers: SnapshotProvider[] = [];
  const seenProvider = new Set<string>();
  for (const p of input.providers ?? []) {
    const name = str(p?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenProvider.has(key)) continue;
    seenProvider.add(key);
    providers.push({ name, phone: str(p?.phone) });
    if (providers.length >= MAX_PROVIDERS) break;
  }

  const budget: SnapshotBudget | null = input.budget
    ? {
        monthlyExpenses: Math.max(0, Math.round(num(input.budget.monthlyExpenses))),
        serviceCount: Math.max(0, Math.round(num(input.budget.serviceCount))),
      }
    : null;

  return {
    firstName: str(input.firstName),
    daysToGo,
    phase,
    route,
    moveDate: str(input.moveDate),
    nextTasks,
    readinessPercent: Math.max(0, Math.min(100, Math.round(num(input.readinessPercent)))),
    addresses,
    providers,
    budget,
    updatedAt: now.toISOString(),
  };
}

/**
 * Persist the snapshot to AsyncStorage. Best-effort: returns false (never throws)
 * on any failure so the dashboard load is never disturbed.
 */
export async function persistDashboardSnapshot(snapshot: DashboardSnapshot): Promise<boolean> {
  try {
    await AsyncStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Convenience: build + persist in one best-effort call. Returns the snapshot it
 * wrote (or attempted to). The dashboard uses this so the call site is one line.
 */
export async function buildAndPersistDashboardSnapshot(
  input: BuildDashboardSnapshotInput,
): Promise<DashboardSnapshot> {
  const snapshot = buildDashboardSnapshot(input);
  await persistDashboardSnapshot(snapshot);
  return snapshot;
}

/** Shape-guard a single task entry from an untrusted (parsed JSON) payload. */
function readTask(v: unknown): SnapshotTask | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const title = str(o.title);
  if (!title) return null;
  return { title, due: str(o.due) };
}

/** Shape-guard a single address entry. */
function readAddress(v: unknown): SnapshotAddress | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const a: SnapshotAddress = { nickname: str(o.nickname), city: str(o.city), state: str(o.state) };
  return a.nickname || a.city || a.state ? a : null;
}

/** Shape-guard a single provider entry. */
function readProvider(v: unknown): SnapshotProvider | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name);
  if (!name) return null;
  return { name, phone: str(o.phone) };
}

/**
 * Read the last-persisted snapshot back, FULLY shape-guarded. Returns `null` when
 * absent or unparseable; otherwise a sanitized DashboardSnapshot (every field is
 * re-validated so a partial/old/corrupt payload can never crash the hydrate).
 * Never throws.
 */
export async function readDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;

    const phase =
      o.phase === "upcoming" || o.phase === "today" || o.phase === "past" ? o.phase : "none";

    const route =
      typeof o.route === "object" && o.route !== null
        ? (() => {
            const r = o.route as Record<string, unknown>;
            const from = str(r.from);
            const to = str(r.to);
            return from || to ? { from, to } : null;
          })()
        : null;

    const budget =
      typeof o.budget === "object" && o.budget !== null
        ? (() => {
            const b = o.budget as Record<string, unknown>;
            return {
              monthlyExpenses: Math.max(0, Math.round(num(b.monthlyExpenses))),
              serviceCount: Math.max(0, Math.round(num(b.serviceCount))),
            };
          })()
        : null;

    return {
      firstName: str(o.firstName),
      daysToGo: typeof o.daysToGo === "number" && Number.isFinite(o.daysToGo) ? o.daysToGo : null,
      phase,
      route,
      moveDate: str(o.moveDate),
      nextTasks: Array.isArray(o.nextTasks)
        ? (o.nextTasks.map(readTask).filter((x): x is SnapshotTask => x !== null).slice(0, MAX_TASKS))
        : [],
      readinessPercent:
        typeof o.readinessPercent === "number" && Number.isFinite(o.readinessPercent)
          ? Math.max(0, Math.min(100, Math.round(o.readinessPercent)))
          : 0,
      addresses: Array.isArray(o.addresses)
        ? (o.addresses.map(readAddress).filter((x): x is SnapshotAddress => x !== null).slice(0, MAX_ADDRESSES))
        : [],
      providers: Array.isArray(o.providers)
        ? (o.providers.map(readProvider).filter((x): x is SnapshotProvider => x !== null).slice(0, MAX_PROVIDERS))
        : [],
      budget,
      updatedAt: str(o.updatedAt) ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Clear the snapshot (best-effort). Call on logout so a signed-out / switched
 * user never sees the previous account's last-known move info on a cold start.
 */
export async function clearDashboardSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DASHBOARD_SNAPSHOT_KEY);
  } catch {
    /* non-blocking */
  }
}

/**
 * Human "last updated …" label for the offline chip (e.g. "5 minutes ago").
 * Reuses the shared Intl relative-time helper. Returns "" on an invalid/missing
 * timestamp so the caller can fall back to a generic label.
 */
export function snapshotRelativeAge(
  snapshot: Pick<DashboardSnapshot, "updatedAt">,
  locale: string,
  now: Date = new Date(),
): string {
  if (!snapshot?.updatedAt) return "";
  const ms = new Date(snapshot.updatedAt).getTime();
  if (Number.isNaN(ms)) return "";
  return formatRelativeTime(snapshot.updatedAt, locale, now);
}
