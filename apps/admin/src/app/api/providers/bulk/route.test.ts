import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  auditCreate: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => mocks.revalidateTag(...args),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: {
      updateMany: (...args: unknown[]) => mocks.updateMany(...args),
      findMany: (...args: unknown[]) => mocks.findMany(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/providers/bulk", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.40" },
    body: JSON.stringify(body),
  });
}

describe("provider bulk route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([]);
    mocks.auditCreate.mockResolvedValue({});
  });

  it("bulk affiliate_activate only flips rows with a valid https URL and reports skipped", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "p1", affiliateUrl: "https://partner.example/offer" },
      { id: "p2", affiliateUrl: "http://insecure.example" },
      { id: "p3", affiliateUrl: null },
    ]);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(request({ action: "affiliate_activate", ids: ["p1", "p2", "p3"] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      data: { affiliateActive: true },
    });
    expect(body.skipped).toBe(2);
    expect(body.affected).toBe(1);
  });

  it("bulk affiliate_deactivate flips all selected rows off (no URL guard)", async () => {
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const response = await POST(request({ action: "affiliate_deactivate", ids: ["p1", "p2"] }));

    expect(response.status).toBe(200);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
      data: { affiliateActive: false },
    });
  });

  it("bulk set_affiliate_network writes the network on the selected rows", async () => {
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      request({ action: "set_affiliate_network", ids: ["p1", "p2"], data: { network: "impact" } }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
      data: { affiliateNetwork: "impact" },
    });
  });

  it("rejects invalid score payloads before touching providers", async () => {
    const response = await POST(
      request({ action: "set_score", ids: ["provider_1"], data: { score: 101 } }),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects category values outside the canonical provider taxonomy", async () => {
    const response = await POST(
      request({ action: "change_category", ids: ["provider_1"], data: { category: "NOT_A_CATEGORY" } }),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("deduplicates selected ids and writes a bounded audit trail", async () => {
    const response = await POST(
      request({
        action: "set_score",
        ids: ["provider_1", "provider_1"],
        data: { score: 75 },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.affected).toBe(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["provider_1"] } },
      data: { popularityScore: 75 },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BULK_SET_SCORE",
          changes: expect.stringContaining('"ids":["provider_1"]'),
        }),
      }),
    );
  });

  it("requires password confirmation for bulk delete", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required",
      requiresMfa: true,
    });

    const response = await POST(
      request({ action: "delete", ids: ["provider_1"], confirmPassword: "wrong", mfaCode: "123456" }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "wrong",
      expect.objectContaining({
        operation: "provider_delete",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
