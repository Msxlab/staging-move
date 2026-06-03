import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  listRuntimeConfigCatalog: vi.fn(),
  userFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  stripeBalanceRetrieve: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mocks.requireAdmin(...args),
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
  listRuntimeConfigCatalog: (...args: unknown[]) => mocks.listRuntimeConfigCatalog(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      count: vi.fn(),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args),
      upsert: (...args: unknown[]) => mocks.subscriptionUpsert(...args),
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
      count: vi.fn(),
    },
    serviceProvider: { count: vi.fn() },
    userCustomProvider: { count: vi.fn() },
    moveTask: { count: vi.fn() },
    stateRule: { count: vi.fn() },
    movingPlan: { count: vi.fn() },
    auditLog: { count: vi.fn() },
    adminAuditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
    userSession: { count: vi.fn() },
    userEvent: { count: vi.fn() },
    adminUser: { findUnique: vi.fn() },
  },
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function Stripe() {
    return {
      balance: {
        retrieve: (...args: unknown[]) => mocks.stripeBalanceRetrieve(...args),
      },
    };
  }),
}));

import { GET, POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

function getRequest() {
  return new NextRequest("https://admin.locateflow.com/api/settings", {
    method: "GET",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

function catalogItem(key: string, configured = true) {
  return {
    key,
    configured,
    source: configured ? "ENV" : "Missing",
    requiredInProduction: false,
  };
}

const googlePlayBaseKeys = [
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_RTDN_AUDIENCE",
  "MOBILE_ANDROID_PRODUCT_INDIVIDUAL",
  "MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY",
  "MOBILE_ANDROID_PRODUCT_FAMILY",
  "MOBILE_ANDROID_PRODUCT_FAMILY_YEARLY",
  "MOBILE_ANDROID_PRODUCT_PRO",
  "MOBILE_ANDROID_PRODUCT_PRO_YEARLY",
];

describe("admin settings billing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" });
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_runtime_secret_123456789");
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.subscriptionUpsert.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "ADMIN",
      premiumNote: "raw premium reason",
      purchaseToken: "raw-token",
      purchaseTokenHash: "hash-token",
    });
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({ id: "audit_1" });
    mocks.stripeBalanceRetrieve.mockResolvedValue({ available: [{ currency: "usd" }] });
  });

  it("grant_premium requires SUPER_ADMIN settings.canUpdate and subscriptions.canUpdate", async () => {
    await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "support credit",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.requirePermission).toHaveBeenCalledWith("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("subscriptions", "canUpdate", { minimumRole: "SUPER_ADMIN" });
  });

  it("rejects ADMIN with only subscription authority and audits forbidden safely", async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: "admin_2", email: "operator@example.com", role: "ADMIN" });
    mocks.requirePermission.mockImplementation((resource: string) => {
      if (resource === "settings") return Promise.reject(new Error("FORBIDDEN"));
      return Promise.resolve({ adminId: "admin_2", email: "operator@example.com", role: "ADMIN" });
    });

    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      email: "target@example.com",
      durationDays: 30,
      note: "raw premium reason",
      confirmPassword: "secret-password",
      mfaCode: "123456",
      backupCode: "backup-secret",
      stripeSubscriptionId: "sub_live_secret",
      token: "raw-token",
    }));
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(403);
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
    expect(serializedAudit).toContain("PREMIUM_GRANT_FAILED");
    expect(serializedAudit).toContain("forbidden");
    expect(serializedAudit).toContain("noteLength");
    expect(serializedAudit).toContain("user_1");
    expect(serializedAudit).not.toContain("raw premium reason");
    expect(serializedAudit).not.toContain("target@example.com");
    expect(serializedAudit).not.toContain("secret-password");
    expect(serializedAudit).not.toContain("123456");
    expect(serializedAudit).not.toContain("backup-secret");
    expect(serializedAudit).not.toContain("sub_live_secret");
    expect(serializedAudit).not.toContain("raw-token");
  });

  it("audits forbidden when subscriptions.canUpdate is missing", async () => {
    mocks.requirePermission.mockImplementation((resource: string) => {
      if (resource === "settings") return Promise.resolve({ adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" });
      return Promise.reject(new Error("FORBIDDEN"));
    });

    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "raw premium reason",
      confirmPassword: "secret-password",
      backupCode: "backup-secret",
    }));
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(403);
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
    expect(serializedAudit).toContain("PREMIUM_GRANT_FAILED");
    expect(serializedAudit).toContain("forbidden");
    expect(serializedAudit).not.toContain("raw premium reason");
    expect(serializedAudit).not.toContain("secret-password");
    expect(serializedAudit).not.toContain("backup-secret");
  });

  it("grant_premium requires MFA or backup-code step-up and audits failure", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "support credit",
      confirmPassword: "pw",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" },
      "pw",
      expect.objectContaining({ operation: "billing_premium_grant", requireMfa: true }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "PREMIUM_GRANT_FAILED", entityType: "User" }),
    });
  });

  it("grant_premium validation failures are audited without raw note or email", async () => {
    const response = await POST(request({
      action: "grant_premium",
      email: "target@example.com",
      durationDays: 0,
      note: "raw invalid reason",
      confirmPassword: "secret-password",
      mfaCode: "123456",
    }));
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(400);
    expect(serializedAudit).toContain("PREMIUM_GRANT_FAILED");
    expect(serializedAudit).toContain("validation_failed");
    expect(serializedAudit).toContain("noteLength");
    expect(serializedAudit).not.toContain("raw invalid reason");
    expect(serializedAudit).not.toContain("target@example.com");
    expect(serializedAudit).not.toContain("secret-password");
    expect(serializedAudit).not.toContain("123456");
  });

  it("grant_premium writes redacted audit metadata and never logs raw note", async () => {
    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "raw premium reason",
      confirmPassword: "pw",
      backupCode: "backup-1",
    }));
    const body = await response.json();
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(200);
    expect(body.subscription).not.toHaveProperty("purchaseToken");
    expect(body.subscription).not.toHaveProperty("purchaseTokenHash");
    expect(body.subscription).not.toHaveProperty("premiumNote");
    expect(serializedAudit).toContain("noteLength");
    expect(serializedAudit).not.toContain("raw premium reason");
  });

  it("grant_premium audits DB errors safely", async () => {
    mocks.subscriptionUpsert.mockRejectedValue({ code: "P2002", message: "unique failed" });

    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "support credit",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(500);
    expect(serializedAudit).toContain("PREMIUM_GRANT_FAILED");
    expect(serializedAudit).toContain("db_error");
    expect(serializedAudit).not.toContain("support credit");
  });

  it("grant_premium audits unexpected exceptions safely", async () => {
    mocks.subscriptionFindUnique.mockRejectedValue(new Error("unexpected raw db detail"));

    const response = await POST(request({
      action: "grant_premium",
      userId: "user_1",
      durationDays: 30,
      note: "support credit",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(500);
    expect(serializedAudit).toContain("PREMIUM_GRANT_FAILED");
    expect(serializedAudit).toContain("unexpected_exception");
    expect(serializedAudit).not.toContain("unexpected raw db detail");
    expect(serializedAudit).not.toContain("support credit");
  });

  it("test_stripe uses runtime config resolver and returns safe provider errors", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_process_env_should_not_be_used";
    mocks.stripeBalanceRetrieve.mockRejectedValue({ message: "raw stripe outage detail", code: "api_error" });

    const response = await POST(request({ action: "test_stripe" }));
    const body = await response.json();
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ success: false, code: "STRIPE_CONNECTION_FAILED" });
    expect(body.error).toBe("Stripe connection failed.");
    expect(mocks.getAdminRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_SECRET_KEY");
    expect(serializedAudit).not.toContain("raw stripe outage detail");
  });

  it("test_stripe audits missing runtime config with a safe error", async () => {
    mocks.getAdminRuntimeConfigValue.mockResolvedValue(null);

    const response = await POST(request({ action: "test_stripe" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ success: false, code: "STRIPE_CONFIG_INVALID" });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "BILLING_FIELD_UPDATE_FAILED", entityType: "RuntimeConfig" }),
    });
  });
});

describe("admin settings readiness integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" });
  });

  it("treats Google Play Billing as configured when service-account private-key auth is present", async () => {
    mocks.listRuntimeConfigCatalog.mockResolvedValue([
      ...googlePlayBaseKeys.map((key) => catalogItem(key)),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL"),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY"),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_ID", false),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_SECRET", false),
      catalogItem("GOOGLE_PLAY_OAUTH_REFRESH_TOKEN", false),
    ]);

    const response = await GET(getRequest());
    const body = await response.json();
    const mobilePlay = body.integrations.find((item: any) => item.id === "mobile_play");

    expect(response.status).toBe(200);
    expect(mobilePlay).toMatchObject({
      configured: true,
      missingKeys: [],
    });
  });

  it("treats Google Play Billing as configured when OAuth refresh-token auth is present", async () => {
    mocks.listRuntimeConfigCatalog.mockResolvedValue([
      ...googlePlayBaseKeys.map((key) => catalogItem(key)),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL"),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY", false),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_ID"),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_SECRET", false),
      catalogItem("GOOGLE_PLAY_OAUTH_REFRESH_TOKEN"),
    ]);

    const response = await GET(getRequest());
    const body = await response.json();
    const mobilePlay = body.integrations.find((item: any) => item.id === "mobile_play");

    expect(response.status).toBe(200);
    expect(mobilePlay).toMatchObject({
      configured: true,
      missingKeys: [],
    });
  });

  it("reports both Google Play auth alternatives when neither is complete", async () => {
    mocks.listRuntimeConfigCatalog.mockResolvedValue([
      ...googlePlayBaseKeys.map((key) => catalogItem(key)),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL"),
      catalogItem("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY", false),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_ID", false),
      catalogItem("GOOGLE_PLAY_OAUTH_CLIENT_SECRET", false),
      catalogItem("GOOGLE_PLAY_OAUTH_REFRESH_TOKEN", false),
    ]);

    const response = await GET(getRequest());
    const body = await response.json();
    const mobilePlay = body.integrations.find((item: any) => item.id === "mobile_play");

    expect(response.status).toBe(200);
    expect(mobilePlay.configured).toBe(false);
    expect(mobilePlay.missingKeys).toEqual([
      "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_PLAY_OAUTH_CLIENT_ID",
      "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
    ]);
  });
});
