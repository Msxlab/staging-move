import { describe, expect, it, vi, afterEach } from "vitest";
import {
  emitSecurityEvent,
  redactContext,
  setSecurityEventSink,
} from "./security-events";

describe("redactContext", () => {
  it("redacts known-bad keys at any depth", () => {
    const out = redactContext({
      ok: "value",
      password: "hunter2",
      nested: {
        mfaCode: "123456",
        ok2: "ok",
        deeper: { backupCode: "ABCD-EFGH" },
      },
    });
    expect(out).toEqual({
      ok: "value",
      password: "[REDACTED]",
      nested: {
        mfaCode: "[REDACTED]",
        ok2: "ok",
        deeper: { backupCode: "[REDACTED]" },
      },
    });
  });

  it("redacts partial matches like *_token / *_secret / *_password / *_key / *_pwd", () => {
    const out = redactContext({
      sessionToken: "abc",
      sessiontoken: "abc",
      stripeSecretKey: "sk_live_abc",
      newPassword: "p1",
      pwd_hash: "x",
      apiKey: "y",
      ok: "ok",
    });
    expect(out).toMatchObject({
      sessionToken: "[REDACTED]",
      sessiontoken: "[REDACTED]",
      stripeSecretKey: "[REDACTED]",
      newPassword: "[REDACTED]",
      pwd_hash: "[REDACTED]",
      apiKey: "[REDACTED]",
      ok: "ok",
    });
  });

  it("redacts DB connection strings and Redis URLs", () => {
    const out = redactContext({
      DATABASE_URL: "postgres://user:pass@host/db",
      database_url: "postgres://...",
      UPSTASH_REDIS_REST_URL: "https://...",
      UPSTASH_REDIS_REST_TOKEN: "token",
      ok: "ok",
    });
    expect(out).toMatchObject({
      DATABASE_URL: "[REDACTED]",
      database_url: "[REDACTED]",
      UPSTASH_REDIS_REST_URL: "[REDACTED]",
      UPSTASH_REDIS_REST_TOKEN: "[REDACTED]",
      ok: "ok",
    });
  });

  it("does not mutate the input", () => {
    const input = { password: "x", ok: "ok" };
    const before = JSON.stringify(input);
    redactContext(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("walks arrays and truncates oversize collections", () => {
    const arr = Array.from({ length: 150 }, (_, i) => ({ token: i }));
    const out = redactContext(arr) as Array<Record<string, unknown>>;
    expect(out).toHaveLength(100);
    expect(out[0]).toEqual({ token: "[REDACTED]" });
  });

  it("caps recursion depth at TRUNCATED to avoid pathological structures", () => {
    type Recursive = { next?: Recursive };
    const root: Recursive = {};
    let cur: Recursive = root;
    for (let i = 0; i < 20; i++) {
      cur.next = {};
      cur = cur.next;
    }
    const out = redactContext(root);
    expect(JSON.stringify(out)).toContain("[TRUNCATED]");
  });

  it("preserves Date by converting to ISO string", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(redactContext({ d })).toEqual({ d: d.toISOString() });
  });
});

describe("emitSecurityEvent", () => {
  afterEach(() => {
    setSecurityEventSink(null);
    vi.restoreAllMocks();
  });

  it("never throws even when context contains circular structures", () => {
    type Cyclic = { self?: Cyclic };
    const ctx: Cyclic = {};
    ctx.self = ctx;
    expect(() =>
      emitSecurityEvent({
        type: "RATE_LIMIT_HIT",
        severity: "warn",
        context: ctx as unknown as Record<string, unknown>,
      }),
    ).not.toThrow();
  });

  it("invokes downstream sink with redacted payload", () => {
    const sink = vi.fn();
    setSecurityEventSink(sink);
    emitSecurityEvent({
      type: "RATE_LIMIT_HIT",
      severity: "warn",
      group: "auth_login",
      context: { password: "secret", userId: "u1" },
    });
    expect(sink).toHaveBeenCalledTimes(1);
    const payload = sink.mock.calls[0][0];
    expect(payload.type).toBe("RATE_LIMIT_HIT");
    expect(payload.context).toMatchObject({
      password: "[REDACTED]",
      userId: "u1",
    });
    expect(payload.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("swallows downstream sink errors", () => {
    setSecurityEventSink(() => {
      throw new Error("sink boom");
    });
    expect(() =>
      emitSecurityEvent({
        type: "LIMITER_DEGRADED",
        severity: "warn",
        context: { reason: "timeout" },
      }),
    ).not.toThrow();
  });

  it("logs at the appropriate console level by severity", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    emitSecurityEvent({ type: "RATE_LIMIT_SHADOW_HIT", severity: "info" });
    emitSecurityEvent({ type: "RATE_LIMIT_HIT", severity: "warn" });
    emitSecurityEvent({ type: "INTERNAL_SECRET_MISUSE", severity: "error" });

    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(1);
  });
});
