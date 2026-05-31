import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionCreate: vi.fn(),
  userUpdateMany: vi.fn(),
  userLoginSessionUpdateMany: vi.fn(),
  userSessionUpdateMany: vi.fn(),
  gdprFindFirst: vi.fn(),
  gdprFindMany: vi.fn(),
  gdprCreate: vi.fn(),
  gdprUpdate: vi.fn(),
  adminAuditCreate: vi.fn(),
  auditLogFindMany: vi.fn(),
  userSessionFindMany: vi.fn(),
  userEventFindMany: vi.fn(),
  userEventGroupBy: vi.fn(),
  pushDeviceFindMany: vi.fn(),
  userLoginSessionFindMany: vi.fn(),
  adminAuditFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => {
  const prisma = {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      update: (...args: unknown[]) => mocks.userUpdate(...args),
      updateMany: (...args: unknown[]) => mocks.userUpdateMany(...args),
    },
    auditLog: {
      findMany: (...args: unknown[]) => mocks.auditLogFindMany(...args),
    },
    userSession: {
      findMany: (...args: unknown[]) => mocks.userSessionFindMany(...args),
      updateMany: (...args: unknown[]) => mocks.userSessionUpdateMany(...args),
    },
    userEvent: {
      findMany: (...args: unknown[]) => mocks.userEventFindMany(...args),
      groupBy: (...args: unknown[]) => mocks.userEventGroupBy(...args),
    },
    pushDevice: {
      findMany: (...args: unknown[]) => mocks.pushDeviceFindMany(...args),
    },
    userLoginSession: {
      findMany: (...args: unknown[]) => mocks.userLoginSessionFindMany(...args),
      updateMany: (...args: unknown[]) => mocks.userLoginSessionUpdateMany(...args),
    },
    subscription: {
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
      create: (...args: unknown[]) => mocks.subscriptionCreate(...args),
    },
    gDPRRequest: {
      findFirst: (...args: unknown[]) => mocks.gdprFindFirst(...args),
      findMany: (...args: unknown[]) => mocks.gdprFindMany(...args),
      create: (...args: unknown[]) => mocks.gdprCreate(...args),
      update: (...args: unknown[]) => mocks.gdprUpdate(...args),
    },
    adminAuditLog: {
      findMany: (...args: unknown[]) => mocks.adminAuditFindMany(...args),
      create: (...args: unknown[]) => mocks.adminAuditCreate(...args),
    },
  };
  // Soft-delete-aware default + raw escape hatch share the same mock
  // surface in tests.
  return { prisma, prismaUnsafe: prisma, rawPrisma: prisma };
});

vi.mock("@/lib/user-notify", () => ({
  notifyUserOfAdminChange: vi.fn(),
}));

import { DELETE, GET, PATCH, POST } from "./route";

function request(confirmPassword = "admin-password") {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmPassword }),
  });
}

describe("admin user detail subscription redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "viewer@example.com", role: "VIEWER" });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      firstName: "Person",
      lastName: "Example",
      imageUrl: null,
      passwordHash: "hash",
      emailVerifiedAt: null,
      mfaEnabled: false,
      preferredLocale: "en",
      dashboardWidgetPrefs: null,
      showBudget: true,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      deletedAt: null,
      subscription: {
        id: "sub_1",
        userId: "user_1",
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        platform: "web",
        stripeCustomerId: "cus_live_sensitive1234",
        stripeSubscriptionId: "sub_live_sensitive5678",
        stripePriceId: "price_live_sensitive9012",
        stripeCurrentPeriodEnd: null,
        billingProductId: "prod_live_sensitive3456",
        originalTransactionId: "100000111122223333",
        latestTransactionId: "100000111122224444",
        currentPeriodEndsAt: null,
        gracePeriodEndsAt: null,
        lastValidatedAt: null,
        lastSyncedAt: null,
        accessType: "PAID",
        billingInterval: "MONTH",
        freeAccessEndsAt: null,
        cancelAtPeriodEnd: false,
        firstChargeAt: null,
        firstChargeAmount: null,
        autoRenew: true,
        campaignId: "campaign_1",
        campaignCode: "WELCOME",
        campaignSnapshot: "{\"raw\":true}",
        checkoutConsentSnapshot: "{\"rawConsent\":true}",
        termsVersion: "2026-01",
        subscriptionPolicyVersion: "2026-01",
        refundPolicyVersion: "2026-01",
        trialEndsAt: null,
        canceledAt: null,
        premiumUntil: null,
        premiumGrantedBy: null,
        premiumGrantedAt: null,
        premiumNote: "raw operator note",
        version: 1,
        createdAt: new Date("2026-05-01T00:00:00Z"),
        updatedAt: new Date("2026-05-01T00:00:00Z"),
      },
      profile: null,
      addresses: [],
      movingPlans: [],
      customProviders: [],
      moveTasks: [],
      budgets: [],
      supportTickets: [],
      oauthAccounts: [],
      dataConsents: [],
      emailVerificationTokens: [],
      passwordResetTokens: [],
    });
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.userSessionFindMany.mockResolvedValue([]);
    mocks.userEventFindMany.mockResolvedValue([]);
    mocks.userEventGroupBy.mockResolvedValue([]);
    mocks.pushDeviceFindMany.mockResolvedValue([]);
    mocks.userLoginSessionFindMany.mockResolvedValue([]);
    mocks.gdprFindMany.mockResolvedValue([]);
    mocks.adminAuditFindMany.mockResolvedValue([]);
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("redacts subscription provider IDs and premium notes for VIEWER", async () => {
    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users/user_1"),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.user.subscription.stripeCustomerId).toBe("cus_****1234");
    expect(body.user.subscription.stripeSubscriptionId).toBe("sub_****5678");
    expect(body.user.subscription.premiumNote).toBeNull();
    expect(body.user.subscription.campaignSnapshot).toBeNull();
    expect(body.user.subscription.checkoutConsentSnapshot).toBeNull();
    expect(body.user.subscription).not.toHaveProperty("purchaseToken");
    expect(serialized).not.toContain("cus_live_sensitive1234");
    expect(serialized).not.toContain("sub_live_sensitive5678");
    expect(serialized).not.toContain("raw operator note");
  });

  it("returns raw operational subscription IDs to ADMIN without purchase tokens", async () => {
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "admin@example.com", role: "ADMIN" });

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users/user_1"),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.subscription.stripeCustomerId).toBe("cus_live_sensitive1234");
    expect(body.user.subscription.stripeSubscriptionId).toBe("sub_live_sensitive5678");
    expect(body.user.subscription.premiumNote).toBe("raw operator note");
    expect(body.user.subscription).not.toHaveProperty("purchaseToken");
    expect(body.user.subscription).not.toHaveProperty("purchaseTokenHash");
  });
});

describe("admin user detail delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: null,
      subscription: null,
    });
    mocks.gdprFindFirst.mockResolvedValue(null);
    mocks.gdprCreate.mockResolvedValue({ id: "gdpr_1", status: "PENDING" });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userLoginSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.adminAuditCreate.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({});
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.subscriptionCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback) =>
      callback({
        user: { updateMany: mocks.userUpdateMany },
        userLoginSession: { updateMany: mocks.userLoginSessionUpdateMany },
        userSession: { updateMany: mocks.userSessionUpdateMany },
        gDPRRequest: { create: mocks.gdprCreate, update: mocks.gdprUpdate },
        adminAuditLog: { create: mocks.adminAuditCreate },
      }),
    );
  });

  it("soft-deletes the user, revokes sessions, and audits after the mutation", async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(mocks.userSessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", isActive: true },
      data: { isActive: false, sessionEnd: expect.any(Date), lastActivity: expect.any(Date) },
    });
    expect(mocks.gdprCreate).toHaveBeenCalledTimes(1);
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
    expect(mocks.adminAuditCreate.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.userUpdateMany.mock.invocationCallOrder[0],
    );
  });

  it("does not audit or mutate when password confirmation fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Incorrect password.",
    });

    const response = await DELETE(request("wrong"), { params: Promise.resolve({ id: "user_1" }) });

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETE_FAILED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("skips users with a processing GDPR delete request", async () => {
    mocks.gdprFindFirst.mockResolvedValue({ id: "gdpr_processing", status: "PROCESSING" });

    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.skippedReason).toBe("processing_gdpr_request");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("skips already deleted users without writing an audit log", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
      subscription: null,
    });

    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("restores a soft-deleted user, cancels pending admin cleanup, and writes an audit log", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
    });
    mocks.gdprFindFirst.mockResolvedValue({
      id: "gdpr_pending",
      status: "PENDING",
      requestData: JSON.stringify({ source: "admin", cleanup: { userDeleted: false } }),
    });
    mocks.gdprUpdate.mockResolvedValue({ id: "gdpr_pending", status: "REJECTED" });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "admin-password" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.restored).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users", "canDelete", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    expect(mocks.gdprUpdate).toHaveBeenCalledWith({
      where: { id: "gdpr_pending" },
      data: expect.objectContaining({
        status: "REJECTED",
        completedAt: expect.any(Date),
      }),
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_RESTORED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("does not restore when password confirmation fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Incorrect password.",
    });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "wrong" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_RESTORE_FAILED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("does not restore when GDPR deletion cleanup is already processing", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
    });
    mocks.gdprFindFirst.mockResolvedValue({ id: "gdpr_processing", status: "PROCESSING" });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "admin-password" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.skippedReason).toBe("processing_gdpr_request");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("requires MFA step-up before revoking user login sessions", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke_login_session", sessionId: "login_1", confirmPassword: "pw" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_SESSION_REVOKE_FAILED",
        entityType: "UserLoginSession",
        entityId: "login_1",
      }),
    });
  });
});

describe("admin user detail billing updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Person",
      lastName: "Example",
      subscription: {
        plan: "FREE_TRIAL",
        status: "TRIALING",
        premiumUntil: null,
        trialEndsAt: null,
      },
    });
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.subscriptionCreate.mockResolvedValue({});
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("requires password confirmation before admin subscription and premium edits", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required for this operation.",
    });

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "INDIVIDUAL" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "BILLING_FIELD_UPDATE_FAILED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("requires subscriptions.canUpdate for billing field PATCH even when users.canUpdate passes", async () => {
    mocks.requirePermission.mockImplementation((resource: string) => {
      if (resource === "users") return Promise.resolve({ adminId: "admin_1" });
      return Promise.reject(new Error("FORBIDDEN"));
    });

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "INDIVIDUAL", confirmPassword: "admin-password", mfaCode: "123456" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
  });

  it("audits admin subscription and premium edits after password confirmation", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          plan: "INDIVIDUAL",
          subscriptionStatus: "ACTIVE",
          premiumUntil: "2026-05-27",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1" },
      "admin-password",
      expect.objectContaining({ operation: "billing_subscription_update", requireMfa: true }),
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        premiumUntil: expect.any(Date),
        premiumGrantedBy: "admin_1",
        premiumGrantedAt: expect.any(Date),
      }),
    });
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "admin_1",
        action: "BILLING_FIELD_UPDATED",
        entityType: "User",
        entityId: "user_1",
        ipAddress: "203.0.113.10",
      }),
    });
  });

  it("clears manual premium markers when revoking to default free access", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Person",
      lastName: "Example",
      subscription: {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "FREE_ACCESS",
        stripeSubscriptionId: null,
        originalTransactionId: null,
        latestTransactionId: null,
        purchaseTokenHash: null,
        premiumUntil: new Date("2026-12-01T00:00:00.000Z"),
        premiumGrantedBy: "admin_previous",
        premiumGrantedAt: new Date("2026-05-01T00:00:00.000Z"),
        freeAccessEndsAt: null,
        cancelAtPeriodEnd: true,
        autoRenew: false,
      },
    });

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: "FREE_TRIAL",
          subscriptionStatus: "FREE_ACCESS",
          provider: "TRIAL",
          accessType: "FREE_ACCESS",
          premiumUntil: null,
          freeAccessEndsAt: "2026-12-15",
          cancelAtPeriodEnd: false,
          autoRenew: false,
          confirmPassword: "admin-password",
          mfaCode: "123456",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
        premiumUntil: null,
        premiumGrantedBy: null,
        premiumGrantedAt: null,
        freeAccessEndsAt: expect.any(Date),
        cancelAtPeriodEnd: false,
        autoRenew: false,
      }),
    });
  });

  it("rejects unsupported plan values", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: "BUSINESS",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it.each(["FAMILY", "PRO"])("accepts %s as a grantable plan (doc 62 cascade)", async (plan) => {
    mocks.subscriptionUpdate.mockResolvedValue({});

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          subscriptionStatus: "ACTIVE",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({ plan, status: "ACTIVE" }),
    });
  });

  it("accepts FREE_ACCESS as a valid status (round-trips the dropdown)", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriptionStatus: "FREE_ACCESS",
          freeAccessEndsAt: "2026-12-01",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalled();
  });

  it("rejects accessType=PAID against provider=ADMIN", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessType: "PAID",
          provider: "ADMIN",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("rejects status=ACTIVE on provider=ADMIN without premiumUntil", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriptionStatus: "ACTIVE",
          provider: "ADMIN",
          premiumUntil: null,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
  });

  it("rejects autoRenew=true and cancelAtPeriodEnd=true together", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autoRenew: true,
          cancelAtPeriodEnd: true,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
  });

  it("rejects provider-paid ACTIVE states without provider identifiers", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Person",
      lastName: "Example",
      subscription: {
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
        stripeSubscriptionId: null,
        originalTransactionId: null,
        latestTransactionId: null,
        purchaseTokenHash: null,
      },
    });

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "STRIPE",
          accessType: "PAID",
          subscriptionStatus: "ACTIVE",
          confirmPassword: "admin-password",
          mfaCode: "123456",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("INVALID_PROVIDER_BACKED_ENTITLEMENT_STATE");
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "BILLING_FIELD_UPDATE_FAILED",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("derives autoRenew when admin sets cancelAtPeriodEnd alone", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cancelAtPeriodEnd: true,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        cancelAtPeriodEnd: true,
        autoRenew: false,
      }),
    });
  });
});
