import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  processPendingAccountDeletionRequests: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: mocks.guardCronRequest,
}));

vi.mock("@/lib/account-deletion", () => ({
  processPendingAccountDeletionRequests: mocks.processPendingAccountDeletionRequests,
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: { deleteMany: vi.fn() },
    userEvent: {
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    rateLimitLog: { deleteMany: vi.fn() },
    emailLog: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    adminAuditLog: { deleteMany: vi.fn() },
    adminLoginLog: { deleteMany: vi.fn() },
    userLoginSession: { deleteMany: vi.fn() },
    notificationQueue: { deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { GET } from "./route";

const prismaMock = prisma as unknown as {
  userSession: { deleteMany: ReturnType<typeof vi.fn> };
  userEvent: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  rateLimitLog: { deleteMany: ReturnType<typeof vi.fn> };
  emailLog: { deleteMany: ReturnType<typeof vi.fn> };
  notification: { deleteMany: ReturnType<typeof vi.fn> };
  auditLog: { deleteMany: ReturnType<typeof vi.fn> };
  adminAuditLog: { deleteMany: ReturnType<typeof vi.fn> };
  adminLoginLog: { deleteMany: ReturnType<typeof vi.fn> };
  userLoginSession: { deleteMany: ReturnType<typeof vi.fn> };
  notificationQueue: { deleteMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardCronRequest.mockResolvedValue({ ok: true });
  mocks.getRuntimeConfigValue.mockResolvedValue(null);
  mocks.processPendingAccountDeletionRequests.mockResolvedValue([]);

  for (const model of [
    prismaMock.userSession,
    prismaMock.rateLimitLog,
    prismaMock.emailLog,
    prismaMock.notification,
    prismaMock.auditLog,
    prismaMock.adminAuditLog,
    prismaMock.adminLoginLog,
    prismaMock.userLoginSession,
    prismaMock.notificationQueue,
  ]) {
    model.deleteMany.mockResolvedValue({ count: 0 });
  }

  prismaMock.userEvent.count
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(5);
  prismaMock.userEvent.findMany.mockResolvedValue([]);
  prismaMock.userEvent.deleteMany.mockResolvedValue({ count: 0 });
});

describe("/api/cron/data-retention", () => {
  it("dry-runs UserEvent retention by default and logs eligible age buckets without deleting UserEvent rows", async () => {
    const response = await GET(new NextRequest("https://locateflow.com/api/cron/data-retention"));

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      cleaned: {
        userEvents: 0,
        userEventRetention: {
          enabled: false,
          retentionDays: 180,
          eligibleCount: 10,
          ageBuckets: {
            retentionToPlus90Days: 2,
            plus90ToPlus365Days: 3,
            plus365Days: 5,
          },
          deletedCount: 0,
        },
      },
    });
    expect(prismaMock.userEvent.count).toHaveBeenCalledTimes(3);
    expect(prismaMock.userEvent.findMany).not.toHaveBeenCalled();
    expect(prismaMock.userEvent.deleteMany).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "UserEvent retention dry-run completed",
      expect.objectContaining({
        action: "USER_EVENT_RETENTION",
        enabled: false,
        eligibleCount: 10,
        deletedCount: 0,
      }),
    );
  });
});
