import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    address: { findUnique: vi.fn() },
    serviceProvider: { findUnique: vi.fn(), update: vi.fn() },
    userCustomProvider: { findFirst: vi.fn() },
  },
}));

const authMocks = vi.hoisted(() => ({
  expireUserSessionCookies: vi.fn(
    (response: Response, _host?: string | null) => response,
  ),
}));

vi.mock("@/lib/auth", () => ({
  createUserAuthDiagnostics: vi.fn(() => ({
    cookieCandidatesCount: 0,
    jwtCandidateValidCount: 0,
    dbSessionFound: null,
    sessionExpired: null,
    fingerprintMatched: null,
    jwtUserMatchesSession: null,
    jwtUserFound: null,
    sessionUserFound: null,
    dbUserFound: null,
    canonicalUserFound: null,
    canonicalUserDeleted: null,
    userLookupClient: null,
    emailVerified: null,
    finalFailureCode: null,
  })),
  expireUserSessionCookies: authMocks.expireUserSessionCookies,
  requireDbUserId: vi.fn(),
  requireVerifiedUser: vi.fn(),
}));

const expireUserSessionCookiesMock = authMocks.expireUserSessionCookies;

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({})),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  isEncrypted: vi.fn((value: string) => typeof value === "string" && value.startsWith("enc:")),
}));

vi.mock("@/lib/move-task-sync", () => ({
  safeSyncMoveTasksForAddress: vi.fn(() => Promise.resolve({ attemptedPlans: 0, generatedCount: 0, skippedCount: 0, failedPlanIds: [] })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId, requireVerifiedUser } from "@/lib/auth";
import { DELETE, PATCH } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockRequireVerifiedUser = requireVerifiedUser as unknown as Mock;
const mockService = prisma.service as unknown as {
  findUnique: Mock;
  findMany: Mock;
  update: Mock;
};
const mockServiceProvider = prisma.serviceProvider as unknown as {
  findUnique: Mock;
  update: Mock;
};

function serviceParams(id = "service-1") {
  return { params: Promise.resolve({ id }) };
}

describe("service detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockRequireVerifiedUser.mockResolvedValue("user-1");
    mockService.findUnique.mockResolvedValue({
      id: "service-1",
      userId: "user-1",
      addressId: "address-1",
      category: "UTILITY_ELECTRIC",
      providerName: "PSE&G",
      providerId: "provider-1",
      customProviderId: null,
      deletedAt: null,
    });
    mockService.findMany.mockResolvedValue([]);
    mockService.update.mockResolvedValue({
      id: "service-1",
      accountNumber: "",
      phone: "",
      email: "",
      notes: "",
    });
    mockServiceProvider.findUnique.mockResolvedValue({ id: "provider-1", deletedAt: null });
  });

  it("allows editable private fields to be cleared with empty strings", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/services/service-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName: "PSE&G",
          accountNumber: "",
          phone: "",
          email: "",
          notes: "",
        }),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountNumber: "",
          phone: "",
          email: "",
          notes: "",
        }),
      }),
    );
    expect(body.service).toMatchObject({
      accountNumber: "",
      phone: "",
      email: "",
      notes: "",
    });
  });

  it("returns EMAIL_VERIFICATION_REQUIRED for unverified service edits", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const response = await PATCH(
      new Request("http://localhost/api/services/service-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName: "PSE&G" }),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      redirectTo: "/verify-email?redirect=%2Fservices",
    });
    expect(mockService.update).not.toHaveBeenCalled();
  });

  it("updates only the user service row when editing provider-facing fields", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/services/service-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName: "My PSE&G",
          website: "https://example.com/account",
          monthlyCost: 42,
          notes: "user-only note",
        }),
      }) as any,
      serviceParams() as any,
    );

    expect(response.status).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "service-1" },
        data: expect.objectContaining({
          providerName: "My PSE&G",
          website: "https://example.com/account",
          monthlyCost: 42,
        }),
      }),
    );
    expect(mockServiceProvider.update).not.toHaveBeenCalled();
  });

  it("allows the owner to delete a service without checking service plan limits", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockServiceProvider.update).not.toHaveBeenCalled();
    expect(mockService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "service-1" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deactivatedAt: expect.any(Date),
          isActive: false,
        }),
      }),
    );
  });

  it("returns UNAUTHORIZED for unauthenticated service deletes before ownership checks", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "UNAUTHORIZED",
      error: "Please sign in again.",
    });
    expect(mockService.findUnique).not.toHaveBeenCalled();
    expect(mockService.update).not.toHaveBeenCalled();
  });

  it("returns EMAIL_VERIFICATION_REQUIRED for unverified service deletes", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      error: "Please verify your email to manage services.",
    });
    expect(mockService.update).not.toHaveBeenCalled();
  });

  it("does not let a non-owner delete another user's service", async () => {
    mockService.findUnique.mockResolvedValueOnce({
      id: "service-1",
      userId: "user-2",
      addressId: "address-1",
      category: "UTILITY_ELECTRIC",
      providerName: "PSE&G",
      providerId: "provider-1",
      customProviderId: null,
      deletedAt: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
      serviceParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(mockService.update).not.toHaveBeenCalled();
    expect(mockServiceProvider.update).not.toHaveBeenCalled();
  });

  it("uses Service.id for delete and treats provider ids as not found", async () => {
    mockService.findUnique.mockResolvedValueOnce(null);

    const response = await DELETE(
      new Request("http://localhost/api/services/provider-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
      serviceParams("provider-1") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(mockService.findUnique).toHaveBeenCalledWith({ where: { id: "provider-1" } });
    expect(mockService.update).not.toHaveBeenCalled();
    expect(mockServiceProvider.update).not.toHaveBeenCalled();
  });
});

describe("service detail route auth diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockRequireVerifiedUser.mockResolvedValue("user-1");
    mockService.findUnique.mockResolvedValue({
      id: "service-1",
      userId: "user-1",
      addressId: "address-1",
      category: "UTILITY_ELECTRIC",
      providerName: "PSE&G",
      providerId: null,
      customProviderId: null,
      deletedAt: null,
    });
    mockService.update.mockResolvedValue({});
  });

  it("exposes X-LocateFlow-Auth-Failure with the diagnostics finalFailureCode on a route 401", async () => {
    // Simulate getUserSession marking the legacy-session case before requireVerifiedUser throws.
    mockRequireVerifiedUser.mockImplementationOnce(async ({ diagnostics }: { diagnostics: any }) => {
      diagnostics.finalFailureCode = "DB_SESSION_NOT_FOUND";
      throw new Error("UNAUTHORIZED");
    });

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", host: "app.locateflow.com" },
      }) as any,
      serviceParams() as any,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("X-LocateFlow-Auth-Layer")).toBe("route");
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBe("DB_SESSION_NOT_FOUND");
    expect(expireUserSessionCookiesMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to UNAUTHORIZED when no diagnostic stage was recorded", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }) as any,
      serviceParams() as any,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBe("UNAUTHORIZED");
    expect(expireUserSessionCookiesMock).toHaveBeenCalledTimes(1);
  });

  it("returns 403 EMAIL_VERIFICATION_REQUIRED with diagnostic header and no cookie clear", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }) as any,
      serviceParams() as any,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("X-LocateFlow-Auth-Layer")).toBe("route");
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(expireUserSessionCookiesMock).not.toHaveBeenCalled();
  });

  it("does not set the diagnostic header on a successful authenticated DELETE", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/services/service-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }) as any,
      serviceParams() as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-LocateFlow-Auth-Layer")).toBeNull();
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBeNull();
    expect(expireUserSessionCookiesMock).not.toHaveBeenCalled();
  });

  it("surfaces a route 401 + diagnostics on PATCH and GET, not just DELETE", async () => {
    mockRequireVerifiedUser.mockImplementationOnce(async ({ diagnostics }: { diagnostics: any }) => {
      diagnostics.finalFailureCode = "FINGERPRINT_MISMATCH";
      throw new Error("UNAUTHORIZED");
    });
    const patchResponse = await PATCH(
      new Request("http://localhost/api/services/service-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName: "PSE&G" }),
      }) as any,
      serviceParams() as any,
    );
    expect(patchResponse.status).toBe(401);
    expect(patchResponse.headers.get("X-LocateFlow-Auth-Failure")).toBe("FINGERPRINT_MISMATCH");

    mockRequireDbUserId.mockImplementationOnce(async ({ diagnostics }: { diagnostics: any }) => {
      diagnostics.finalFailureCode = "SESSION_EXPIRED";
      throw new Error("UNAUTHORIZED");
    });
    const { GET } = await import("./route");
    const getResponse = await GET(
      new Request("http://localhost/api/services/service-1") as any,
      serviceParams() as any,
    );
    expect(getResponse.status).toBe(401);
    expect(getResponse.headers.get("X-LocateFlow-Auth-Failure")).toBe("SESSION_EXPIRED");
  });
});
