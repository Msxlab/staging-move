import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: { findUnique: (...a: unknown[]) => mocks.workspaceFindUnique(...a) },
    subscription: { findUnique: (...a: unknown[]) => mocks.subscriptionFindUnique(...a) },
    workspaceMember: {
      findMany: (...a: unknown[]) => mocks.memberFindMany(...a),
      updateMany: (...a: unknown[]) => mocks.memberUpdateMany(...a),
    },
  },
}));

import { reconcileWorkspaceSeats } from "./workspace-ownership";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

function members(ids: Array<{ id: string; role?: string }>) {
  return ids.map((m) => ({ id: m.id, role: m.role ?? "MEMBER" }));
}

describe("reconcileWorkspaceSeats (seat-overflow, access-aware)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFindUnique.mockResolvedValue({ ownerUserId: "owner_1" });
    mocks.memberUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("demotes the newest non-owner members past a paid tier's seat limit", async () => {
    // INDIVIDUAL active → seat limit 1; 3 active members → 2 overflow.
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "INDIVIDUAL", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      currentPeriodEndsAt: FUTURE,
    });
    mocks.memberFindMany.mockResolvedValue(
      members([{ id: "owner", role: "OWNER" }, { id: "m1" }, { id: "m2" }]),
    );

    const res = await reconcileWorkspaceSeats("ws_1");

    expect(res.overflowed).toBe(2);
    const call = mocks.memberUpdateMany.mock.calls[0]?.[0];
    expect(call.data).toMatchObject({ status: "OVERFLOW" });
    expect(call.where.id.in).toEqual(expect.arrayContaining(["m1", "m2"]));
    expect(call.where.id.in).not.toContain("owner");
  });

  it("collapses to a single seat when the owner's access has lapsed (canceled)", async () => {
    // FAMILY but CANCELED → hasAccess false → limit floored to 1, members overflow.
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FAMILY", status: "CANCELED", accessType: "PAID", provider: "STRIPE",
      currentPeriodEndsAt: PAST, canceledAt: PAST,
    });
    mocks.memberFindMany.mockResolvedValue(
      members([{ id: "owner", role: "OWNER" }, { id: "m1" }, { id: "m2" }, { id: "m3" }]),
    );

    const res = await reconcileWorkspaceSeats("ws_1");

    expect(res.overflowed).toBe(3);
    expect(mocks.memberUpdateMany.mock.calls[0][0].where.id.in).not.toContain("owner");
  });

  it("keeps everyone when an active paid tier has room to spare", async () => {
    // FAMILY active → seat limit 6; only 3 active members and no overflow.
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FAMILY", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      currentPeriodEndsAt: FUTURE,
    });
    mocks.memberFindMany.mockImplementation((args: { where: { status: string } }) =>
      args.where.status === "ACTIVE"
        ? members([{ id: "owner", role: "OWNER" }, { id: "m1" }, { id: "m2" }])
        : [],
    );

    const res = await reconcileWorkspaceSeats("ws_1");

    expect(res).toEqual({ overflowed: 0, restored: 0 });
    expect(mocks.memberUpdateMany).not.toHaveBeenCalled();
  });

  it("restores overflow members into free seats after an upgrade", async () => {
    // PRO active → seat limit 10; 3 active + 2 overflow → restore both.
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      currentPeriodEndsAt: FUTURE,
    });
    mocks.memberFindMany.mockImplementation((args: { where: { status: string } }) =>
      args.where.status === "ACTIVE"
        ? members([{ id: "owner", role: "OWNER" }, { id: "m1" }, { id: "m2" }])
        : members([{ id: "o1" }, { id: "o2" }]),
    );

    const res = await reconcileWorkspaceSeats("ws_1");

    expect(res.restored).toBe(2);
    const call = mocks.memberUpdateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "ACTIVE", overflowSince: null });
  });
});
