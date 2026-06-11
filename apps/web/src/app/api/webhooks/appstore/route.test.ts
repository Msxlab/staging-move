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
      deleteMany: vi.fn(),
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
  deleteMany: Mock;
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

// Simulate the unique-key conflict the atomic reservation insert raises when a
// duplicate notification has already been reserved.
function p2002() {
  return Object.assign(new Error("duplicate"), { code: "P2002" });
}

describe("App Store webhook idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    processedMock.deleteMany.mockResolvedValue({ count: 1 });
    mocks.getRuntimeConfigValue.mockResolvedValue("com.locateflow.mobile");
    mocks.findUserByIapIdentifier.mockResolvedValue({ userId: "user-1" });
    mocks.refreshAppleSubscriptionFor.mockResolvedValue({ provider: "APP_STORE", status: "ACTIVE" });
    mocks.applyIapStateToUser.mockResolvedValue({});
  });

  it("skips duplicate notifications after success", async () => {
    mockNotification();
    const first = await POST(request());

    // The second delivery's atomic reservation insert hits the unique PK and
    // bails before any side effect runs.
    mockNotification();
    processedMock.create.mockRejectedValueOnce(p2002());
    const second = await POST(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    // Both deliveries attempt to reserve; only the first succeeds.
    expect(processedMock.create).toHaveBeenCalledTimes(2);
    // The losing duplicate never reaches the side-effect block, so it never
    // releases the winner's reservation.
    expect(processedMock.deleteMany).not.toHaveBeenCalled();
  });

  it("runs side effects exactly once when duplicate deliveries race", async () => {
    // Two concurrent deliveries of the same notification: the first reservation
    // insert wins, the second hits the unique PK and short-circuits as a
    // duplicate — so applyIapStateToUser runs exactly once.
    //
    // Key the JWS verify on its input (not a one-shot queue) so it stays
    // deterministic no matter how the two in-flight requests interleave.
    mocks.verifyAppleJws.mockImplementation((token: string) =>
      token === "outer-jws"
        ? {
            notificationUUID: "apple-notification-1",
            notificationType: "DID_RENEW",
            signedDate: Date.now(),
            data: { bundleId: "com.locateflow.mobile", signedTransactionInfo: "transaction-jws" },
          }
        : {
            originalTransactionId: "apple-original-transaction",
            bundleId: "com.locateflow.mobile",
          },
    );
    let reserved = false;
    processedMock.create.mockImplementation(async () => {
      if (reserved) throw p2002();
      reserved = true;
      return {};
    });

    const [a, b] = await Promise.all([POST(request()), POST(request())]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const bodies = await Promise.all([a.json(), b.json()]);
    expect(bodies.filter((x) => (x as any).duplicate)).toHaveLength(1);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(2);
    // The winner succeeds, so nothing is released.
    expect(processedMock.deleteMany).not.toHaveBeenCalled();
  });

  it("releases the reservation and stays retryable when refresh fails after reserving", async () => {
    mockNotification();
    mocks.refreshAppleSubscriptionFor.mockRejectedValueOnce(new Error("refresh failed"));

    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(mocks.applyIapStateToUser).not.toHaveBeenCalled();
    // Reserved up-front, then released on failure so Apple's retry re-processes.
    expect(processedMock.create).toHaveBeenCalledTimes(1);
    expect(processedMock.deleteMany).toHaveBeenCalledTimes(1);
    expect(processedMock.deleteMany).toHaveBeenCalledWith({
      where: { id: "apple-notification-1", source: "appstore" },
    });

    mockNotification();
    const retry = await POST(request());

    expect(retry.status).toBe(200);
    expect(mocks.applyIapStateToUser).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(2);
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
    // Signature failure short-circuits before the reservation.
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
    // Outer bundle check short-circuits before the reservation.
    expect(processedMock.create).not.toHaveBeenCalled();
  });
});
