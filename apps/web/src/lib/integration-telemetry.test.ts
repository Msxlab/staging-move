import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    integrationDailyStat: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
  },
  rawPrisma: {},
}));

import {
  __resetIntegrationTelemetryForTests,
  flushIntegrationTelemetry,
  recordIntegrationOutcome,
  recordIntegrationOutcomes,
} from "./integration-telemetry";

/** Let the fire-and-forget flush promise chain settle under fake timers. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("integration-telemetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
    vi.clearAllMocks();
    __resetIntegrationTelemetryForTests();
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
  });

  afterEach(() => {
    __resetIntegrationTelemetryForTests();
    vi.useRealTimers();
  });

  describe("buffering", () => {
    it("does not touch prisma at record time", () => {
      recordIntegrationOutcome("fcc", "ok");
      recordIntegrationOutcome("electric", "not_configured");
      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("flushes the aggregated counters after the 30s interval", async () => {
      recordIntegrationOutcome("fcc", "ok");
      recordIntegrationOutcome("fcc", "ok");
      recordIntegrationOutcome("fcc", "error");

      await vi.advanceTimersByTimeAsync(29_999);
      expect(mocks.create).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await settle();

      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          day: new Date("2026-06-10T00:00:00.000Z"),
          source: "fcc",
          statusCounts: { ok: 2, error: 1 },
        },
      });
    });

    it("flushes immediately once 100 events accumulate", async () => {
      for (let i = 0; i < 100; i++) {
        recordIntegrationOutcome("briefing", "cached");
      }
      // No timer advance beyond microtasks — the threshold alone must flush.
      await settle();
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          day: new Date("2026-06-10T00:00:00.000Z"),
          source: "briefing",
          statusCounts: { cached: 100 },
        },
      });
    });

    it("keeps one buffered entry per (day, source) and persists each separately", async () => {
      recordIntegrationOutcome("water", "ok");
      recordIntegrationOutcome("air", "not_configured");
      await flushIntegrationTelemetry();

      expect(mocks.create).toHaveBeenCalledTimes(2);
      const sources = mocks.create.mock.calls.map((c) => c[0].data.source).sort();
      expect(sources).toEqual(["air", "water"]);
    });

    it("clears the buffer after a flush so counters are not double-persisted", async () => {
      recordIntegrationOutcome("nws", "ok");
      await flushIntegrationTelemetry();
      expect(mocks.create).toHaveBeenCalledTimes(1);

      await flushIntegrationTelemetry();
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("recordIntegrationOutcomes records every present source and skips blanks", async () => {
      recordIntegrationOutcomes({ fcc: "ok", electric: "skipped", nri: undefined, radon: "" });
      await flushIntegrationTelemetry();
      const sources = mocks.create.mock.calls.map((c) => c[0].data.source).sort();
      expect(sources).toEqual(["electric", "fcc"]);
    });
  });

  describe("JSON increment merge shape", () => {
    it("sums buffered increments into the existing statusCounts row", async () => {
      mocks.findUnique.mockResolvedValue({
        id: "row1",
        statusCounts: { ok: 2, gated: 5 },
      });
      recordIntegrationOutcome("dossier", "ok");
      recordIntegrationOutcome("dossier", "error");
      recordIntegrationOutcome("dossier", "error");
      await flushIntegrationTelemetry();

      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).toHaveBeenCalledTimes(1);
      expect(mocks.update).toHaveBeenCalledWith({
        where: {
          day_source: { day: new Date("2026-06-10T00:00:00.000Z"), source: "dossier" },
        },
        data: { statusCounts: { ok: 3, gated: 5, error: 2 } },
      });
    });

    it("ignores non-numeric garbage in a stored statusCounts JSON", async () => {
      mocks.findUnique.mockResolvedValue({
        id: "row1",
        statusCounts: { ok: "many", error: -4, cached: 1.9, weird: null },
      });
      recordIntegrationOutcome("briefing", "generated");
      await flushIntegrationTelemetry();

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { statusCounts: { cached: 1, generated: 1 } },
        }),
      );
    });

    it("retries as a merge-update when the create loses the unique race", async () => {
      mocks.findUnique
        .mockResolvedValueOnce(null) // initial read: no row yet
        .mockResolvedValueOnce({ id: "row1", statusCounts: { ok: 7 } }); // re-read after losing race
      mocks.create.mockRejectedValueOnce(new Error("P2002 unique constraint"));

      recordIntegrationOutcome("fcc", "ok");
      await flushIntegrationTelemetry();

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { statusCounts: { ok: 8 } } }),
      );
    });
  });

  describe("never throws on prisma failure", () => {
    it("flushIntegrationTelemetry resolves when every prisma call rejects", async () => {
      mocks.findUnique.mockRejectedValue(new Error("db down"));
      mocks.create.mockRejectedValue(new Error("db down"));
      mocks.update.mockRejectedValue(new Error("db down"));

      recordIntegrationOutcome("radon", "ok");
      await expect(flushIntegrationTelemetry()).resolves.toBeUndefined();
    });

    it("a failed entry is dropped, not re-queued", async () => {
      mocks.findUnique.mockRejectedValueOnce(new Error("db down"));
      recordIntegrationOutcome("water", "error");
      await flushIntegrationTelemetry();

      mocks.findUnique.mockResolvedValue(null);
      await flushIntegrationTelemetry();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("the timer-driven background flush swallows prisma failures", async () => {
      mocks.findUnique.mockRejectedValue(new Error("db down"));
      recordIntegrationOutcome("air", "ok");
      // Would surface as an unhandled rejection if the flush could reject.
      await vi.advanceTimersByTimeAsync(30_000);
      await settle();
      expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    });

    it("recordIntegrationOutcome never throws even at the flush threshold", () => {
      mocks.findUnique.mockImplementation(() => {
        throw new Error("sync explosion");
      });
      expect(() => {
        for (let i = 0; i < 250; i++) recordIntegrationOutcome("electric", "ok");
      }).not.toThrow();
    });
  });
});
