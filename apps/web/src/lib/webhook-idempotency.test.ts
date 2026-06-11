import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));

import {
  hasProcessedWebhookEvent,
  isUniqueConstraintError,
  markWebhookEventProcessed,
  releaseProcessedWebhookEvent,
  reserveWebhookEvent,
  releaseWebhookEvent,
} from "./webhook-idempotency";

const processed = mocks.prisma.processedWebhookEvent;

function p2002() {
  return Object.assign(new Error("unique constraint"), { code: "P2002" });
}

describe("webhook-idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processed.create.mockResolvedValue({});
    processed.deleteMany.mockResolvedValue({ count: 1 });
    processed.findUnique.mockResolvedValue(null);
  });

  describe("isUniqueConstraintError", () => {
    it("recognizes Prisma P2002 conflicts and ignores everything else", () => {
      expect(isUniqueConstraintError(p2002())).toBe(true);
      expect(isUniqueConstraintError(new Error("nope"))).toBe(false);
      expect(isUniqueConstraintError(null)).toBe(false);
    });
  });

  describe("reserveWebhookEvent", () => {
    it("reserves the event id with the source on the first delivery", async () => {
      const result = await reserveWebhookEvent("evt_1", "appstore");

      expect(result).toBe("reserved");
      expect(processed.create).toHaveBeenCalledWith({
        data: { id: "evt_1", source: "appstore" },
      });
    });

    it("returns duplicate when the unique key is already taken", async () => {
      processed.create.mockRejectedValueOnce(p2002());

      const result = await reserveWebhookEvent("evt_1", "appstore");

      expect(result).toBe("duplicate");
    });

    it("rethrows non-conflict database errors", async () => {
      processed.create.mockRejectedValueOnce(new Error("db down"));

      await expect(reserveWebhookEvent("evt_1", "appstore")).rejects.toThrow("db down");
    });
  });

  describe("releaseWebhookEvent", () => {
    it("deletes the marker scoped by id and source so a retry can reprocess", async () => {
      await releaseWebhookEvent("evt_1", "playstore");

      expect(processed.deleteMany).toHaveBeenCalledWith({
        where: { id: "evt_1", source: "playstore" },
      });
    });
  });

  describe("backward-compatible primitives", () => {
    it("markWebhookEventProcessed still returns created/duplicate (Stripe caller)", async () => {
      await expect(markWebhookEventProcessed("evt_2", "stripe")).resolves.toBe("created");

      processed.create.mockRejectedValueOnce(p2002());
      await expect(markWebhookEventProcessed("evt_2", "stripe")).resolves.toBe("duplicate");
    });

    it("releaseProcessedWebhookEvent still scopes the delete by source", async () => {
      await releaseProcessedWebhookEvent("evt_2", "stripe");
      expect(processed.deleteMany).toHaveBeenCalledWith({
        where: { id: "evt_2", source: "stripe" },
      });
    });

    it("hasProcessedWebhookEvent reports presence", async () => {
      processed.findUnique.mockResolvedValueOnce({ id: "evt_3" });
      await expect(hasProcessedWebhookEvent("evt_3")).resolves.toBe(true);
      processed.findUnique.mockResolvedValueOnce(null);
      await expect(hasProcessedWebhookEvent("evt_3")).resolves.toBe(false);
    });
  });
});
