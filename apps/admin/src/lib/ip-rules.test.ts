import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/internal-secrets", () => ({
  getInternalCallerSecret: vi.fn(() => "internal-secret-0123456789abcdef"),
}));

import {
  __resetIPRulesCacheForTests,
  checkIPAccess,
  evaluateIPAccessForRules,
} from "./ip-rules";

const BASE_URL = "https://admin.locateflow.test";

function rulesResponse(rules: unknown[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ rules }),
  } as unknown as Response;
}

function blockRule(ip: string) {
  return { ipAddress: ip, type: "BLACKLIST", isActive: true, expiresAt: null };
}

describe("checkIPAccess cache freshness (SEC-RL ban lag)", () => {
  beforeEach(() => {
    __resetIPRulesCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    __resetIPRulesCacheForTests();
  });

  it("blocks a blacklisted IP from the internal rules feed", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(rulesResponse([blockRule("203.0.113.7")])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkIPAccess("203.0.113.7", BASE_URL);

    expect(result.blocked).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves from cache within the TTL (no fetch per request)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(rulesResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 5; i++) {
      await checkIPAccess("198.51.100.20", BASE_URL);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("picks up a newly written BLOCK rule within ~60 seconds", async () => {
    let rules: unknown[] = [];
    const fetchMock = vi.fn(() => Promise.resolve(rulesResponse(rules)));
    vi.stubGlobal("fetch", fetchMock);

    expect((await checkIPAccess("203.0.113.9", BASE_URL)).blocked).toBe(false);

    // Admin writes a ban; within the TTL the old snapshot still serves...
    rules = [blockRule("203.0.113.9")];
    vi.advanceTimersByTime(30_000);
    expect((await checkIPAccess("203.0.113.9", BASE_URL)).blocked).toBe(false);

    // ...but once the 60s TTL elapses the ban is enforced.
    vi.advanceTimersByTime(31_000);
    expect((await checkIPAccess("203.0.113.9", BASE_URL)).blocked).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares a single in-flight refresh across concurrent stale requests", async () => {
    let release: (value: Response) => void = () => {};
    const gated = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(() => gated);
    vi.stubGlobal("fetch", fetchMock);

    const inFlight = Promise.all([
      checkIPAccess("203.0.113.50", BASE_URL),
      checkIPAccess("203.0.113.50", BASE_URL),
      checkIPAccess("203.0.113.50", BASE_URL),
    ]);
    release(rulesResponse([blockRule("203.0.113.50")]));
    const results = await inFlight;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.blocked).toBe(true);
    }
  });

  it("backs off after a failed refresh instead of retrying on every request", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));
    vi.stubGlobal("fetch", fetchMock);

    // Several requests in quick succession: only one refresh attempt, and
    // enforcement stays fail-open on the (empty) previous snapshot.
    for (let i = 0; i < 4; i++) {
      expect((await checkIPAccess("203.0.113.80", BASE_URL)).blocked).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After the backoff window a fresh attempt is made.
    vi.advanceTimersByTime(16_000);
    await checkIPAccess("203.0.113.80", BASE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("evaluateIPAccessForRules", () => {
  it("ignores inactive and expired rules", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    expect(
      evaluateIPAccessForRules("203.0.113.7", [
        { ipAddress: "203.0.113.7", type: "BLACKLIST", isActive: false, expiresAt: null },
        {
          ipAddress: "203.0.113.7",
          type: "BLACKLIST",
          isActive: true,
          expiresAt: new Date(now.getTime() - 1000).toISOString(),
        },
      ]).blocked,
    ).toBe(false);
  });

  it("enforces CIDR blacklists", () => {
    const result = evaluateIPAccessForRules("203.0.113.77", [
      { ipAddress: "203.0.113.0/24", type: "BLACKLIST", isActive: true, expiresAt: null },
    ]);
    expect(result.blocked).toBe(true);
  });
});
