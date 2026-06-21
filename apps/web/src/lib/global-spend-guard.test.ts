import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCfg: vi.fn(),
  rateLimit: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => mocks.rateLimit(...a) }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: (...a: unknown[]) => mocks.getCfg(...a) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: (...a: unknown[]) => mocks.warn(...a) } }));

import { checkGlobalBudget } from "./global-spend-guard";

const NOW = new Date("2026-06-20T12:00:00Z");

/** Route limiter calls by key prefix so budget vs alert gates resolve independently. */
function limiter({ budget, alert }: { budget: boolean; alert: boolean }) {
  return (key: string) =>
    Promise.resolve({ success: key.startsWith("global-spend-alert") ? alert : budget });
}

describe("global-spend-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no cap (allowed) when the config value is unset", async () => {
    mocks.getCfg.mockResolvedValue(null);
    const res = await checkGlobalBudget("ai", { now: NOW });
    expect(res).toEqual({ allowed: true, cap: null });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("treats a non-positive cap as no cap", async () => {
    mocks.getCfg.mockResolvedValue("0");
    const res = await checkGlobalBudget("dossier", { now: NOW });
    expect(res).toEqual({ allowed: true, cap: null });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("allows while under the configured cap", async () => {
    mocks.getCfg.mockResolvedValue("1000");
    mocks.rateLimit.mockImplementation(limiter({ budget: true, alert: true }));
    const res = await checkGlobalBudget("ai", { now: NOW });
    expect(res).toEqual({ allowed: true, cap: 1000 });
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it("blocks and alerts once when over the cap", async () => {
    mocks.getCfg.mockResolvedValue("1000");
    mocks.rateLimit.mockImplementation(limiter({ budget: false, alert: true }));
    const res = await checkGlobalBudget("ai", { now: NOW });
    expect(res).toEqual({ allowed: false, cap: 1000 });
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("blocks without re-alerting once the daily alert was already sent", async () => {
    mocks.getCfg.mockResolvedValue("1000");
    mocks.rateLimit.mockImplementation(limiter({ budget: false, alert: false }));
    const res = await checkGlobalBudget("ai", { now: NOW });
    expect(res).toEqual({ allowed: false, cap: 1000 });
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it("fails OPEN if the limiter throws (a fuse must not break the feature)", async () => {
    mocks.getCfg.mockResolvedValue("1000");
    mocks.rateLimit.mockRejectedValue(new Error("limiter down"));
    const res = await checkGlobalBudget("ai", { now: NOW });
    expect(res).toEqual({ allowed: true, cap: 1000 });
  });
});
