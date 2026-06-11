import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  moverFindUnique: vi.fn(),
  moverUpdate: vi.fn(),
  writeAdminAudit: vi.fn(),
  getAuditRequestMeta: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    movingCompany: {
      findUnique: mocks.moverFindUnique,
      update: mocks.moverUpdate,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAdminAudit: mocks.writeAdminAudit,
  getAuditRequestMeta: mocks.getAuditRequestMeta,
}));

import * as route from "./route";

const { GET, PATCH } = route;

function params(id = "mover_1") {
  return { params: Promise.resolve({ id }) };
}

function getRequest(id = "mover_1") {
  return new Request(`https://admin.locateflow.com/api/movers/${id}`) as any;
}

function patchRequest(body: unknown, id = "mover_1") {
  return new Request(`https://admin.locateflow.com/api/movers/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const existingMover = {
  id: "mover_1",
  usdotNumber: 12345,
  legalName: "ACME VAN LINES",
  active: true,
  complaintCount2y: 0,
  safetyRating: null,
};

const validBody = {
  active: false,
  complaintCount2y: 3,
  safetyRating: "Conditional",
  confirmPassword: "correct horse battery staple",
  mfaCode: "123456",
};

describe("admin mover corrections route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "a@x.com", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.moverFindUnique.mockResolvedValue(existingMover);
    mocks.moverUpdate.mockImplementation(async ({ data }: any) => ({ ...existingMover, ...data }));
    mocks.writeAdminAudit.mockResolvedValue({ id: "audit_1" });
    mocks.getAuditRequestMeta.mockReturnValue({ ipAddress: "1.2.3.4", userAgent: "vitest" });
  });

  it("is corrections-only: no POST/PUT/DELETE — rows are created/retired by the ETL", () => {
    expect((route as any).POST).toBeUndefined();
    expect((route as any).PUT).toBeUndefined();
    expect((route as any).DELETE).toBeUndefined();
  });

  it("applies corrections and writes an audit row with before/after", async () => {
    const response = await PATCH(patchRequest(validBody), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mover).toMatchObject({ active: false, complaintCount2y: 3, safetyRating: "Conditional" });
    expect(mocks.moverUpdate).toHaveBeenCalledWith({
      where: { id: "mover_1" },
      data: { active: false, complaintCount2y: 3, safetyRating: "Conditional" },
    });
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({
        action: "MOVER_CATALOG_UPDATE",
        entityType: "MovingCompany",
        entityId: "mover_1",
        before: { active: true, complaintCount2y: 0, safetyRating: null },
        after: { active: false, complaintCount2y: 3, safetyRating: "Conditional" },
        metadata: expect.objectContaining({
          operation: "mover_catalog_update",
          changedFields: ["active", "complaintCount2y", "safetyRating"],
        }),
      }),
    );
  });

  it("rejects mutation without password + MFA step-up (403, nothing written)", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await PATCH(patchRequest(validBody), params());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.moverUpdate).not.toHaveBeenCalled();
    expect(mocks.writeAdminAudit).not.toHaveBeenCalled();
  });

  it("forwards step-up credentials with requireMfa and keeps them out of the update data", async () => {
    const response = await PATCH(patchRequest(validBody), params());

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct horse battery staple",
      expect.objectContaining({
        operation: "mover_catalog_update",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(mocks.moverUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ confirmPassword: expect.anything() }),
      }),
    );
  });

  it("refuses ETL-owned identity fields with a pointer to the script", async () => {
    const response = await PATCH(
      patchRequest({ ...validBody, usdotNumber: 99999 }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("scripts/etl-fmcsa-movers.mjs");
    expect(mocks.moverUpdate).not.toHaveBeenCalled();
  });

  it("rejects a negative or non-integer complaint count", async () => {
    expect((await PATCH(patchRequest({ ...validBody, complaintCount2y: -1 }), params())).status).toBe(400);
    expect((await PATCH(patchRequest({ ...validBody, complaintCount2y: 1.5 }), params())).status).toBe(400);
    expect(mocks.moverUpdate).not.toHaveBeenCalled();
  });

  it("rejects a safety rating outside the FMCSA enum, accepts blank as null", async () => {
    expect((await PATCH(patchRequest({ ...validBody, safetyRating: "Excellent" }), params())).status).toBe(400);

    const response = await PATCH(patchRequest({ ...validBody, safetyRating: "" }), params());
    expect(response.status).toBe(200);
    expect(mocks.moverUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ safetyRating: null }) }),
    );
  });

  it("rejects a payload with no editable fields", async () => {
    const response = await PATCH(
      patchRequest({ confirmPassword: "pw", mfaCode: "123456" }),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("No editable fields");
  });

  it("404s on a missing mover after step-up (no phantom audit rows)", async () => {
    mocks.moverFindUnique.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest(validBody), params("mover_missing"));

    expect(response.status).toBe(404);
    expect(mocks.moverUpdate).not.toHaveBeenCalled();
    expect(mocks.writeAdminAudit).not.toHaveBeenCalled();
  });

  it("reads a single mover at the VIEWER floor; PATCH requires ADMIN + canUpdate", async () => {
    await GET(getRequest(), params());
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canRead", { minimumRole: "VIEWER" });

    await PATCH(patchRequest(validBody), params());
    expect(mocks.requirePermission).toHaveBeenLastCalledWith("providers", "canUpdate", { minimumRole: "ADMIN" });
  });

  it("maps UNAUTHORIZED/FORBIDDEN to 401/403", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    expect((await GET(getRequest(), params())).status).toBe(401);

    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));
    expect((await PATCH(patchRequest(validBody), params())).status).toBe(403);
  });
});
