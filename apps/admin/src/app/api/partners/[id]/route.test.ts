import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  partnerFindUnique: vi.fn(),
  partnerUpdate: vi.fn(),
  writeAdminAudit: vi.fn(),
  getAuditRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.5", userAgent: "vitest" })),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { partner: { findUnique: mocks.partnerFindUnique, update: mocks.partnerUpdate } },
}));
vi.mock("@/lib/auth", () => ({
  requirePermission: (...a: unknown[]) => mocks.requirePermission(...a),
  requirePasswordConfirm: (...a: unknown[]) => mocks.requirePasswordConfirm(...a),
}));
vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => mocks.getAuditRequestMeta(),
  writeAdminAudit: (...a: unknown[]) => mocks.writeAdminAudit(...a),
}));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => mocks.sendEmail(...a) }));

import { PATCH } from "./route";

const SESSION = { adminId: "admin-1", role: "ADMIN" };

function req(body: Record<string, unknown>) {
  return new Request("https://admin.locateflow.com/api/partners/ptr_1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}
const params = { params: Promise.resolve({ id: "ptr_1" }) };

describe("PATCH /api/partners/:id (decision)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.partnerFindUnique.mockResolvedValue({ id: "ptr_1", status: "PENDING", category: "cleaning", companyName: "Sparkle", contactEmail: "s@x.com", reviewNotes: null });
    mocks.partnerUpdate.mockResolvedValue({ id: "ptr_1", status: "APPROVED", companyName: "Sparkle", contactEmail: "s@x.com" });
    mocks.writeAdminAudit.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("requires ADMIN + step-up, sets status, and writes an audit row on approve", async () => {
    const res = await PATCH(req({ decision: "APPROVED", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canUpdate", { minimumRole: "ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalled();
    expect(mocks.partnerUpdate.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", reviewedByAdminId: "admin-1" });
    expect(mocks.writeAdminAudit.mock.calls[0][1]).toMatchObject({ action: "PARTNER_APPLICATION_DECISION" });
  });

  it("400s a reject without an applicant message", async () => {
    const res = await PATCH(req({ decision: "REJECTED", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(400);
    expect(mocks.partnerUpdate).not.toHaveBeenCalled();
  });

  it("403s when step-up fails (no decision recorded)", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: false, error: "Bad password", requiresMfa: true });
    const res = await PATCH(req({ decision: "APPROVED" }), params);
    expect(res.status).toBe(403);
    expect(mocks.partnerUpdate).not.toHaveBeenCalled();
  });

  it("400s an invalid decision value", async () => {
    const res = await PATCH(req({ decision: "MAYBE", confirmPassword: "pw", mfaCode: "1" }), params);
    expect(res.status).toBe(400);
  });
});
