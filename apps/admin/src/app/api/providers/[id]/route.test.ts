import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
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
      findMany: (...args: unknown[]) => mocks.findMany(...args),
    },
    serviceProviderCoverage: { count: vi.fn() },
    adminAuditLog: {
      findMany: vi.fn(),
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

import { DELETE, PATCH } from "./route";

function deleteRequest() {
  return new NextRequest("https://admin.locateflow.com/api/providers/provider_1", {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ confirmPassword: "Password-2026!", mfaCode: "123456" }),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/providers/provider_1", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("provider detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN", email: "admin@example.com" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.findFirst.mockResolvedValue({ id: "provider_1", name: "Provider", deletedAt: null });
    mocks.findMany.mockResolvedValue([]);
    mocks.update.mockResolvedValue({ id: "provider_1" });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("soft deletes a provider instead of permanently deleting the row", async () => {
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "provider_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "Password-2026!",
      expect.objectContaining({
        operation: "provider_delete",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
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

  it("returns MFA step-up requirements before deleting a provider", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "MFA required",
      requiresMfa: true,
    });

    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "provider_1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects out-of-range popularity scores before updating", async () => {
    const response = await PATCH(patchRequest({ popularityScore: 999 }), {
      params: Promise.resolve({ id: "provider_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Popularity score/);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a non-https affiliate URL", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "provider_1", name: "Provider", category: "UTILITY_ELECTRIC", deletedAt: null,
      version: 1, affiliateActive: false, affiliateUrl: null,
    });

    const response = await PATCH(patchRequest({ affiliateUrl: "http://insecure.example/offer" }), {
      params: Promise.resolve({ id: "provider_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/https/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses to activate an affiliate offer without a valid https URL", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "provider_1", name: "Provider", category: "UTILITY_ELECTRIC", deletedAt: null,
      version: 1, affiliateActive: false, affiliateUrl: null,
    });

    const response = await PATCH(patchRequest({ affiliateActive: true }), {
      params: Promise.resolve({ id: "provider_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/activating/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects provider categories outside the canonical taxonomy", async () => {
    const response = await PATCH(patchRequest({ category: "NOT_A_CATEGORY" }), {
      params: Promise.resolve({ id: "provider_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid provider category");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
