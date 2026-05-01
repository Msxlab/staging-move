import { afterEach, describe, expect, it, vi } from "vitest";

const consentMock = vi.hoisted(() => ({
  hasAnalyticsConsent: vi.fn(),
}));

vi.mock("@/lib/consent", () => ({
  hasAnalyticsConsent: consentMock.hasAnalyticsConsent,
}));

function installBrowser() {
  const appendedScripts: Array<Record<string, unknown>> = [];
  const listeners: Record<string, unknown> = {};
  const windowMock = {
    dataLayer: [] as unknown[],
    addEventListener: vi.fn((event: string, handler: unknown) => {
      listeners[event] = handler;
    }),
    localStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
    },
  };
  const documentMock = {
    title: "LocateFlow test",
    head: {
      appendChild: vi.fn((script: Record<string, unknown>) => {
        appendedScripts.push(script);
      }),
    },
    createElement: vi.fn(() => ({ dataset: {} })),
    querySelector: vi.fn(() => null),
  };

  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("document", documentMock);
  return { windowMock, documentMock, appendedScripts };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("Google analytics wrapper", () => {
  it("is a no-op when analytics is not configured", async () => {
    const { windowMock } = installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(true);
    const analytics = await import("./analytics");

    analytics.trackEvent("pricing_viewed", { plan: "individual" });

    expect(windowMock.dataLayer).toEqual([]);
  });

  it("does not load or send events without consent", async () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST");
    const { windowMock, documentMock } = installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(false);
    const analytics = await import("./analytics");

    analytics.consentGranted("nonce-1");
    analytics.trackEvent("pricing_viewed", { plan: "individual" });

    expect(documentMock.head.appendChild).not.toHaveBeenCalled();
    expect(windowMock.dataLayer).toEqual([]);
  });

  it("loads GTM after consent and strips sensitive event parameters", async () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST");
    const { windowMock, appendedScripts } = installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(true);
    const analytics = await import("./analytics");

    analytics.consentGranted("nonce-1");
    analytics.trackEvent("Provider Search", {
      query: "raw provider query",
      query_length: 18,
      email: "person@example.com",
      phone: "5551234567",
      plan: "individual",
    });

    expect(appendedScripts[0]).toMatchObject({
      async: true,
      nonce: "nonce-1",
      src: "https://www.googletagmanager.com/gtm.js?id=GTM-TEST",
    });
    expect(windowMock.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "provider_search",
        query_length: 18,
        plan: "individual",
      }),
    );
    expect(windowMock.dataLayer).not.toContainEqual(
      expect.objectContaining({
        query: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
      }),
    );
  });
});
