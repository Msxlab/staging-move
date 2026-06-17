import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FREE_MOVE_PREVIEW_STORAGE_KEY,
  readFreeMovePreviewContext,
  sanitizeFreeMovePreviewContext,
  selectFreeMovePreviewSteps,
  writeFreeMovePreviewContext,
} from "./free-move-preview";
import { generateChecklist, type UserChecklistProfile } from "./shared-relocation";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const profile: UserChecklistProfile = {
  hasChildren: false,
  childrenCount: 0,
  hasPets: false,
  hasSenior: false,
  carCount: 1,
  hasDisability: false,
  needsStorage: false,
  hasMotorcycle: false,
  hasBoatRV: false,
  isImmigrant: false,
  isBusinessOwner: false,
  moveType: "PERSONAL",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("free move preview context", () => {
  it("keeps only coarse state/date context and rejects unusable destinations", () => {
    const noisyInput: Record<string, unknown> = {
      fromState: " texas ",
      toState: "ca",
      moveDate: "2026-08-10",
      street: "123 Main",
      zip: "90210",
    };
    expect(
      sanitizeFreeMovePreviewContext(noisyInput),
    ).toMatchObject({
      fromState: "",
      toState: "CA",
      moveDate: "2026-08-10",
    });

    expect(sanitizeFreeMovePreviewContext({ fromState: "TX", toState: "", moveDate: "2026-08-10" })).toBeNull();
    expect(sanitizeFreeMovePreviewContext({ fromState: "TX", toState: "CA", moveDate: "tomorrow" })).toBeNull();
  });

  it("persists and reads the coarse context from browser storage only", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });

    const written = writeFreeMovePreviewContext({
      fromState: "tx",
      toState: "ny",
      moveDate: "2026-09-15",
    });

    expect(written).toMatchObject({ fromState: "TX", toState: "NY", moveDate: "2026-09-15" });
    expect(localStorage.getItem(FREE_MOVE_PREVIEW_STORAGE_KEY)).not.toContain("90210");
    expect(readFreeMovePreviewContext()).toMatchObject({
      fromState: "TX",
      toState: "NY",
      moveDate: "2026-09-15",
    });
  });
});

describe("selectFreeMovePreviewSteps", () => {
  it("returns a capped read-only preview from the real checklist engine", () => {
    const checklist = generateChecklist(profile, new Date("2026-08-01"), "TX", "CA", new Set());
    const steps = selectFreeMovePreviewSteps(checklist, 5);

    expect(steps).toHaveLength(5);
    expect(new Set(steps.map((step) => step.id)).size).toBe(5);
    expect(steps.every((step) => step.title.trim().length > 0)).toBe(true);
    expect(steps[0].id).toBe(checklist.nextAction?.id);
  });
});
