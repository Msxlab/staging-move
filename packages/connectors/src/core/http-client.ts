/**
 * Connector core — the allowlisted HTTP client factory.
 *
 * This is where connector isolation is physically enforced. The client a
 * connector receives can reach ONLY the hosts its manifest declared, only over
 * HTTPS, only within a timeout, and only while its circuit breaker is closed.
 * A connector cannot construct its own client or escape these guards — that is
 * why a connector "cannot call a host it didn't declare" is a guarantee, not a
 * guideline.
 *
 * The fetch boundary is intentionally loose-typed (`RawFetch`) so the package
 * needs no DOM lib; the public surface stays strict.
 */

import type {
  ConnectorErrorCode,
  ConnectorHttpClient,
  ConnectorHttpResponse,
  ConnectorRequest,
} from "./types";
import { CircuitBreaker } from "./circuit-breaker";

/** A transport-level failure, carrying a normalized taxonomy code. */
export class ConnectorHttpError extends Error {
  readonly code: ConnectorErrorCode;
  constructor(code: ConnectorErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ConnectorHttpError";
    this.code = code;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

interface RawResponse {
  status: number;
  headers: { forEach(cb: (value: string, key: string) => void): void };
  text(): Promise<string>;
}
type RawFetch = (url: string, init: Record<string, unknown>) => Promise<RawResponse>;

export interface ConnectorHttpClientOptions {
  /** Bare lowercase hosts the client may reach (from the manifest). */
  allowedHosts: readonly string[];
  /** Per-call timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Optional per-connector breaker; created if omitted. */
  breaker?: CircuitBreaker;
  /** Optional caller abort signal, linked to the per-call timeout. */
  signal?: AbortSignal;
  /** Hook to add auth/signature headers just before sending. */
  signRequest?: (request: ConnectorRequest) => Record<string, string>;
  /** Injectable fetch (defaults to global fetch); used by tests. */
  fetchImpl?: RawFetch;
}

function headersToRecord(headers: RawResponse["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Max redirect hops to follow (each one re-checked against the allowlist). */
const MAX_REDIRECTS = 3;

/**
 * Build a `ConnectorHttpClient` bound to a single connector's allowlist and
 * breaker. The returned client is the only egress a connector ever gets.
 */
export function createConnectorHttpClient(options: ConnectorHttpClientOptions): ConnectorHttpClient {
  const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
  const timeoutMs = options.timeoutMs ?? 15_000;
  const breaker = options.breaker ?? new CircuitBreaker();
  const doFetch: RawFetch =
    options.fetchImpl ?? ((url, init) => (globalThis as { fetch: RawFetch }).fetch(url, init));

  function assertAllowed(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      // A malformed URL is a connector bug, not a partner failure.
      throw new Error(`Connector built an invalid URL: ${rawUrl}`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`Egress blocked: ${url.protocol} is not allowed (https only)`);
    }
    if (!allowed.has(url.host.toLowerCase())) {
      throw new Error(`Egress blocked: ${url.host} is not in the connector allowlist`);
    }
    return url;
  }

  return {
    async request(request: ConnectorRequest): Promise<ConnectorHttpResponse> {
      assertAllowed(request.url);

      if (!breaker.canRequest()) {
        throw new ConnectorHttpError("PARTNER_DOWN", "Circuit open for connector");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onParentAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onParentAbort);

      const headers = {
        ...(request.headers ?? {}),
        ...(options.signRequest ? options.signRequest(request) : {}),
      };

      try {
        // Follow redirects MANUALLY so the allowlist is re-enforced on every
        // hop. The default fetch (`redirect:"follow"`) would silently chase a
        // 3xx to a host the connector never declared — and resend the
        // Authorization header to it — defeating the egress allowlist. We cap
        // the chain and re-assert host + https on each Location.
        const fetchInit = {
          method: request.method,
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: controller.signal,
          redirect: "manual" as const,
        };
        let currentUrl = request.url;
        let res = await doFetch(currentUrl, fetchInit);

        for (let hop = 0; res.status >= 300 && res.status < 400; hop++) {
          const location = headersToRecord(res.headers)["location"];
          if (!location) break; // 3xx without a Location → treat as the final response
          if (hop >= MAX_REDIRECTS) {
            throw new ConnectorHttpError("PARTNER_DOWN", "Too many redirects");
          }
          let nextUrl: URL;
          try {
            nextUrl = new URL(location, currentUrl);
          } catch {
            throw new ConnectorHttpError("PARTNER_DOWN", `Invalid redirect location: ${location}`);
          }
          if (nextUrl.protocol !== "https:" || !allowed.has(nextUrl.host.toLowerCase())) {
            throw new ConnectorHttpError(
              "PARTNER_DOWN",
              `Egress blocked: redirect to ${nextUrl.host} is not in the connector allowlist`,
            );
          }
          currentUrl = nextUrl.toString();
          res = await doFetch(currentUrl, fetchInit);
        }

        const response: ConnectorHttpResponse = {
          status: res.status,
          ok: res.status < 400,
          body: parseBody(await res.text()),
          headers: headersToRecord(res.headers),
        };

        // Only 5xx counts against the breaker; 4xx is a client/validation issue
        // that retrying won't fix and shouldn't trip the bulkhead.
        if (res.status >= 500) breaker.recordFailure();
        else breaker.recordSuccess();

        return response;
      } catch (error) {
        if (error instanceof ConnectorHttpError) {
          breaker.recordFailure();
          throw error;
        }
        const callerAborted = options.signal?.aborted ?? false;
        // A caller-initiated cancellation isn't a partner-health signal; only a
        // real network error or the per-call timeout should trip the breaker.
        if (!callerAborted) breaker.recordFailure();
        throw new ConnectorHttpError(
          callerAborted ? "UNKNOWN" : "PARTNER_DOWN",
          callerAborted ? "Request aborted" : "Network or timeout error",
          { cause: error },
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onParentAbort);
      }
    },
  };
}
