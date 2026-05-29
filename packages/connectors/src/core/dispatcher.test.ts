import { describe, expect, it } from "vitest";
import { planNextDispatch } from "./dispatcher";
import type { ConnectorErrorCode, ConnectorResult } from "./types";

const policy = { maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 60_000, jitter: 0 };
const noJitter = () => 0.5;

function failed(code: ConnectorErrorCode, retryable: boolean): ConnectorResult {
  return { outcome: "FAILED", errorCode: code, retryable };
}

describe("planNextDispatch", () => {
  it("settles CONFIRMED / SUBMITTED / NEEDS_USER without a retry", () => {
    expect(planNextDispatch({ attemptCount: 0, result: { outcome: "CONFIRMED" }, policy })).toEqual({
      status: "CONFIRMED",
      attemptCount: 1,
      retryInMs: null,
    });
    expect(planNextDispatch({ attemptCount: 1, result: { outcome: "SUBMITTED" }, policy }).status).toBe("SUBMITTED");
    expect(planNextDispatch({ attemptCount: 2, result: { outcome: "NEEDS_USER" }, policy }).status).toBe("NEEDS_USER");
  });

  it("re-queues a transient failure with backoff", () => {
    const plan = planNextDispatch({ attemptCount: 0, result: failed("PARTNER_DOWN", true), policy, rand: noJitter });
    expect(plan.status).toBe("QUEUED");
    expect(plan.attemptCount).toBe(1);
    expect(plan.retryInMs).toBe(1_000);
  });

  it("backs off exponentially across attempts", () => {
    expect(planNextDispatch({ attemptCount: 1, result: failed("PARTNER_DOWN", true), policy, rand: noJitter }).retryInMs).toBe(2_000);
    expect(planNextDispatch({ attemptCount: 2, result: failed("PARTNER_DOWN", true), policy, rand: noJitter }).retryInMs).toBe(4_000);
  });

  it("falls back to NEEDS_USER once the retry budget is spent", () => {
    const plan = planNextDispatch({ attemptCount: 3, result: failed("PARTNER_DOWN", true), policy });
    expect(plan.attemptCount).toBe(4);
    expect(plan.status).toBe("NEEDS_USER");
    expect(plan.retryInMs).toBeNull();
  });

  it("falls back immediately for non-retryable failures", () => {
    expect(planNextDispatch({ attemptCount: 0, result: failed("VALIDATION_REJECTED", false), policy }).status).toBe("NEEDS_USER");
    expect(planNextDispatch({ attemptCount: 0, result: failed("AUTH_EXPIRED", false), policy }).status).toBe("NEEDS_USER");
  });
});
