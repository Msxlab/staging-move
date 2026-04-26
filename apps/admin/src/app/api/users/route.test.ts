import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  subscriptionCount: vi.fn(),
  subscriptionGroupBy: vi.fn(),
  gdprFindFirst: vi.fn(),
  gdprCreate: vi.fn(),
  adminAuditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
      count: (...args: unknown[]) => mocks.userCount(...args),
    },
    subscription: {
      count: (...args: unknown[]) => mocks.subscriptionCount(...args),
      groupBy: (...args: unknown[]) => mocks.subscriptionGroupBy(...args),
    },
    gDPRRequest: {
      findFirst: (...args: unknown[]) => mocks.gdprFindFirst(...args),
      create: (...args: unknown[]) => mocks.gdprCreate(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditCreate(...args),
    },
  },
}));

import { DELETE } from "./route";

describe("admin users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindMany.mockResolvedValue([
      { id: "user_processing", email: "processing@example.com", subscription: null },
      { id: "user_new", email: "new@example.com", subscription: null },
    ]);
    mocks.gdprFindFirst
      .mockResolvedValueOnce({ id: "req_processing", status: "PROCESSING" })
      .mockResolvedValueOnce(null);
    mocks.gdprCreate.mockResolvedValue({ id: "req_new", status: "PENDING" });
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("skips users with PROCESSING deletion requests during bulk delete", async () => {
    const response = await DELETE(
      new NextRequest("https://admin.locateflow.com/api/users", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["user_processing", "user_new"],
          confirmPassword: "admin-password",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.queued).toBe(1);
    expect(body.skippedProcessing).toBe(1);
    expect(body.skipped).toEqual([
      { id: "user_processing", reason: "DELETE request already processing" },
    ]);
    expect(mocks.gdprCreate).toHaveBeenCalledTimes(1);
  });
});
