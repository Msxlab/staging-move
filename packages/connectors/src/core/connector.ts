/**
 * Connector core — the adapter contract.
 *
 * Every partner integration implements `AddressConnector`. The interface is
 * deliberately narrow: a pure mapping (`buildRequest`), one side-effecting
 * method (`push`), and optional verify / webhook / health hooks. Because the
 * only way a connector reaches the outside world is through the injected
 * `ConnectorContext`, the framework — not the connector — owns auth, egress,
 * timeouts, retries, and the circuit breaker.
 */

import type {
  CanonicalAddressChange,
  ConnectorContext,
  ConnectorManifest,
  ConnectorRequest,
  ConnectorResult,
  HealthResult,
} from "./types";

export interface AddressConnector {
  /** Self-declaration: capabilities, scopes, allowed hosts, fallback. */
  readonly manifest: ConnectorManifest;

  /**
   * Pure mapping from the canonical change to a partner-shaped request. Must be
   * deterministic and side-effect free so it is trivially unit-testable with
   * recorded fixtures (contract tests). Building the request never sends it.
   */
  buildRequest(input: CanonicalAddressChange): ConnectorRequest;

  /**
   * Perform the address update. The ONLY side-effecting method. Uses
   * `ctx.http` (allowlisted, timed, breaker-wrapped) and `ctx.accessToken`.
   * Returns a normalized result; must not throw for expected partner failures
   * — map them to `outcome: "FAILED"` with a taxonomy `errorCode` instead.
   */
  push(request: ConnectorRequest, ctx: ConnectorContext): Promise<ConnectorResult>;

  /**
   * Optional read-back: confirm the address actually landed at the partner.
   * Only meaningful when `manifest.capabilities.readBackVerify` is true.
   */
  verify?(input: CanonicalAddressChange, ctx: ConnectorContext): Promise<ConnectorResult>;

  /**
   * Optional: translate an inbound partner webhook payload into a result, plus
   * the `ref` — the client reference WE supplied at submit time (the dispatch's
   * idempotencyKey) that the partner echoes back. Only the connector knows the
   * partner's payload shape, so only it can extract the ref; the framework uses
   * it to find the matching ConnectorDispatch. Return `null` for an unrecognized
   * or unparseable payload. Only meaningful when
   * `manifest.capabilities.asyncConfirm` is true.
   */
  parseWebhook?(payload: unknown): { ref: string; result: ConnectorResult } | null;

  /**
   * Optional canary used for drift detection. The framework calls this on a
   * schedule against a sandbox/test account; a failure opens the circuit and
   * alerts before real users are affected.
   */
  healthCheck?(ctx: ConnectorContext): Promise<HealthResult>;
}
