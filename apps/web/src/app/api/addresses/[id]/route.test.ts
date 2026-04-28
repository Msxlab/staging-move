import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
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
}));

vi.mock("@/lib/move-task-sync", () => ({
  syncMoveTasksForAddress: vi.fn(() => Promise.resolve({ attemptedPlans: 0 })),
}));

vi.mock("@/lib/service-sensitive-fields", () => ({
  decryptServiceSensitiveFields: vi.fn((service: any) => ({
    ...service,
    phone: typeof service.phone === "string" ? service.phone.replace(/^enc:/, "") : service.phone,
  })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockAddress = prisma.address as unknown as {
  findUnique: Mock;
};

function addressParams(id = "address-1") {
  return { params: Promise.resolve({ id }) };
}

describe("address detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockAddress.findUnique.mockResolvedValue({
      id: "address-1",
      userId: "user-1",
      deletedAt: null,
      formattedAddress: "enc:123 Main St",
      services: [
        {
          id: "service-1",
          userId: "user-1",
          providerName: "USPS",
          category: "GOVERNMENT_POSTAL",
          phone: "enc:555-0100",
          provider: {
            id: "provider-1",
            name: "USPS",
            logoUrl: "https://assets.locateflow.com/providers/usps.png",
          },
        },
      ],
      budgets: [],
    });
  });

  it("queries only active tracked services and includes provider logo data", async () => {
    const response = await GET(new Request("http://localhost/api/addresses/address-1") as any, addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockAddress.findUnique).toHaveBeenCalledWith({
      where: { id: "address-1" },
      include: expect.objectContaining({
        services: expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-1",
            deletedAt: null,
            isActive: true,
            deactivatedAt: null,
          }),
          include: expect.objectContaining({
            provider: { select: { id: true, name: true, logoUrl: true } },
          }),
        }),
      }),
    });
    expect(body.address.formattedAddress).toBe("123 Main St");
    expect(body.address.services[0]).toMatchObject({
      id: "service-1",
      phone: "555-0100",
      provider: {
        name: "USPS",
        logoUrl: "https://assets.locateflow.com/providers/usps.png",
      },
    });
  });

  it("does not expose another user's address services", async () => {
    mockAddress.findUnique.mockResolvedValueOnce({
      id: "address-1",
      userId: "user-2",
      deletedAt: null,
      services: [{ id: "service-foreign" }],
      budgets: [],
    });

    const response = await GET(new Request("http://localhost/api/addresses/address-1") as any, addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Address not found");
  });

  it("returns a structured 401 when the DB-backed session is invalid", async () => {
    mockRequireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await GET(new Request("http://localhost/api/addresses/address-1") as any, addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "UNAUTHORIZED",
      error: "Please sign in again.",
    });
  });
});
