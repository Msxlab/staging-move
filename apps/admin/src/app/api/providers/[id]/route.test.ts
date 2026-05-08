import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
      update: (...args: unknown[]) => mocks.update(...args),
      findMany: vi.fn(),
    },
    serviceProviderCoverage: { count: vi.fn() },
    adminAuditLog: {
      findMany: vi.fn(),
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

import { DELETE } from "./route";

function request() {
  return new NextRequest("https://admin.locateflow.com/api/providers/provider_1", {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ confirmPassword: "Password-2026!" }),
  });
}

describe("provider delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN", email: "admin@example.com" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.findFirst.mockResolvedValue({ id: "provider_1", name: "Provider", deletedAt: null });
    mocks.update.mockResolvedValue({ id: "provider_1" });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("soft deletes a provider instead of permanently deleting the row", async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: "provider_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "provider_1" },
      data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELETE_PROVIDER",
          changes: expect.stringContaining("soft_delete"),
        }),
      }),
    );
  });
});
