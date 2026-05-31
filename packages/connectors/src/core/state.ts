/**
 * Connector core — dispatch state machine.
 *
 * A `ConnectorDispatch` is the durable job (transactional-outbox row) that
 * carries one address change to one connector. Its lifecycle is enforced here
 * in code — not via DB triggers — so transitions are unit-testable and
 * identical across web, workers, and admin tooling.
 *
 *   QUEUED → DISPATCHING → CONFIRMED            (pushed and verified)
 *                       → SUBMITTED → CONFIRMED (async/manual confirmation)
 *                       → NEEDS_USER            (degraded to manual fallback)
 *                       → FAILED → QUEUED        (retry) → … → NEEDS_USER
 *
 * Terminal states are CONFIRMED and NEEDS_USER. FAILED is recoverable: the
 * dispatcher re-queues with backoff until the retry budget is spent, then
 * degrades to NEEDS_USER (the deep-link fallback) so the move is never blocked.
 */

import type { ConnectorOutcome } from "./types";

export type DispatchStatus =
  | "QUEUED" // waiting in the per-connector queue
  | "DISPATCHING" // worker is actively calling the partner
  | "SUBMITTED" // pushed; awaiting async confirmation (webhook / read-back)
  | "CONFIRMED" // verified done — terminal (success)
  | "NEEDS_USER" // degraded to manual fallback — terminal (handed to user)
  | "FAILED"; // last attempt failed; may be re-queued

const ALLOWED: Record<DispatchStatus, readonly DispatchStatus[]> = {
  QUEUED: ["DISPATCHING", "NEEDS_USER"],
  DISPATCHING: ["SUBMITTED", "CONFIRMED", "NEEDS_USER", "FAILED"],
  SUBMITTED: ["CONFIRMED", "NEEDS_USER", "FAILED"],
  FAILED: ["QUEUED", "NEEDS_USER"], // retry path, or give up to fallback
  CONFIRMED: [], // terminal
  NEEDS_USER: [], // terminal
};

/** Whether `from → to` is a legal dispatch transition. */
export function canTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** A dispatch status is terminal when no further transitions are allowed. */
export function isTerminal(status: DispatchStatus): boolean {
  return ALLOWED[status].length === 0;
}

/**
 * Map a connector's `outcome` onto the dispatch status it should move to after
 * an attempt completes. `retryable` decides whether a FAILED outcome becomes a
 * re-queue (QUEUED) or a give-up-to-fallback (NEEDS_USER) — but only the
 * dispatcher, which knows the remaining retry budget, makes that final call.
 */
export function statusForOutcome(outcome: ConnectorOutcome): DispatchStatus {
  switch (outcome) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "SUBMITTED":
      return "SUBMITTED";
    case "NEEDS_USER":
      return "NEEDS_USER";
    case "FAILED":
    default:
      return "FAILED";
  }
}
