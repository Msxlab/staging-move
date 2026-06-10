import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  providerFindFirst: vi.fn(),
  transaction: vi.fn(),
  auditCreate: vi.fn(),
  revalidate: vi.fn(),
  // tx model fns
  savedFindMany: vi.fn(),
  savedDeleteMany: vi.fn(),
  savedUpdateMany: vi.fn(),
  feedbackFindMany: vi.fn(),
  feedbackDeleteMany: vi.fn(),
  feedbackUpdateMany: vi.fn(),
  genericUpdateMany: vi.fn(),
  providerUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...a: unknown[]) => mocks.requirePermission(...a),
  requirePasswordConfirm: (...a: unknown[]) => mocks.requirePasswordConfirm(...a),
}));
vi.mock("@/lib/providers-revalidate", () => ({
  revalidateProvidersCatalog: (...a: unknown[]) => mocks.revalidate(...a),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: { findFirst: (...a: unknown[]) => mocks.providerFindFirst(...a) },
    $transaction: (...a: unknown[]) => mocks.transaction(...a),
    adminAuditLog: { create: (...a: unknown[]) => mocks.auditCreate(...a) },
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("https://admin.locateflow.com/api/providers/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeTx() {
  const generic = { updateMany: mocks.genericUpdateMany };
  return {
    savedProvider: { findMany: mocks.savedFindMany, deleteMany: mocks.savedDeleteMany, updateMany: mocks.savedUpdateMany },
    recommendationFeedback: { findMany: mocks.feedbackFindMany, deleteMany: mocks.feedbackDeleteMany, updateMany: mocks.feedbackUpdateMany },
    service: generic,
    serviceProviderCoverage: generic,
    affiliateClick: generic,
    affiliateConversion: generic,
    providerGovernanceIssue: generic,
    providerLogoCandidate: generic,
    moveTask: generic,
    userCustomProvider: generic,
    serviceProvider: { update: mocks.providerUpdate },
  };
}

describe("POST /api/providers/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.providerFindFirst.mockImplementation((args: any) =>
      Promise.resolve(
        args.where.id === "keep"
          ? { id: "keep", name: "Keeper" }
          : args.where.id === "dup"
            ? { id: "dup", name: "Dupe", userCount: 7 }
            : null,
      ),
    );
    mocks.savedFindMany.mockResolvedValue([]);
    mocks.feedbackFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(makeTx()));
    mocks.auditCreate.mockResolvedValue({});
  });

  it("400s without both ids", async () => {
    expect((await POST(req({ keepId: "keep" }))).status).toBe(400);
  });

  it("400s when ids are identical", async () => {
    expect((await POST(req({ keepId: "x", duplicateId: "x" }))).status).toBe(400);
  });

  it("403s when step-up fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: false, error: "Password required" });
    const res = await POST(req({ keepId: "keep", duplicateId: "dup" }));
    expect(res.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("404s when the duplicate is missing", async () => {
    mocks.providerFindFirst.mockImplementation((args: any) =>
      Promise.resolve(args.where.id === "keep" ? { id: "keep", name: "Keeper" } : null),
    );
    const res = await POST(req({ keepId: "keep", duplicateId: "ghost" }));
    expect(res.status).toBe(404);
  });

  it("re-points references, folds userCount, soft-deletes the dup, and audits", async () => {
    const res = await POST(req({ keepId: "keep", duplicateId: "dup", confirmPassword: "pw", mfaCode: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, keptId: "keep", mergedId: "dup" });
    // saved/feedback re-point happened
    expect(mocks.savedUpdateMany).toHaveBeenCalledWith({ where: { providerId: "dup" }, data: { providerId: "keep" } });
    expect(mocks.feedbackUpdateMany).toHaveBeenCalledWith({ where: { providerId: "dup" }, data: { providerId: "keep" } });
    // userCount folded into keeper
    expect(mocks.providerUpdate).toHaveBeenCalledWith({
      where: { id: "keep" },
      data: { userCount: { increment: 7 } },
    });
    // dup soft-deleted
    expect(mocks.providerUpdate).toHaveBeenCalledWith({
      where: { id: "dup" },
      data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
    });
    // audited + cache invalidated
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MERGE_PROVIDER", entityId: "keep" }) }),
    );
    expect(mocks.revalidate).toHaveBeenCalled();
  });
});
