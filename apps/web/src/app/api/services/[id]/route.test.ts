import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    address: { findUnique: vi.fn() },
    serviceProvider: { findUnique: vi.fn() },
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

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  isEncrypted: vi.fn((value: string) => typeof value === "string" && value.startsWith("enc:")),
}));

vi.mock("@/lib/move-task-sync", () => ({
  safeSyncMoveTasksForAddress: vi.fn(() => Promise.resolve({ attemptedPlans: 0, generatedCount: 0, skippedCount: 0, failedPlanIds: [] })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { PATCH } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockService = prisma.service as unknown as {
  findUnique: Mock;
  findMany: Mock;
  update: Mock;
};

function serviceParams(id = "service-1") {
  return { params: Promise.resolve({ id }) };
}

describe("service detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockService.findUnique.mockResolvedValue({
      id: "service-1",
      userId: "user-1",
      addressId: "address-1",
      category: "UTILITY_ELECTRIC",
      providerName: "PSE&G",
      providerId: "provider-1",
      customProviderId: null,
      deletedAt: null,
    });
    mockService.findMany.mockResolvedValue([]);
    mockService.update.mockResolvedValue({
      id: "service-1",
      accountNumber: "",
      phone: "",
      email: "",
      notes: "",
    });
  });

  it("allows editable private fields to be cleared with empty strings", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/services/service-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName: "PSE&G",
          accountNumber: "",
          phone: "",
          email: "",
          notes: "",
        }),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountNumber: "",
          phone: "",
          email: "",
          notes: "",
        }),
      }),
    );
    expect(body.service).toMatchObject({
      accountNumber: "",
      phone: "",
      email: "",
      notes: "",
    });
  });
});
