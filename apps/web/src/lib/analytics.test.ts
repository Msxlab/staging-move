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
    location: { pathname: "/test" },
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
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("Google analytics wrapper", () => {
  it("does not send Google events when analytics is not configured", async () => {
    const { windowMock } = installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    const analytics = await import("./analytics");

    analytics.trackEvent("pricing_viewed", { plan: "individual" });

    expect(windowMock.dataLayer).toEqual([]);
    analytics.consentDenied();
  }, 15_000);

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

  it("queues consented trackEvent calls to the internal UserEvent pipeline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(true);
    const analytics = await import("./analytics");

    analytics.trackEvent("AI Briefing Viewed", {
      surface: "dashboard",
      email: "person@example.com",
      briefing_state: "fallback",
    });
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).toHaveBeenCalledWith("/api/tracking/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            event: "ai_briefing_viewed",
            page: "/test",
            metadata: {
              surface: "dashboard",
              briefing_state: "fallback",
            },
          },
        ],
      }),
    });
  });

  it("does not emit internal events without analytics consent", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(false);
    const analytics = await import("./analytics");

    analytics.trackEvent("ai_briefing_viewed", { surface: "dashboard" });
    await vi.runOnlyPendingTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads GTM after consent and strips sensitive event parameters", async () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
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
    analytics.consentDenied();
  });

  it("slug-normalizes a phase-1 offer_key before it reaches GTM (no free-text/PII leak)", async () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    const { windowMock } = installBrowser();
    consentMock.hasAnalyticsConsent.mockReturnValue(true);
    const analytics = await import("./analytics");

    analytics.consentGranted("nonce-1");
    // A hypothetical free-text/partner-name offer_key must NOT reach Google raw.
    analytics.trackEvent("offer_clicked", { offer_key: "Sparkle Cleaning Co! <x>", surface: "pricing" });

    const pushed = windowMock.dataLayer.find(
      (e) => (e as Record<string, unknown>)?.event === "offer_clicked",
    ) as Record<string, unknown> | undefined;
    expect(pushed).toBeTruthy();
    expect(String(pushed!.offer_key)).toMatch(/^[a-z0-9_]+$/);
    expect(pushed!.surface).toBe("pricing");
    analytics.consentDenied();
  });
});
