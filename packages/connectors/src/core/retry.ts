/**
 * Connector core — retry policy.
 *
 * Pushing to an external partner is unreliable, so transient failures are
 * retried with exponential backoff + jitter (jitter prevents thundering-herd
 * retries across many users hitting the same partner at once). Whether a
 * failure is even worth retrying is decided by the normalized error taxonomy —
 * a rate-limit or partner outage is transient, but a validation rejection or
 * expired grant is not (retrying would just fail again or needs the user).
 */

import type { ConnectorErrorCode } from "./types";

export interface RetryPolicy {
  /** Total attempts including the first. Default 4. */
  maxAttempts: number;
  /** Base delay before the first retry, in ms. Default 1000. */
  baseDelayMs: number;
  /** Upper bound on any single backoff, in ms. Default 60000. */
  maxDelayMs: number;
  /** Jitter as a fraction of the delay (0..1). Default 0.2. */
  jitter: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitter: 0.2,
};

/** Error codes worth retrying — everything else is terminal or needs the user. */
const RETRYABLE_CODES: ReadonlySet<ConnectorErrorCode> = new Set<ConnectorErrorCode>([
  "RATE_LIMITED",
  "PARTNER_DOWN",
]);

/** Whether a given failure code should be retried at all. */
export function isRetryableErrorCode(code: ConnectorErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

/**
 * Backoff (ms) before the given retry attempt. `attempt` is 1-based: attempt 1
 * is the first retry (after the initial try failed). Exponential, capped, with
 * +/- `jitter` fraction applied. `rand` is injectable for deterministic tests.
 */
export function nextBackoffMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  rand: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = policy.baseDelayMs * 2 ** exponent;
  const capped = Math.min(raw, policy.maxDelayMs);
  // Symmetric jitter: capped * (1 ± jitter).
  const delta = capped * policy.jitter * (rand() * 2 - 1);
  return Math.max(0, Math.round(capped + delta));
}

/**
 * Whether another attempt should run, given the failure code and how many
 * attempts have already happened (`attemptsSoFar`, 1-based).
 */
export function shouldRetry(
  code: ConnectorErrorCode,
  attemptsSoFar: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  return isRetryableErrorCode(code) && attemptsSoFar < policy.maxAttempts;
}
