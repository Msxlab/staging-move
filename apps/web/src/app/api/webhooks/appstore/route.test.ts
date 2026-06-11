import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAppleJws: vi.fn(),
  applyIapStateToUser: vi.fn(),
  findUserByIapIdentifier: vi.fn(),
  refreshAppleSubscriptionFor: vi.fn(),
  sendIapCancellationNotice: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  emitSecurityEvent: vi.fn(),
  alertWebhookSignatureFailure: vi.fn(),
  prisma: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    subscription: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/sentry", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));
vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));
vi.mock("@/lib/iap-apple", () => ({
  verifyAppleJws: mocks.verifyAppleJws,
}));
vi.mock("@/lib/iap-common", () => ({
  applyIapStateToUser: mocks.applyIapStateToUser,
  findUserByIapIdentifier: mocks.findUserByIapIdentifier,
  refreshAppleSubscriptionFor: mocks.refreshAppleSubscriptionFor,
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

import { POST } from "./route";

const processedMock = mocks.prisma.processedWebhookEvent as {
  findUnique: Mock;
  create: Mock;
};

function request() {
  return new Request("https://app.locateflow.com/api/webhooks/appstore", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedPayload: "outer-jws" }),
  }) as any;
}

function mockNotification(notificationUUID = "apple-notification-1") {
  mocks.verifyAppleJws
    .mockReturnValueOnce({
      notificationUUID,
      notificationType: "DID_RENEW",
      signedDate: Date.now(),
      data: { bundleId: "com.locateflow.mobile", signedTransactionInfo: "transaction-jws" },
    })
    .mockReturnValueOnce({
      originalTransactionId: "apple-original-transaction",
      bundleId: "com.locateflow.mobile",
    });
}

describe("App Store webhook idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    mocks.getRuntimeConfigValue.mockResolvedValue("com.locateflow.mobile");
    mocks.findUserByIapIdentifier.mockResolvedValue({ userId: "user-1" });
    mocks.refreshAppleSubscriptionFor.mockResolvedValue({ provider: "APP_STORE", status: "ACTIVE" });
    mocks.applyIapStateToUser.mockResolvedValue({});
  });

  it("skips duplicate notifications after success", async () => {
    mockNotification();
    const first = await POST(request());
    processedMock.findUnique.mockResolvedValueOnce({ id: "apple-notification-1" });
    mocks.verifyAppleJws.mockReturnValueOnce({
      notificationUUID: "apple-notification-1",
      notificationType: "DID_RENEW",
      signedDate: Date.now(),
      data: { bundleId: "com.locateflow.mobile", signedTransactionInfo: "transaction-jws" },
    });

    const second = await POST(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(1);
  });

  it("keeps a notification retryable when refresh fails before mutation", async () => {
    mockNotification();
    mocks.refreshAppleSubscriptionFor.mockRejectedValueOnce(new Error("refresh failed"));

    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();

    mockNotification();
    const retry = await POST(request());

    expect(retry.status).toBe(200);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(1);
  });

  it("emits a safe security event when outer JWS verification fails", async () => {
    mocks.verifyAppleJws.mockImplementationOnce(() => {
      throw new Error("bad jws");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "WEBHOOK_SIG_FAILURE",
      context: expect.objectContaining({
        provider: "appstore",
        reason: "outer_jws_verify_failed",
        tokenLength: "outer-jws".length,
      }),
    }));
    // The operator email alarm fires alongside the structured event.
    expect(mocks.alertWebhookSignatureFailure).toHaveBeenCalledWith({
      provider: "appstore",
      reason: "outer_jws_verify_failed",
    });
    expect(processedMock.create).not.toHaveBeenCalled();
  });

  it("rejects App Store notifications for the wrong bundle id", async () => {
    mocks.verifyAppleJws.mockReturnValueOnce({
      notificationUUID: "apple-notification-bad-bundle",
      notificationType: "DID_RENEW",
      signedDate: Date.now(),
      data: { bundleId: "com.attacker.app", signedTransactionInfo: "transaction-jws" },
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid bundle" });
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "WEBHOOK_SIG_FAILURE",
      context: expect.objectContaining({
        provider: "appstore",
        reason: "bundle_mismatch",
      }),
    }));
    expect(mocks.alertWebhookSignatureFailure).toHaveBeenCalledWith({
      provider: "appstore",
      reason: "bundle_mismatch",
    });
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();
  });
});
