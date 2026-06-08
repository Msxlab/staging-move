import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory AsyncStorage so persist/read round-trips deterministically.
const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

// The data layer dynamically imports the native widget module + the widget JSX.
// Stub both so persist() can run its (no-op) native publish step in node.
vi.mock("react-native-android-widget", () => ({
  requestWidgetUpdate: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/widgets/MoveWidget", () => ({
  renderMoveWidget: vi.fn(() => Promise.resolve(null)),
}));

import {
  computeWidgetSnapshot,
  emptyWidgetSnapshot,
  persistWidgetSnapshot,
  readWidgetSnapshot,
  computeAndPersistWidgetSnapshot,
  WIDGET_SNAPSHOT_KEY,
  type ComputeWidgetSnapshotInput,
} from "./widget-data";

// A fixed "now" so countdowns are deterministic. Move dates are date-only UTC
// midnight per the app convention.
const NOW = new Date("2026-06-08T12:00:00.000Z");

function baseInput(over: Partial<ComputeWidgetSnapshotInput> = {}): ComputeWidgetSnapshotInput {
  return { moveDate: null, now: NOW, ...over };
}

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

describe("computeWidgetSnapshot — countdown", () => {
  it("returns the empty snapshot when there is no move date", () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate: null }));
    expect(snap.daysToGo).toBeNull();
    expect(snap.phase).toBe("none");
    expect(snap.nextTaskTitle).toBeNull();
    expect(snap.readinessPercent).toBe(0);
  });

  it("computes positive days-to-go for an upcoming move", () => {
    // 2026-06-21 is 13 days after 2026-06-08.
    const snap = computeWidgetSnapshot(baseInput({ moveDate: "2026-06-21T00:00:00.000Z" }));
    expect(snap.daysToGo).toBe(13);
    expect(snap.phase).toBe("upcoming");
  });

  it("flags moving day as phase=today, days=0", () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate: "2026-06-08T00:00:00.000Z" }));
    expect(snap.daysToGo).toBe(0);
    expect(snap.phase).toBe("today");
  });

  it("reports negative days for a past move", () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate: "2026-06-05T00:00:00.000Z" }));
    expect(snap.daysToGo).toBe(-3);
    expect(snap.phase).toBe("past");
  });

  it("treats an unparseable date as no-countdown", () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate: "not-a-date" }));
    expect(snap.daysToGo).toBeNull();
    expect(snap.phase).toBe("none");
  });
});

describe("computeWidgetSnapshot — next task", () => {
  const moveDate = "2026-06-21T00:00:00.000Z";

  it("picks the nearest-due OPEN task", () => {
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        tasks: [
          { id: "b", title: "Later task", status: "ACCEPTED", dueDate: "2026-06-20T00:00:00.000Z" },
          { id: "a", title: "Sooner task", status: "SUGGESTED", dueDate: "2026-06-10T00:00:00.000Z" },
          { id: "c", title: "Done task", status: "COMPLETED", dueDate: "2026-06-09T00:00:00.000Z" },
        ],
      }),
    );
    expect(snap.nextTaskTitle).toBe("Sooner task");
  });

  it("ignores non-open statuses", () => {
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        tasks: [
          { id: "a", title: "Completed", status: "COMPLETED", dueDate: null },
          { id: "b", title: "Dismissed", status: "DISMISSED", dueDate: null },
        ],
      }),
    );
    expect(snap.nextTaskTitle).toBeNull();
  });

  it("falls back to checklist.nextAction when no open tasks", () => {
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        tasks: [],
        // Only the fields pickNextTaskTitle reads are needed.
        checklist: {
          nextAction: { title: "Set up electricity", isCompleted: false },
        } as never,
      }),
    );
    expect(snap.nextTaskTitle).toBe("Set up electricity");
  });

  it("sorts no-due-date tasks to the bottom", () => {
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        tasks: [
          { id: "a", title: "No date", status: "SUGGESTED", dueDate: null },
          { id: "b", title: "Has date", status: "SUGGESTED", dueDate: "2026-06-15T00:00:00.000Z" },
        ],
      }),
    );
    expect(snap.nextTaskTitle).toBe("Has date");
  });
});

describe("computeWidgetSnapshot — readiness", () => {
  const moveDate = "2026-06-21T00:00:00.000Z";

  it("blends checklist and critical-provider ratios (mean)", () => {
    // checklist 1/4 = 0.25, critical 1/1 = 1.0 → mean 0.625 → 63
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        checklist: { totalItems: 4, completedItems: 1 } as never,
        completedCritical: 1,
        missingCritical: 0,
      }),
    );
    expect(snap.readinessPercent).toBe(63);
  });

  it("is 0 when there are no readiness signals", () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate }));
    expect(snap.readinessPercent).toBe(0);
  });

  it("clamps to 100", () => {
    const snap = computeWidgetSnapshot(
      baseInput({
        moveDate,
        checklist: { totalItems: 3, completedItems: 3 } as never,
        completedCritical: 2,
        missingCritical: 0,
      }),
    );
    expect(snap.readinessPercent).toBe(100);
  });
});

describe("persist / read round-trip", () => {
  it("mirrors the snapshot to AsyncStorage and reads it back", async () => {
    const snap = computeWidgetSnapshot(baseInput({ moveDate: "2026-06-21T00:00:00.000Z" }));
    const ok = await persistWidgetSnapshot(snap);
    expect(ok).toBe(true);
    expect(storage.has(WIDGET_SNAPSHOT_KEY)).toBe(true);

    const read = await readWidgetSnapshot();
    expect(read?.daysToGo).toBe(13);
    expect(read?.phase).toBe("upcoming");
  });

  it("returns null when nothing is persisted", async () => {
    expect(await readWidgetSnapshot()).toBeNull();
  });

  it("shape-guards malformed stored JSON to a safe snapshot", async () => {
    storage.set(WIDGET_SNAPSHOT_KEY, '{"phase":"garbage","readinessPercent":"oops"}');
    const read = await readWidgetSnapshot();
    expect(read?.phase).toBe("none");
    expect(read?.readinessPercent).toBe(0);
    expect(read?.daysToGo).toBeNull();
  });

  it("returns null on unparseable JSON", async () => {
    storage.set(WIDGET_SNAPSHOT_KEY, "{not json");
    expect(await readWidgetSnapshot()).toBeNull();
  });

  it("computeAndPersist writes and returns the snapshot", async () => {
    const snap = await computeAndPersistWidgetSnapshot(
      baseInput({ moveDate: "2026-06-21T00:00:00.000Z" }),
    );
    expect(snap.daysToGo).toBe(13);
    const read = await readWidgetSnapshot();
    expect(read?.daysToGo).toBe(13);
  });
});

describe("emptyWidgetSnapshot", () => {
  it("is a coherent no-plan snapshot", () => {
    const snap = emptyWidgetSnapshot(NOW);
    expect(snap.phase).toBe("none");
    expect(snap.daysToGo).toBeNull();
    expect(snap.readinessPercent).toBe(0);
    expect(snap.updatedAt).toBe(NOW.toISOString());
  });
});
