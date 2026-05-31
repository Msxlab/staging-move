/**
 * Connector core — dispatch planner.
 *
 * Decides what happens to a ConnectorDispatch after one attempt completes:
 * confirm, await async confirmation, re-queue with backoff, or give up to the
 * manual fallback. This encodes the golden rule — retry while the failure is
 * transient and the budget remains, then degrade to NEEDS_USER so a connector
 * failure never blocks the user's move. Pure function: the durable worker is a
 * thin I/O shell around this tested logic.
 */

import type { ConnectorResult } from "./types";
import type { DispatchStatus } from "./state";
import { statusForOutcome } from "./state";
import { DEFAULT_RETRY_POLICY, nextBackoffMs, shouldRetry, type RetryPolicy } from "./retry";

export interface DispatchPlan {
  /** Status the dispatch should move to. */
  status: DispatchStatus;
  /** Attempts made so far, including the one that just completed. */
  attemptCount: number;
  /** Delay before the retry in ms; null unless `status` is QUEUED. */
  retryInMs: number | null;
}

/**
 * Plan the next dispatch state from the attempt just made.
 *
 * @param attemptCount attempts made BEFORE this one (0 on the first try)
 */
export function planNextDispatch(input: {
  attemptCount: number;
  result: ConnectorResult;
  policy?: RetryPolicy;
  rand?: () => number;
}): DispatchPlan {
  const policy = input.policy ?? DEFAULT_RETRY_POLICY;
  const attemptCount = input.attemptCount + 1; // this attempt just ran
  const base = statusForOutcome(input.result.outcome);

  // CONFIRMED / SUBMITTED / NEEDS_USER are settled for this pass.
  if (base !== "FAILED") {
    return { status: base, attemptCount, retryInMs: null };
  }

  // FAILED: retry only while transient AND within budget; otherwise degrade to
  // the manual fallback rather than leaving the move stuck.
  const code = input.result.errorCode ?? "UNKNOWN";
  const canRetry = (input.result.retryable ?? false) && shouldRetry(code, attemptCount, policy);
  if (canRetry) {
    return {
      status: "QUEUED",
      attemptCount,
      retryInMs: nextBackoffMs(attemptCount, policy, input.rand),
    };
  }
  return { status: "NEEDS_USER", attemptCount, retryInMs: null };
}
