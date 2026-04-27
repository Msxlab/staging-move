import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    address: { findUnique: vi.fn() },
    serviceProvider: { findUnique: vi.fn(), update: vi.fn() },
    userCustomProvider: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  isEncrypted: vi.fn((value: string) => typeof value === "string" && value.startsWith("enc:")),
}));

vi.mock("@/lib/plan-limits", () => ({
  canCreateService: vi.fn(() => Promise.resolve({ allowed: true })),
}));

vi.mock("@/lib/move-task-sync", () => ({
  safeSyncMoveTasksForAddress: vi.fn(() => Promise.resolve({ attemptedPlans: 0, generatedCount: 0, skippedCount: 0, failedPlanIds: [] })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { canCreateService } from "@/lib/plan-limits";
import { safeSyncMoveTasksForAddress } from "@/lib/move-task-sync";
import { GET, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockService = prisma.service as unknown as {
  findMany: Mock;
  count: Mock;
  create: Mock;
};
const mockAddress = prisma.address as unknown as { findUnique: Mock };
const mockServiceProvider = prisma.serviceProvider as unknown as { findUnique: Mock; update: Mock };
const mockCustomProvider = prisma.userCustomProvider as unknown as { findFirst: Mock };
const mockCanCreateService = canCreateService as unknown as Mock;
const mockSafeSyncMoveTasksForAddress = safeSyncMoveTasksForAddress as unknown as Mock;

function makeRequest(search = "") {
  return new Request(`http://localhost/api/services${search}`) as any;
}

describe("services route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockService.findMany.mockResolvedValue([]);
    mockService.count.mockResolvedValue(0);
    mockService.create.mockResolvedValue({ id: "service-new" });
    mockAddress.findUnique.mockResolvedValue({
      id: "address-1",
      userId: "user-1",
      deletedAt: null,
    });
    mockServiceProvider.findUnique.mockResolvedValue({
      id: "provider-1",
      deletedAt: null,
    });
    mockCustomProvider.findFirst.mockResolvedValue(null);
  });

  it("returns an empty service list for an authenticated new user", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toEqual([]);
    expect(mockService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", deletedAt: null },
      }),
    );
  });

  it("returns 401 instead of a server error when the session is invalid", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("blocks duplicate listed provider services for the same address and category", async () => {
    mockService.findMany.mockResolvedValueOnce([
      {
        id: "service-existing",
        providerName: "PSE&G",
        providerId: "provider-1",
        customProviderId: null,
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.existingServiceId).toBe("service-existing");
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("rejects services for soft-deleted addresses", async () => {
    mockAddress.findUnique.mockResolvedValueOnce({
      id: "address-1",
      userId: "user-1",
      deletedAt: new Date(),
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("encrypts service contact and account fields before creating", async () => {
    mockService.create.mockResolvedValueOnce({
      id: "service-new",
      accountNumber: "enc:acct-1234",
      username: "enc:user-1234",
      phone: "enc:1-800-436-7734",
      email: "enc:customer@example.com",
      notes: "enc:private note",
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
          accountNumber: "acct-1234",
          username: "user-1234",
          phone: "1-800-436-7734",
          email: "customer@example.com",
          notes: "private note",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.service).toMatchObject({
      accountNumber: "acct-1234",
      username: "user-1234",
      phone: "1-800-436-7734",
      email: "customer@example.com",
      notes: "private note",
    });
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountNumber: "enc:acct-1234",
          username: "enc:user-1234",
          phone: "enc:1-800-436-7734",
          email: "enc:customer@example.com",
          notes: "enc:private note",
        }),
      }),
    );
  });

  it("does not fail service creation when move task sync reports a non-blocking failure", async () => {
    mockSafeSyncMoveTasksForAddress.mockResolvedValueOnce({
      attemptedPlans: 0,
      generatedCount: 0,
      skippedCount: 0,
      failedPlanIds: [],
      syncFailed: true,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.moveTaskSync.syncFailed).toBe(true);
    expect(mockService.create).toHaveBeenCalled();
  });

  it("returns structured entitlement errors for expired complete users", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "TRIAL_EXPIRED",
      reason: "Your trial has ended. Upgrade to add more services.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "TRIAL_EXPIRED",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });
    expect(mockAddress.findUnique).not.toHaveBeenCalled();
    expect(mockService.create).not.toHaveBeenCalled();
  });
});
