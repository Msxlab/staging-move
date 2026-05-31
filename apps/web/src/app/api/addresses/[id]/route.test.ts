import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    service: {
      updateMany: vi.fn(),
    },
    budget: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

// Partial mock: keep the real apiGateErrorResponse (the GET 401 path relies on
// it) and only stub requireAppMutationUser, which the DELETE/PATCH handlers use.
vi.mock("@/lib/api-gates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-gates")>("@/lib/api-gates");
  return {
    ...actual,
    requireAppMutationUser: vi.fn(),
  };
});

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
import { requireAppMutationUser } from "@/lib/api-gates";
import { createAuditLog } from "@/lib/audit";
import { DELETE, GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockRequireAppMutationUser = requireAppMutationUser as unknown as Mock;
const mockCreateAuditLog = createAuditLog as unknown as Mock;
const mockAddress = prisma.address as unknown as {
  findUnique: Mock;
  findFirst: Mock;
  update: Mock;
};
const mockService = (prisma as unknown as { service: { updateMany: Mock } }).service;
const mockBudget = (prisma as unknown as { budget: { updateMany: Mock } }).budget;
const mockTransaction = (prisma as unknown as { $transaction: Mock }).$transaction;

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

  describe("DELETE", () => {
    beforeEach(() => {
      mockRequireAppMutationUser.mockResolvedValue("user-1");
      mockAddress.findUnique.mockResolvedValue({
        id: "address-1",
        userId: "user-1",
        deletedAt: null,
        nickname: "Home",
      });
      // The handler builds the transaction array by *calling* these first, so
      // give them sentinel return values we can assert were passed to $transaction.
      mockService.updateMany.mockReturnValue("service-updateMany-op");
      mockBudget.updateMany.mockReturnValue("budget-updateMany-op");
      mockAddress.update.mockReturnValue("address-update-op");
      mockTransaction.mockResolvedValue([{ count: 2 }, { count: 1 }, { id: "address-1" }]);
    });

    it("soft-deletes the address and cascades to its services and budgets in one transaction", async () => {
      const response = await DELETE(
        new Request("http://localhost/api/addresses/address-1", { method: "DELETE" }) as any,
        addressParams() as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });

      // Only the address's own still-active services are cascaded.
      expect(mockService.updateMany).toHaveBeenCalledWith({
        where: { addressId: "address-1", userId: "user-1", deletedAt: null },
        data: { isActive: false, deactivatedAt: expect.any(Date), deletedAt: expect.any(Date) },
      });
      // Budgets scoped to the address are soft-deleted too.
      expect(mockBudget.updateMany).toHaveBeenCalledWith({
        where: { addressId: "address-1", userId: "user-1", deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAddress.update).toHaveBeenCalledWith({
        where: { id: "address-1" },
        data: { deletedAt: expect.any(Date) },
      });
      // All three writes go through a single $transaction so a partial delete is impossible.
      expect(mockTransaction).toHaveBeenCalledWith([
        "service-updateMany-op",
        "budget-updateMany-op",
        "address-update-op",
      ]);
    });

    it("records the number of cascaded services and budgets in the audit log", async () => {
      await DELETE(
        new Request("http://localhost/api/addresses/address-1", { method: "DELETE" }) as any,
        addressParams() as any,
      );

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          action: "DELETE",
          entityType: "Address",
          entityId: "address-1",
          changes: expect.objectContaining({ servicesDeactivated: 2, budgetsDeleted: 1 }),
        }),
      );
    });

    it("does not delete another user's address", async () => {
      mockAddress.findUnique.mockResolvedValueOnce({
        id: "address-1",
        userId: "user-2",
        deletedAt: null,
        nickname: "Foreign",
      });

      const response = await DELETE(
        new Request("http://localhost/api/addresses/address-1", { method: "DELETE" }) as any,
        addressParams() as any,
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Address not found");
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockService.updateMany).not.toHaveBeenCalled();
      expect(mockBudget.updateMany).not.toHaveBeenCalled();
    });

    it("promotes the most recent remaining address when the deleted one was primary", async () => {
      mockAddress.findUnique.mockResolvedValueOnce({
        id: "address-1",
        userId: "user-1",
        deletedAt: null,
        nickname: "Home",
        isPrimary: true,
      });
      mockAddress.findFirst.mockResolvedValueOnce({ id: "address-2" });
      mockAddress.update.mockReturnValue("address-update-op");
      mockTransaction.mockResolvedValueOnce([
        { count: 0 },
        { count: 0 },
        "address-delete-op",
        "address-promote-op",
      ]);

      const response = await DELETE(
        new Request("http://localhost/api/addresses/address-1", { method: "DELETE" }) as any,
        addressParams() as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      // Most-recent remaining address is selected as the replacement primary.
      expect(mockAddress.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", deletedAt: null, id: { not: "address-1" } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      // The promote write is part of the same atomic delete transaction.
      expect(mockAddress.update).toHaveBeenCalledWith({
        where: { id: "address-2" },
        data: { isPrimary: true },
      });
      expect(mockTransaction).toHaveBeenCalledWith([
        "service-updateMany-op",
        "budget-updateMany-op",
        "address-update-op",
        "address-update-op",
      ]);
      // The promotion is traceable in the audit log.
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE",
          changes: expect.objectContaining({ promotedPrimaryId: "address-2" }),
        }),
      );
    });

    it("does not promote a replacement when the deleted address was not primary", async () => {
      // existing.isPrimary is falsy in the shared beforeEach fixture, so the
      // promote branch must stay inert — no candidate lookup, 3-op transaction.
      await DELETE(
        new Request("http://localhost/api/addresses/address-1", { method: "DELETE" }) as any,
        addressParams() as any,
      );

      expect(mockAddress.findFirst).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.not.objectContaining({ promotedPrimaryId: expect.anything() }),
        }),
      );
    });
  });
});
