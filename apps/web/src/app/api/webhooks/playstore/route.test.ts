import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  verifyPubsubOidcToken: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  applyIapStateToUser: vi.fn(),
  findUserByIapIdentifier: vi.fn(),
  refreshGoogleSubscriptionFor: vi.fn(),
  sendIapCancellationNotice: vi.fn(),
  emitSecurityEvent: vi.fn(),
  alertWebhookSignatureFailure: vi.fn(),
  prisma: {
    processedWebhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    subscription: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

vi.mock("@/lib/iap-google", () => ({
  verifyPubsubOidcToken: mocks.verifyPubsubOidcToken,
}));

vi.mock("@/lib/sentry", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

vi.mock("@/lib/db", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/iap-common", () => ({
  applyIapStateToUser: mocks.applyIapStateToUser,
  findUserByIapIdentifier: mocks.findUserByIapIdentifier,
  refreshGoogleSubscriptionFor: mocks.refreshGoogleSubscriptionFor,
  sendIapCancellationNotice: mocks.sendIapCancellationNotice,
}));

vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: (...args: any[]) => mocks.emitSecurityEvent(...args),
}));

vi.mock("@/lib/security-alerts", () => ({
  alertWebhookSignatureFailure: (...args: any[]) => {
    mocks.alertWebhookSignatureFailure(...args);
    return Promise.resolve();
  },
}));

function request(body: unknown, headers?: Record<string, string>) {
  return new Request("https://app.example.com/api/webhooks/playstore", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as any;
}

function mockRuntimeConfig(overrides: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null),
  );
}

describe("Play Store RTDN webhook auth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mockRuntimeConfig({});
    mocks.prisma.processedWebhookEvent.findUnique.mockResolvedValue(null);
    mocks.prisma.processedWebhookEvent.create.mockResolvedValue({});
    mocks.findUserByIapIdentifier.mockResolvedValue({ userId: "user-1" });
    mocks.refreshGoogleSubscriptionFor.mockResolvedValue({ provider: "PLAY_STORE", status: "ACTIVE" });
    mocks.applyIapStateToUser.mockResolvedValue({});
  });

  it("fails closed in production when GOOGLE_PLAY_RTDN_AUDIENCE is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("./route");

    const response = await POST(request({}));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("audience is not configured"),
    });
    expect(mocks.verifyPubsubOidcToken).not.toHaveBeenCalled();
    expect(mocks.prisma.processedWebhookEvent.create).not.toHaveBeenCalled();
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("GOOGLE_PLAY_RTDN_AUDIENCE unset"),
      "error",
    );
  });

  it("keeps the missing-audience escape hatch outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { POST } = await import("./route");

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      empty: true,
    });
  });

  it("requires an OIDC bearer token when an audience is configured", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_RTDN_AUDIENCE: "https://app.example.com/api/webhooks/playstore",
    });
    const { POST } = await import("./route");

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing OIDC token",
    });
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "WEBHOOK_SIG_FAILURE",
      context: expect.objectContaining({ provider: "playstore", reason: "missing_oidc_token" }),
    }));
    // The operator email alarm fires alongside the structured event.
    expect(mocks.alertWebhookSignatureFailure).toHaveBeenCalledWith({
      provider: "playstore",
      reason: "missing_oidc_token",
    });
  });

  it("accepts a valid expected service account identity", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_RTDN_AUDIENCE: "https://app.example.com/api/webhooks/playstore",
      EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL: "rtdn-push@project.iam.gserviceaccount.com",
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.app",
    });
    mocks.verifyPubsubOidcToken.mockResolvedValue({
      audience: "https://app.example.com/api/webhooks/playstore",
      issuer: "https://accounts.google.com",
      subject: "subject-1",
      email: "rtdn-push@project.iam.gserviceaccount.com",
      emailVerified: true,
    });
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-expected", {
      version: "1.0",
      packageName: "com.locateflow.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4,
        purchaseToken: "purchase-token-1",
        subscriptionId: "individual",
      },
    });

    const response = await POST(request(envelope, { authorization: "Bearer oidc-token" }));

    expect(response.status).toBe(200);
    expect(mocks.verifyPubsubOidcToken).toHaveBeenCalledWith(
      "oidc-token",
      "https://app.example.com/api/webhooks/playstore",
    );
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
  });

  it("rejects a valid audience with the wrong service account", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_RTDN_AUDIENCE: "https://app.example.com/api/webhooks/playstore",
      EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL: "rtdn-push@project.iam.gserviceaccount.com",
    });
    mocks.verifyPubsubOidcToken.mockResolvedValue({
      audience: "https://app.example.com/api/webhooks/playstore",
      issuer: "https://accounts.google.com",
      subject: "subject-1",
      email: "other@project.iam.gserviceaccount.com",
      emailVerified: true,
    });
    const { POST } = await import("./route");

    const response = await POST(request({}, { authorization: "Bearer oidc-token" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid OIDC identity" });
    expect(mocks.prisma.processedWebhookEvent.create).not.toHaveBeenCalled();
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ reason: "unexpected_service_account" }),
    }));
  });

  it("fails closed in production when expected identity is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockRuntimeConfig({
      GOOGLE_PLAY_RTDN_AUDIENCE: "https://app.example.com/api/webhooks/playstore",
    });
    const { POST } = await import("./route");

    const response = await POST(request({}, { authorization: "Bearer oidc-token" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("identity is not configured"),
    });
    expect(mocks.verifyPubsubOidcToken).not.toHaveBeenCalled();
  });

  it("rejects package mismatches after marking the message idempotent", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.app",
    });
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-package", {
      version: "1.0",
      packageName: "com.attacker.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4,
        purchaseToken: "purchase-token-1",
        subscriptionId: "individual",
      },
    });

    const response = await POST(request(envelope));
    mocks.prisma.processedWebhookEvent.findUnique.mockResolvedValueOnce({ id: "playstore:msg-package" });
    const retry = await POST(request(envelope));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ skipped: "package_mismatch" });
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate messages after success", async () => {
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-1", {
      version: "1.0",
      packageName: "com.locateflow.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4,
        purchaseToken: "purchase-token-1",
        subscriptionId: "individual",
      },
    });

    const first = await POST(request(envelope));
    mocks.prisma.processedWebhookEvent.findUnique.mockResolvedValueOnce({ id: "playstore:msg-1" });
    const second = await POST(request(envelope));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it("keeps a message retryable when refresh fails before mutation", async () => {
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-2", {
      version: "1.0",
      packageName: "com.locateflow.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 2,
        purchaseToken: "purchase-token-2",
        subscriptionId: "individual",
      },
    });
    mocks.refreshGoogleSubscriptionFor.mockRejectedValueOnce(new Error("refresh failed"));

    const failed = await POST(request(envelope));
    expect(failed.status).toBe(500);
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    expect(mocks.prisma.processedWebhookEvent.create).not.toHaveBeenCalled();

    mocks.refreshGoogleSubscriptionFor.mockResolvedValueOnce({ provider: "PLAY_STORE", status: "ACTIVE" });
    const retry = await POST(request(envelope));

    expect(retry.status).toBe(200);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(1);
  });
});

function rtdnEnvelope(messageId: string, payload: Record<string, unknown>) {
  return {
    message: {
      messageId,
      data: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
    },
  };
}
