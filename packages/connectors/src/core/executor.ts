/**
 * Connector core — single-attempt executor.
 *
 * Runs ONE address-update attempt against ONE connector and returns a
 * normalized result. It owns the per-attempt concerns that are identical for
 * every connector: required-field validation, the "can't push → fall back"
 * rule, push→verify chaining, and mapping any thrown transport error onto the
 * shared taxonomy. It deliberately does NOT own retries, queues, or
 * persistence — that durable orchestration lives in the dispatcher (wired with
 * the DB), so this stays pure and unit-testable.
 */

import type { AddressConnector } from "./connector";
import type { CanonicalAddressChange, ConnectorContext, ConnectorResult } from "./types";
import { ConnectorHttpError } from "./http-client";

/** Field keys required by the manifest but absent from the input. */
export function missingRequiredFields(
  connector: AddressConnector,
  input: CanonicalAddressChange,
): string[] {
  return connector.manifest.requiredFields.filter((field) => {
    const value = input.fields[field];
    return value === undefined || value === null || value === "";
  });
}

/**
 * Execute a single attempt. Never throws for an expected partner failure —
 * everything is mapped to a `ConnectorResult`.
 */
export async function runConnectorAttempt(
  connector: AddressConnector,
  input: CanonicalAddressChange,
  ctx: ConnectorContext,
): Promise<ConnectorResult> {
  // 1. Can't build the request without the declared fields → hand to fallback.
  const missing = missingRequiredFields(connector, input);
  if (missing.length > 0) {
    return {
      outcome: "FAILED",
      errorCode: "VALIDATION_REJECTED",
      retryable: false,
      metadata: { reason: "MISSING_FIELDS", missingFields: missing },
    };
  }

  // 2. A connector that can't push server-side degrades to the manual fallback
  //    immediately (e.g. USPS COA). The move is never blocked.
  if (!connector.manifest.capabilities.addressUpdatePush) {
    return { outcome: "NEEDS_USER", metadata: { reason: "PUSH_NOT_SUPPORTED" } };
  }

  // 2.5. SHADOW dry-run: prove the request mapping works WITHOUT sending it.
  //      Returns a shadow-marked result and never proceeds to verify (which
  //      would hit the partner). The dispatcher records it without a real side
  //      effect, so a new connector can be validated against live traffic shape
  //      before ROLLOUT/GA.
  if (ctx.dryRun) {
    try {
      connector.buildRequest(input);
    } catch {
      return {
        outcome: "FAILED",
        errorCode: "VALIDATION_REJECTED",
        retryable: false,
        metadata: { reason: "DRY_RUN_BUILD_FAILED", shadow: true },
      };
    }
    return { outcome: "SUBMITTED", metadata: { reason: "DRY_RUN", shadow: true } };
  }

  try {
    const request = connector.buildRequest(input);
    const pushResult = await connector.push(request, ctx);

    // 3. If the push is only "submitted" and the connector can verify, confirm
    //    the change actually landed before we call it done.
    if (
      pushResult.outcome === "SUBMITTED" &&
      connector.manifest.capabilities.readBackVerify &&
      typeof connector.verify === "function"
    ) {
      return await connector.verify(input, ctx);
    }

    return pushResult;
  } catch (error) {
    if (error instanceof ConnectorHttpError) {
      return {
        outcome: "FAILED",
        errorCode: error.code,
        retryable: error.code === "PARTNER_DOWN" || error.code === "RATE_LIMITED",
        metadata: { reason: "TRANSPORT_ERROR" },
      };
    }
    // Unknown throw: be conservative — terminal, not retryable.
    return {
      outcome: "FAILED",
      errorCode: "UNKNOWN",
      retryable: false,
      metadata: { reason: "UNEXPECTED_ERROR" },
    };
  }
}
