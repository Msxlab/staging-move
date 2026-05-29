/**
 * Connector core — public surface.
 *
 * The framework contract every connector and every caller depends on. Pure
 * types and pure helpers only; importing this module has no runtime effect.
 */

export type {
  CanonicalAddress,
  CanonicalAddressChange,
  ConnectorAuthType,
  ConnectorCapabilities,
  ConnectorRateLimit,
  ConnectorManifest,
  ConnectorHttpResponse,
  ConnectorRequest,
  ConnectorHttpClient,
  ConnectorLogger,
  ConnectorContext,
  ConnectorErrorCode,
  ConnectorOutcome,
  ConnectorResult,
  HealthResult,
} from "./types";

export type { AddressConnector } from "./connector";

export type { DispatchStatus } from "./state";
export { canTransition, isTerminal, statusForOutcome } from "./state";

export { validateManifest, isValidManifest } from "./manifest";

export type { ConnectorRegistry } from "./registry";
export { createConnectorRegistry } from "./registry";

export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker";
export { CircuitBreaker } from "./circuit-breaker";

export type { RetryPolicy } from "./retry";
export { DEFAULT_RETRY_POLICY, isRetryableErrorCode, nextBackoffMs, shouldRetry } from "./retry";

export { createRedactingLogger, redactSecrets } from "./logger";

export type { ConnectorHttpClientOptions } from "./http-client";
export { ConnectorHttpError, createConnectorHttpClient } from "./http-client";

export { missingRequiredFields, runConnectorAttempt } from "./executor";

export type { DispatchPlan } from "./dispatcher";
export { planNextDispatch } from "./dispatcher";

export type { OAuthProviderConfig, AuthorizeUrlParams, OAuthTokens } from "./oauth";
export {
  generateCodeVerifier,
  codeChallengeFromVerifier,
  generateState,
  buildAuthorizeUrl,
  buildTokenExchangeBody,
  buildRefreshBody,
  parseTokenResponse,
  tokenExpiryFrom,
} from "./oauth";
