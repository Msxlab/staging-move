import { describe, expect, it, vi } from "vitest";
import {
  pruneOldUserEvents,
  resolveUserEventRetentionConfig,
} from "./user-event-retention";

describe("UserEvent retention policy", () => {
  it("dry-runs by default, logs eligible age buckets, and deletes nothing", async () => {
    const userEvent = {
      count: vi.fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    };

    const result = await pruneOldUserEvents(
      userEvent,
      resolveUserEventRetentionConfig({}),
      new Date("2026-06-16T00:00:00.000Z"),
    );

    expect(result.enabled).toBe(false);
    expect(result.retentionDays).toBe(180);
    expect(result.eligibleCount).toBe(10);
    expect(result.ageBuckets).toEqual({
      retentionToPlus90Days: 2,
      plus90ToPlus365Days: 3,
      plus365Days: 5,
    });
    expect(result.deletedCount).toBe(0);
    expect(userEvent.findMany).not.toHaveBeenCalled();
    expect(userEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only old non-retained UserEvent rows in idempotent batches when enabled", async () => {
    const userEvent = {
      count: vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
      findMany: vi.fn()
        .mockResolvedValueOnce([{ id: "evt_old_1" }, { id: "evt_old_2" }])
        .mockResolvedValueOnce([{ id: "evt_old_3" }]),
      deleteMany: vi.fn()
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 }),
    };

    const result = await pruneOldUserEvents(
      userEvent,
      resolveUserEventRetentionConfig({
        enabled: "true",
        retentionDays: "180",
        batchSize: "2",
      }),
      new Date("2026-06-16T00:00:00.000Z"),
    );

    expect(result.deletedCount).toBe(3);
    expect(result.batches).toBe(2);
    expect(userEvent.findMany).toHaveBeenCalledTimes(2);
    expect(userEvent.deleteMany).toHaveBeenCalledTimes(2);
    expect(userEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2,
      orderBy: { createdAt: "asc" },
      where: expect.objectContaining({
        createdAt: { lt: new Date("2025-12-18T00:00:00.000Z") },
        event: { notIn: ["LEGAL_CONSENT_ACCEPTED", "ONBOARDING_COMPLETED"] },
      }),
    }));
    expect(userEvent.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ["evt_old_1", "evt_old_2"] },
        createdAt: { lt: new Date("2025-12-18T00:00:00.000Z") },
        event: { notIn: ["LEGAL_CONSENT_ACCEPTED", "ONBOARDING_COMPLETED"] },
      }),
    });
  });
});
