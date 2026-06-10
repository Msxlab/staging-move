import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  placementFindUnique: vi.fn(),
  placementFindMany: vi.fn(),
  placementUpdate: vi.fn(),
  placementDelete: vi.fn(),
  moverFindUnique: vi.fn(),
  providerFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    sponsoredPlacement: {
      findUnique: mocks.placementFindUnique,
      findMany: mocks.placementFindMany,
      update: mocks.placementUpdate,
      delete: mocks.placementDelete,
    },
    movingCompany: { findUnique: mocks.moverFindUnique },
    serviceProvider: { findUnique: mocks.providerFindUnique },
    adminAuditLog: { create: mocks.auditCreate },
  },
}));

import { DELETE, GET, PATCH } from "./route";

const params = Promise.resolve({ id: "sp_1" });

function request(method: string, body?: unknown) {
  return new Request("https://admin.locateflow.com/api/sponsored/sp_1", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as any;
}

const existingPlacement = {
  id: "sp_1",
  kind: "mover",
  targetId: "mover_1",
  label: "Sponsored",
  categoryScope: null,
  stateScope: "TX",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-08-01T00:00:00.000Z",
  active: false,
  impressions: 0,
  clicks: 0,
};

const stepUp = { confirmPassword: "correct horse battery staple", mfaCode: "123456" };

describe("admin sponsored placement [id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "a@x.com", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.placementFindUnique.mockResolvedValue({ ...existingPlacement });
    mocks.placementFindMany.mockResolvedValue([]);
    mocks.placementUpdate.mockImplementation(async ({ data }: any) => ({ ...existingPlacement, ...data }));
    mocks.placementDelete.mockResolvedValue({ ...existingPlacement });
    mocks.moverFindUnique.mockResolvedValue({ id: "mover_1", active: true, hhgAuthorization: true, complaintCount2y: 0 });
    mocks.providerFindUnique.mockResolvedValue({ id: "prov_1", isActive: true });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: any) =>
      callback({
        sponsoredPlacement: {
          findMany: mocks.placementFindMany,
          update: mocks.placementUpdate,
        },
      }),
    );
  });

  it("GET returns the placement, 404 when missing", async () => {
    const ok = await GET(request("GET"), { params });
    expect(ok.status).toBe(200);

    mocks.placementFindUnique.mockResolvedValueOnce(null);
    const missing = await GET(request("GET"), { params });
    expect(missing.status).toBe(404);
  });

  it("PATCH rejects without step-up and writes nothing", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await PATCH(request("PATCH", { active: true }), { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.placementUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("PATCH updates, audits, and strips step-up + counter fields from the write", async () => {
    const response = await PATCH(
      request("PATCH", { ...stepUp, label: "Featured Partner", impressions: 999, clicks: 999 }),
      { params },
    );

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      stepUp.confirmPassword,
      expect.objectContaining({ operation: "sponsored_placement_update", requireMfa: true }),
    );
    expect(mocks.placementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { label: "Featured Partner" },
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SPONSORED_PLACEMENT_UPDATE" }),
      }),
    );
  });

  it("PATCH re-checks eligibility when activating and blocks ineligible targets", async () => {
    mocks.moverFindUnique.mockResolvedValueOnce({
      id: "mover_1",
      active: false,
      hhgAuthorization: true,
      complaintCount2y: 0,
    });

    const response = await PATCH(request("PATCH", { ...stepUp, active: true }), { params });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("TARGET_NOT_ELIGIBLE");
    expect(mocks.placementUpdate).not.toHaveBeenCalled();
  });

  it("PATCH validates the merged window, not just the diff", async () => {
    // endsAt moved before the EXISTING startsAt.
    const response = await PATCH(
      request("PATCH", { ...stepUp, endsAt: "2026-06-01T00:00:00.000Z" }),
      { params },
    );

    expect(response.status).toBe(400);
    expect(mocks.placementUpdate).not.toHaveBeenCalled();
  });

  it("PATCH returns 409 on an overlapping active same-scope placement", async () => {
    mocks.placementFindMany.mockResolvedValueOnce([
      { id: "sp_other", startsAt: "2026-07-10T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z" },
    ]);

    const response = await PATCH(request("PATCH", { ...stepUp, active: true }), { params });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ACTIVE_PLACEMENT_CONFLICT");
    expect(mocks.placementUpdate).not.toHaveBeenCalled();
  });

  it("PATCH refuses to blank the FTC disclosure label", async () => {
    const response = await PATCH(request("PATCH", { ...stepUp, label: "" }), { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("FTC");
  });

  it("DELETE refuses once traffic has been recorded (counters are the billing record)", async () => {
    mocks.placementFindUnique.mockResolvedValueOnce({ ...existingPlacement, impressions: 12 });

    const response = await DELETE(request("DELETE", stepUp), { params });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PLACEMENT_HAS_TRAFFIC");
    expect(mocks.placementDelete).not.toHaveBeenCalled();
  });

  it("DELETE removes an untouched placement behind step-up and audits it", async () => {
    const response = await DELETE(request("DELETE", stepUp), { params });

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      stepUp.confirmPassword,
      expect.objectContaining({ operation: "sponsored_placement_delete", requireMfa: true }),
    );
    expect(mocks.placementDelete).toHaveBeenCalledWith({ where: { id: "sp_1" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SPONSORED_PLACEMENT_DELETE" }),
      }),
    );
  });

  it("DELETE without step-up fails closed with 403", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await DELETE(request("DELETE"), { params });

    expect(response.status).toBe(403);
    expect(mocks.placementDelete).not.toHaveBeenCalled();
  });

  it("gates PATCH at canUpdate and DELETE at canDelete with ADMIN minimum", async () => {
    await PATCH(request("PATCH", { ...stepUp, label: "Sponsored" }), { params });
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canUpdate", { minimumRole: "ADMIN" });

    await DELETE(request("DELETE", stepUp), { params });
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canDelete", { minimumRole: "ADMIN" });
  });
});
