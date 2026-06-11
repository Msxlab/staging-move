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
    processedWebhookEvent: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
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

// Simulate the unique-key conflict the atomic reservation insert raises when a
// duplicate message has already been reserved.
function p2002() {
  return Object.assign(new Error("duplicate"), { code: "P2002" });
}

describe("Play Store RTDN webhook auth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mockRuntimeConfig({});
    mocks.prisma.processedWebhookEvent.findUnique.mockResolvedValue(null);
    mocks.prisma.processedWebhookEvent.create.mockResolvedValue({});
    mocks.prisma.processedWebhookEvent.deleteMany.mockResolvedValue({ count: 1 });
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

  it("rejects package mismatches while keeping the message reserved", async () => {
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
    // A second delivery's reservation insert hits the unique PK and short-circuits.
    mocks.prisma.processedWebhookEvent.create.mockRejectedValueOnce(p2002());
    const retry = await POST(request(envelope));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ skipped: "package_mismatch" });
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    // The first delivery reserves and stays reserved (deterministic rejection,
    // no side effect ran); the second reserve attempt is the duplicate.
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.processedWebhookEvent.deleteMany).not.toHaveBeenCalled();
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
    // The duplicate delivery loses the reservation race.
    mocks.prisma.processedWebhookEvent.create.mockRejectedValueOnce(p2002());
    const second = await POST(request(envelope));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.processedWebhookEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("runs side effects exactly once when duplicate deliveries race", async () => {
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-race", {
      version: "1.0",
      packageName: "com.locateflow.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4,
        purchaseToken: "purchase-token-race",
        subscriptionId: "individual",
      },
    });
    // Only the first reservation insert wins; the racing duplicate hits the PK.
    let reserved = false;
    mocks.prisma.processedWebhookEvent.create.mockImplementation(async () => {
      if (reserved) throw p2002();
      reserved = true;
      return {};
    });

    const [a, b] = await Promise.all([POST(request(envelope)), POST(request(envelope))]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodies = await Promise.all([a.json(), b.json()]);
    expect(bodies.filter((x) => (x as any).duplicate)).toHaveLength(1);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.processedWebhookEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("releases the reservation and stays retryable when refresh fails after reserving", async () => {
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
    // Reserved up-front, then released on failure so Pub/Sub redelivery re-processes.
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: "playstore:msg-2", source: "playstore" },
    });

    mocks.refreshGoogleSubscriptionFor.mockResolvedValueOnce({ provider: "PLAY_STORE", status: "ACTIVE" });
    const retry = await POST(request(envelope));

    expect(retry.status).toBe(200);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
  });

  it("keeps a Google test purchase reserved as a terminal skip", async () => {
    const { POST } = await import("./route");
    const envelope = rtdnEnvelope("msg-test-purchase", {
      version: "1.0",
      packageName: "com.locateflow.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4,
        purchaseToken: "purchase-token-test",
        subscriptionId: "individual",
      },
    });
    // applyIapStateToUser raises the sentinel for a test purchase reaching prod.
    mocks.applyIapStateToUser.mockRejectedValueOnce(
      new Error("GOOGLE_TEST_PURCHASE_IN_PRODUCTION"),
    );

    const response = await POST(request(envelope));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      skipped: "test_purchase_production",
    });
    // The inner catch released the reservation on throw; the outer handler
    // re-reserves it so the message is NOT reprocessed on redelivery.
    expect(mocks.prisma.processedWebhookEvent.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processedWebhookEvent.create).toHaveBeenCalledTimes(2);
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
