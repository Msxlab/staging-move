import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  verifyPubsubOidcToken: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  prisma: {
    processedWebhookEvent: { create: vi.fn() },
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
  applyIapStateToUser: vi.fn(),
  findUserByIapIdentifier: vi.fn(),
  refreshGoogleSubscriptionFor: vi.fn(),
}));

function request(body: unknown, headers?: Record<string, string>) {
  return new Request("https://app.example.com/api/webhooks/playstore", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as any;
}

describe("Play Store RTDN webhook auth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
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
    mocks.getRuntimeConfigValue.mockResolvedValue("https://app.example.com/api/webhooks/playstore");
    const { POST } = await import("./route");

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing OIDC token",
    });
  });
});
