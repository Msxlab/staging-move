import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { addressChangeEvent: { findMany: mocks.findMany } } }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: mocks.getUserSession }));

describe("GET /api/connectors/changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns 401 for an unauthenticated caller", async () => {
    mocks.getUserSession.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns the caller's change events with per-connector dispatch status", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "evt_1",
        fromAddressId: "a0",
        toAddressId: "a1",
        status: "DISPATCHED",
        dispatchCount: 1,
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        dispatches: [
          { connectorKey: "usps", status: "CONFIRMED", confirmedAt: new Date("2026-06-04T01:00:00.000Z"), lastErrorCode: null },
        ],
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0].dispatches[0]).toMatchObject({ connectorKey: "usps", status: "CONFIRMED" });
  });

  it("scopes strictly to the caller (no cross-user leakage)", async () => {
    const { GET } = await import("./route");
    await GET();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ userId: "user_1" });
  });

  it("does not select the encrypted payload or confirmation fields", async () => {
    const { GET } = await import("./route");
    await GET();
    const select = mocks.findMany.mock.calls[0][0].select;
    expect(select.payloadEncrypted).toBeUndefined();
    const dispatchSelect = select.dispatches.select;
    expect(select.dispatches.where).toEqual({ isShadow: false });
    expect(dispatchSelect.confirmationEncrypted).toBeUndefined();
    expect(dispatchSelect.payloadEncrypted).toBeUndefined();
  });
});
