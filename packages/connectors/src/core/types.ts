/**
 * Connector core — shared types.
 *
 * The connector framework lets LocateFlow propagate an address change to many
 * external service providers (USPS, Amazon, banks, …) through a single, uniform
 * contract. Every connector is an isolated adapter that depends ONLY on the
 * types in this package — never on each other, never on the apps, never on the
 * database. The framework injects everything a connector is allowed to touch
 * (a scoped token, an allowlisted HTTP client, a redacting logger) via
 * `ConnectorContext`, so a connector can neither reach the DB nor call a host
 * it did not declare.
 *
 * This file defines data shapes only. No I/O, no env reads, no side effects —
 * importing it changes nothing at runtime.
 */

/** A postal address in LocateFlow's canonical shape (provider-agnostic). */
export interface CanonicalAddress {
  street1: string;
  street2?: string | null;
  city: string;
  /** State / province / region. */
  state: string;
  /** ZIP / postal code. */
  zip: string;
  /** ISO-3166 alpha-2 country code. Defaults to "US" upstream. */
  country: string;
}

/**
 * The single, canonical "the user moved" payload the dispatcher hands to a
 * connector. The address is chosen ONCE by the user (home, office, …) and the
 * same value flows to every connector — connectors never pick the address.
 */
export interface CanonicalAddressChange {
  /** Originating AddressChangeEvent id — used for idempotency and audit. */
  eventId: string;
  /** Address moved away from; null on a user's first-ever address. */
  from: CanonicalAddress | null;
  /** Destination address the user selected. */
  to: CanonicalAddress;
  /** Effective move date as ISO `yyyy-mm-dd`, when known. */
  effectiveDate?: string | null;
  /** Acting person's display name (for letters / partner forms). */
  fullName: string;
  /**
   * Per-service identifiers a connector declared via `requiredFields`
   * (e.g. `accountNumber`, `accountEmail`). Already decrypted by the caller;
   * connectors must not log raw values.
   */
  fields: Readonly<Record<string, string>>;
}

/** How a connector authenticates to its partner. */
export type ConnectorAuthType = "OAUTH" | "API_KEY" | "NONE";

/**
 * What a connector can actually do. These are honest declarations — the
 * framework reads them to decide automation vs. fallback. A connector that
 * cannot push server-side (`addressUpdatePush: false`) MUST declare a manual
 * fallback so the user is never stranded.
 */
export interface ConnectorCapabilities {
  /** Can validate/standardize an address via the partner API. */
  addressValidate: boolean;
  /** Can push the address change server-side (true = real zero-touch sync). */
  addressUpdatePush: boolean;
  /** Can read the address back to confirm it landed. */
  readBackVerify: boolean;
  /** Confirms asynchronously via an inbound webhook. */
  asyncConfirm: boolean;
  /** Supports household / multi-member propagation. */
  household: boolean;
  /** Accepts a business / office address. */
  business: boolean;
}

/** Optional per-connector throttle hints enforced by the dispatcher. */
export interface ConnectorRateLimit {
  /** Max successful pushes per user per day (anti-abuse, e.g. USPS COA = 2). */
  perUserPerDay?: number;
  /** Max outbound calls per minute across the whole connector. */
  perConnectorPerMinute?: number;
}

/**
 * A connector's self-declaration. The framework trusts nothing a connector does
 * beyond what its manifest allows — most importantly `allowedHosts`, which the
 * injected HTTP client enforces as an egress allowlist.
 */
export interface ConnectorManifest {
  /** Stable lowercase key, e.g. "usps", "amazon". Unique within the registry. */
  key: string;
  /** Semver of the partner-contract mapping this connector implements. */
  version: string;
  /** Human-readable name for admin UIs. */
  displayName: string;
  /** How the connector authenticates, plus least-privilege OAuth scopes. */
  auth: { type: ConnectorAuthType; scopes?: readonly string[] };
  /**
   * Egress allowlist. The connector's HTTP client may reach ONLY these hosts;
   * a request to any other host is rejected before it leaves the process.
   */
  allowedHosts: readonly string[];
  /** Field keys that must be present on `CanonicalAddressChange.fields`. */
  requiredFields: readonly string[];
  capabilities: ConnectorCapabilities;
  rateLimit?: ConnectorRateLimit;
  /**
   * Whether the connector needs a prior (origin) address to act — e.g. a USPS
   * change-of-address must know where the user moved FROM. When true, the
   * dispatcher skips an enqueue with no `from` rather than filing a doomed
   * null-origin change that the partner would reject.
   */
  requiresOrigin?: boolean;
  /**
   * Registry key of the manual fallback action (deep-link / mailto / PDF) that
   * a failed or disabled connector degrades to. REQUIRED whenever
   * `capabilities.addressUpdatePush` is true — the golden rule is that a
   * connector failure never blocks the move.
   */
  fallbackActionKey?: string;
}

/** A normalized HTTP response handed back by the injected client. */
export interface ConnectorHttpResponse {
  status: number;
  ok: boolean;
  body: unknown;
  headers: Readonly<Record<string, string>>;
}

/** A partner-shaped outbound request a connector builds and the client sends. */
export interface ConnectorRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * HTTP client injected into every connector. Pre-wired by the framework with
 * the egress allowlist, per-call timeout, request signing, and a per-connector
 * circuit breaker. A connector cannot construct its own client or bypass these.
 */
export interface ConnectorHttpClient {
  request(input: ConnectorRequest): Promise<ConnectorHttpResponse>;
}

/**
 * Logger injected into every connector. Auto-redacts PII and secrets;
 * connectors must never log raw tokens, account numbers, or resolved URLs.
 */
export interface ConnectorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Everything a connector is allowed to touch. This object IS the isolation
 * boundary: the connector receives a decrypted, scoped token, an allowlisted
 * client, and a redacting logger — and nothing else (no DB, no env, no other
 * connector's state).
 */
export interface ConnectorContext {
  /** Short-lived, scoped access token, already decrypted from the vault. */
  accessToken: string | null;
  /** Stable idempotency key for this dispatch; reused across retries. */
  idempotencyKey: string;
  /** Allowlist + timeout + circuit-breaker wrapped HTTP client. */
  http: ConnectorHttpClient;
  logger: ConnectorLogger;
  /** Cooperative cancellation honored across retries and timeouts. */
  signal?: AbortSignal;
}

/**
 * Normalized failure taxonomy. Every partner's idiosyncratic error is mapped to
 * one of these so the dispatcher can apply a uniform policy (retry, reconsent,
 * fall back, alert) regardless of which connector produced it.
 */
export type ConnectorErrorCode =
  | "AUTH_EXPIRED" // token/grant no longer valid → prompt reconnect
  | "RATE_LIMITED" // partner throttled us → back off and re-queue
  | "VALIDATION_REJECTED" // partner refused the address (bad/unknown) → user fixes
  | "PARTNER_DOWN" // 5xx / timeout / network → transient, retry
  | "SCHEMA_DRIFT" // unexpected response shape → open circuit + alert
  | "PERMANENT_REJECT" // partner says no, terminally → fall back, do not retry
  | "NOT_SUPPORTED" // connector cannot perform this action → fall back
  | "UNKNOWN";

/** The high-level result of a connector action, independent of partner specifics. */
export type ConnectorOutcome =
  | "CONFIRMED" // pushed AND verified to have landed
  | "SUBMITTED" // pushed; awaiting async/manual confirmation
  | "NEEDS_USER" // requires the deep-link / manual fallback
  | "FAILED"; // see errorCode

/** What a connector returns from `push` / `verify`. */
export interface ConnectorResult {
  outcome: ConnectorOutcome;
  /** Set when `outcome === "FAILED"`. */
  errorCode?: ConnectorErrorCode;
  /** Whether a FAILED result is transient (retry) vs. terminal. */
  retryable?: boolean;
  /** Partner confirmation/reference number; the caller encrypts it at rest. */
  confirmationNumber?: string | null;
  /** Small, non-PII structured detail for audit/debugging. */
  metadata?: Record<string, unknown>;
}

/** Outcome of a connector's canary / drift health check. */
export interface HealthResult {
  ok: boolean;
  /** Why the check failed, mapped to the shared taxonomy. */
  reason?: ConnectorErrorCode;
  /** Optional notes (e.g. which response fields were missing). */
  detail?: string;
}
