import { describe, expect, it } from "vitest";
import { DEFAULT_RETRY_POLICY, isRetryableErrorCode, nextBackoffMs, shouldRetry } from "./retry";

describe("retry policy", () => {
  it("classifies which error codes are retryable", () => {
    expect(isRetryableErrorCode("PARTNER_DOWN")).toBe(true);
    expect(isRetryableErrorCode("RATE_LIMITED")).toBe(true);
    expect(isRetryableErrorCode("VALIDATION_REJECTED")).toBe(false);
    expect(isRetryableErrorCode("AUTH_EXPIRED")).toBe(false);
    expect(isRetryableErrorCode("SCHEMA_DRIFT")).toBe(false);
    expect(isRetryableErrorCode("PERMANENT_REJECT")).toBe(false);
  });

  it("grows backoff exponentially and caps it (no jitter when rand=0.5)", () => {
    const policy = { maxAttempts: 10, baseDelayMs: 1_000, maxDelayMs: 30_000, jitter: 0.2 };
    const noJitter = () => 0.5; // delta = 0
    expect(nextBackoffMs(1, policy, noJitter)).toBe(1_000);
    expect(nextBackoffMs(2, policy, noJitter)).toBe(2_000);
    expect(nextBackoffMs(3, policy, noJitter)).toBe(4_000);
    expect(nextBackoffMs(10, policy, noJitter)).toBe(30_000); // capped
  });

  it("applies symmetric jitter within bounds", () => {
    const policy = { maxAttempts: 10, baseDelayMs: 1_000, maxDelayMs: 30_000, jitter: 0.2 };
    expect(nextBackoffMs(1, policy, () => 0)).toBe(800); // -20%
    expect(nextBackoffMs(1, policy, () => 1)).toBe(1_200); // +20%
  });

  it("never returns a negative delay", () => {
    const policy = { maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100, jitter: 5 };
    expect(nextBackoffMs(1, policy, () => 0)).toBeGreaterThanOrEqual(0);
  });

  it("stops retrying non-retryable codes or once attempts are exhausted", () => {
    expect(shouldRetry("PARTNER_DOWN", 1, DEFAULT_RETRY_POLICY)).toBe(true);
    expect(shouldRetry("PARTNER_DOWN", DEFAULT_RETRY_POLICY.maxAttempts, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(shouldRetry("VALIDATION_REJECTED", 1, DEFAULT_RETRY_POLICY)).toBe(false);
  });
});
