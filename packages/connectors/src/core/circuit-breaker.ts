/**
 * Connector core — per-connector circuit breaker.
 *
 * One breaker guards one connector. When a partner starts failing (5xx,
 * timeouts, network errors, or a failed canary), the breaker trips OPEN and the
 * framework stops hammering it — new dispatches short-circuit straight to the
 * manual fallback. After a cooldown the breaker allows a single probe
 * (HALF_OPEN); a success closes it, a failure re-opens it. This is the
 * bulkhead that keeps one bad partner from dragging down the rest.
 *
 * Pure in-memory and deterministic — the clock is injectable so transitions
 * are unit-testable without real time.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the breaker OPEN. Default 5. */
  failureThreshold?: number;
  /** How long to stay OPEN before allowing a HALF_OPEN probe. Default 60s. */
  cooldownMs?: number;
  /** Injectable clock (ms). Defaults to Date.now. */
  now?: () => number;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  private failures = 0;
  private state: CircuitState = "CLOSED";
  private openedAt = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.now = options.now ?? (() => Date.now());
  }

  /** Current state, evaluated lazily so OPEN auto-promotes to HALF_OPEN. */
  getState(): CircuitState {
    if (this.state === "OPEN" && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  /** Whether a request may proceed right now. */
  canRequest(): boolean {
    return this.getState() !== "OPEN";
  }

  /** Record a successful call: clears failures and closes the breaker. */
  recordSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  /**
   * Record a failed call. A failure while HALF_OPEN re-opens immediately; in
   * CLOSED it counts toward the threshold.
   */
  recordFailure(): void {
    if (this.getState() === "HALF_OPEN") {
      this.trip();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "OPEN";
    this.openedAt = this.now();
  }
}
