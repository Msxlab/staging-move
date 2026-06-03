import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

import {
  acknowledgeGoogleSubscription,
  getGoogleSubscription,
  resetGoogleIapTokenCacheForTests,
} from "./iap-google";

function mockRuntimeConfig(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null),
  );
}

describe("Google Play Developer API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGoogleIapTokenCacheForTests();
  });

  it("keeps service-account private-key auth working when private key is configured", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "locateflow-play-api@example.iam.gserviceaccount.com",
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: privateKeyPem,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "123456789012-abcdef.apps.googleusercontent.com",
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: "GOCSPX-client-secret-123",
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "1//refresh-token",
    });
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href === "https://oauth2.googleapis.com/token") {
        const body = init?.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
        expect(body.get("assertion")).toBeTruthy();
        expect(body.get("refresh_token")).toBeNull();
        return Response.json({ access_token: "ya29.service-account", expires_in: 3600 });
      }
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ya29.service-account" });
      return Response.json({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        latestOrderId: "GPA.123",
        lineItems: [{ productId: "individual.monthly" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGoogleSubscription("purchase-token-1");

    expect(result?.response.subscriptionState).toBe("SUBSCRIPTION_STATE_ACTIVE");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses OAuth refresh-token auth when service-account private-key auth is unavailable", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "locateflow-play-api@example.iam.gserviceaccount.com",
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "123456789012-abcdef.apps.googleusercontent.com",
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: "GOCSPX-client-secret-123",
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "1//refresh-token",
    });
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href === "https://oauth2.googleapis.com/token") {
        const body = init?.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("client_id")).toBe("123456789012-abcdef.apps.googleusercontent.com");
        expect(body.get("client_secret")).toBe("GOCSPX-client-secret-123");
        expect(body.get("refresh_token")).toBe("1//refresh-token");
        return Response.json({ access_token: "ya29.access", expires_in: 3600 });
      }
      expect(href).toBe(
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.locateflow.mobile/purchases/subscriptionsv2/tokens/purchase-token-1",
      );
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ya29.access" });
      return Response.json({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        latestOrderId: "GPA.123",
        lineItems: [{ productId: "individual.monthly" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGoogleSubscription("purchase-token-1");

    expect(result).toMatchObject({
      packageName: "com.locateflow.mobile",
      purchaseToken: "purchase-token-1",
      response: {
        latestOrderId: "GPA.123",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supports desktop OAuth refresh-token auth without a client secret", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "123456789012-abcdef.apps.googleusercontent.com",
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: null,
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "1//refresh-token",
    });
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href === "https://oauth2.googleapis.com/token") {
        const body = init?.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("client_id")).toBe("123456789012-abcdef.apps.googleusercontent.com");
        expect(body.has("client_secret")).toBe(false);
        expect(body.get("refresh_token")).toBe("1//refresh-token");
        return Response.json({ access_token: "ya29.public-client", expires_in: 3600 });
      }
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ya29.public-client" });
      return Response.json({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        latestOrderId: "GPA.123",
        lineItems: [{ productId: "individual.monthly" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGoogleSubscription("purchase-token-1");

    expect(result?.response.latestOrderId).toBe("GPA.123");
  });

  it("does not include OAuth secrets in token failure errors", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "123456789012-abcdef.apps.googleusercontent.com",
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: "GOCSPX-client-secret-123",
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "1//refresh-token",
    });
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("echo GOCSPX-client-secret-123 and 1//refresh-token", { status: 400 }),
    ));

    await expect(getGoogleSubscription("purchase-token-1")).rejects.toThrow("GOOGLE_OAUTH_400");
    await expect(getGoogleSubscription("purchase-token-1")).rejects.not.toThrow("GOCSPX-client-secret-123");
    await expect(getGoogleSubscription("purchase-token-1")).rejects.not.toThrow("1//refresh-token");
  });

  it("uses the cached OAuth access token for acknowledgement calls", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "123456789012-abcdef.apps.googleusercontent.com",
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: "GOCSPX-client-secret-123",
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "1//refresh-token",
    });
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "ya29.cached", expires_in: 3600 });
      }
      if (href.includes("/purchases/subscriptionsv2/tokens/")) {
        return Response.json({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "GPA.123",
          lineItems: [{ productId: "individual.monthly" }],
        });
      }
      expect(href).toBe(
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.locateflow.mobile/purchases/subscriptions/individual.monthly/tokens/purchase-token-1:acknowledge",
      );
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ya29.cached" });
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await getGoogleSubscription("purchase-token-1");
    await acknowledgeGoogleSubscription({
      purchaseToken: "purchase-token-1",
      productId: "individual.monthly",
    });

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url) === "https://oauth2.googleapis.com/token");
    expect(tokenCalls).toHaveLength(1);
  });

  it("fails closed when neither service-account nor OAuth auth is complete", async () => {
    mockRuntimeConfig({
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "locateflow-play-api@example.iam.gserviceaccount.com",
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: null,
      GOOGLE_PLAY_OAUTH_CLIENT_SECRET: null,
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: null,
    });

    await expect(getGoogleSubscription("purchase-token-1")).rejects.toThrow("GOOGLE_API_CREDS_MISSING");
  });
});
