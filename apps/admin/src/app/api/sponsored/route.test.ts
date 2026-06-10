import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  placementFindMany: vi.fn(),
  placementCount: vi.fn(),
  placementCreate: vi.fn(),
  moverFindUnique: vi.fn(),
  moverFindMany: vi.fn(),
  providerFindUnique: vi.fn(),
  providerFindMany: vi.fn(),
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
      findMany: mocks.placementFindMany,
      count: mocks.placementCount,
      create: mocks.placementCreate,
    },
    movingCompany: {
      findUnique: mocks.moverFindUnique,
      findMany: mocks.moverFindMany,
    },
    serviceProvider: {
      findUnique: mocks.providerFindUnique,
      findMany: mocks.providerFindMany,
    },
    adminAuditLog: { create: mocks.auditCreate },
  },
}));

import { GET, POST } from "./route";

function getRequest(query: string) {
  return new Request(`https://admin.locateflow.com/api/sponsored${query}`) as any;
}

function postRequest(body: unknown) {
  return new Request("https://admin.locateflow.com/api/sponsored", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const validBody = {
  kind: "mover",
  targetId: "mover_1",
  label: "Sponsored",
  stateScope: "TX",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-08-01T00:00:00.000Z",
  active: true,
  confirmPassword: "correct horse battery staple",
  mfaCode: "123456",
};

describe("admin sponsored placements collection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "a@x.com", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.placementFindMany.mockResolvedValue([]);
    mocks.placementCount.mockResolvedValue(0);
    mocks.placementCreate.mockImplementation(async ({ data }: any) => ({ id: "sp_new", impressions: 0, clicks: 0, ...data }));
    mocks.moverFindUnique.mockResolvedValue({ id: "mover_1", active: true, hhgAuthorization: true, complaintCount2y: 0 });
    mocks.moverFindMany.mockResolvedValue([]);
    mocks.providerFindUnique.mockResolvedValue({ id: "prov_1", isActive: true });
    mocks.providerFindMany.mockResolvedValue([]);
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: any) =>
      callback({
        sponsoredPlacement: {
          findMany: mocks.placementFindMany,
          create: mocks.placementCreate,
        },
      }),
    );
  });

  it("creates a placement and writes an audit row", async () => {
    const response = await POST(postRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.placement).toMatchObject({ kind: "mover", targetId: "mover_1", stateScope: "TX", active: true });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SPONSORED_PLACEMENT_CREATE",
          entityType: "SponsoredPlacement",
        }),
      }),
    );
  });

  it("rejects create without password + MFA step-up (403, nothing written)", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(postRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.placementCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("forwards body step-up credentials with requireMfa and keeps them out of placement columns", async () => {
    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(201);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct horse battery staple",
      expect.objectContaining({
        operation: "sponsored_placement_create",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(mocks.placementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ confirmPassword: expect.anything() }),
      }),
    );
  });

  it("never accepts impressions/clicks from the body (counters are read-only)", async () => {
    const response = await POST(postRequest({ ...validBody, impressions: 9999, clicks: 5000 }));

    expect(response.status).toBe(201);
    expect(mocks.placementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ impressions: expect.anything() }),
      }),
    );
    expect(mocks.placementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ clicks: expect.anything() }),
      }),
    );
  });

  it("refuses an ineligible mover target (inactive / no HHG authorization)", async () => {
    mocks.moverFindUnique.mockResolvedValueOnce({
      id: "mover_1",
      active: true,
      hhgAuthorization: false,
      complaintCount2y: 0,
    });

    const response = await POST(postRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("TARGET_NOT_ELIGIBLE");
    expect(mocks.placementCreate).not.toHaveBeenCalled();
  });

  it("refuses a mover above the complaint ceiling even when paying", async () => {
    mocks.moverFindUnique.mockResolvedValueOnce({
      id: "mover_1",
      active: true,
      hhgAuthorization: true,
      complaintCount2y: 42,
    });

    const response = await POST(postRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("TARGET_NOT_ELIGIBLE");
    expect(body.error).toContain("complaint ceiling");
  });

  it("refuses an inactive provider target", async () => {
    mocks.providerFindUnique.mockResolvedValueOnce({ id: "prov_1", isActive: false });

    const response = await POST(
      postRequest({ ...validBody, kind: "provider", targetId: "prov_1" }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("TARGET_NOT_ELIGIBLE");
  });

  it("returns 409 when an overlapping active placement covers the same surface + scope", async () => {
    mocks.placementFindMany.mockResolvedValueOnce([
      { id: "sp_existing", startsAt: "2026-07-15T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z" },
    ]);

    const response = await POST(postRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ACTIVE_PLACEMENT_CONFLICT");
    expect(mocks.placementCreate).not.toHaveBeenCalled();
  });

  it("rejects a blank disclosure label — FTC labeling is mandatory", async () => {
    const response = await POST(postRequest({ ...validBody, label: "   " }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("FTC");
    expect(mocks.placementCreate).not.toHaveBeenCalled();
  });

  it("rejects an inverted date window", async () => {
    const response = await POST(
      postRequest({ ...validBody, startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-07-01T00:00:00.000Z" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.placementCreate).not.toHaveBeenCalled();
  });

  it("lists placements with hydrated target summaries", async () => {
    mocks.placementFindMany.mockResolvedValueOnce([
      {
        id: "sp_1",
        kind: "mover",
        targetId: "mover_1",
        label: "Sponsored",
        stateScope: "TX",
        categoryScope: null,
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-08-01T00:00:00.000Z",
        active: true,
        impressions: 12,
        clicks: 3,
      },
    ]);
    mocks.placementCount.mockResolvedValueOnce(1);
    mocks.moverFindMany.mockResolvedValueOnce([
      { id: "mover_1", legalName: "ACME VAN LINES", dbaName: "Acme Movers", usdotNumber: 12345, state: "TX", active: true },
    ]);

    const response = await GET(getRequest("?status=active"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.placements[0].target).toMatchObject({ name: "Acme Movers" });
    expect(body.total).toBe(1);
  });

  it("keeps orphaned placements visible with target: null", async () => {
    mocks.placementFindMany.mockResolvedValueOnce([
      {
        id: "sp_orphan",
        kind: "provider",
        targetId: "prov_gone",
        label: "Sponsored",
        stateScope: null,
        categoryScope: null,
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-08-01T00:00:00.000Z",
        active: true,
        impressions: 0,
        clicks: 0,
      },
    ]);
    mocks.placementCount.mockResolvedValueOnce(1);
    mocks.providerFindMany.mockResolvedValueOnce([]);

    const response = await GET(getRequest(""));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.placements).toHaveLength(1);
    expect(body.placements[0].target).toBeNull();
  });

  it("searches mover targets by USDOT number for the picker", async () => {
    mocks.moverFindMany.mockResolvedValueOnce([
      {
        id: "mover_1",
        usdotNumber: 12345,
        legalName: "ACME VAN LINES",
        dbaName: null,
        state: "TX",
        city: "Austin",
        complaintCount2y: 2,
        safetyRating: "Satisfactory",
      },
    ]);

    const response = await GET(getRequest("?targetSearch=12345&kind=mover"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.targets[0]).toMatchObject({ id: "mover_1", name: "ACME VAN LINES", eligible: true });
    expect(mocks.moverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          hhgAuthorization: true,
          OR: expect.arrayContaining([{ usdotNumber: 12345 }]),
        }),
      }),
    );
  });

  it("requires only canRead for list/search but canCreate + ADMIN for create", async () => {
    await GET(getRequest(""));
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canRead", { minimumRole: "VIEWER" });

    await POST(postRequest(validBody));
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canCreate", { minimumRole: "ADMIN" });
  });

  it("maps UNAUTHORIZED/FORBIDDEN to 401/403", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    expect((await GET(getRequest(""))).status).toBe(401);

    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));
    expect((await POST(postRequest(validBody))).status).toBe(403);
  });
});
