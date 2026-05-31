import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "./circuit-breaker";

function controllableClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("CircuitBreaker", () => {
  it("starts closed and allows requests", () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.canRequest()).toBe(true);
  });

  it("trips open after the failure threshold", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canRequest()).toBe(false);
  });

  it("moves to half-open after the cooldown", () => {
    const clock = controllableClock();
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now: clock.now });
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    clock.advance(999);
    expect(cb.canRequest()).toBe(false);
    clock.advance(1);
    expect(cb.getState()).toBe("HALF_OPEN");
    expect(cb.canRequest()).toBe(true);
  });

  it("closes on a successful probe and re-opens on a failed one", () => {
    const clock = controllableClock();
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now: clock.now });

    cb.recordFailure();
    clock.advance(1_000);
    expect(cb.getState()).toBe("HALF_OPEN");
    cb.recordSuccess();
    expect(cb.getState()).toBe("CLOSED");

    cb.recordFailure();
    clock.advance(1_000);
    expect(cb.getState()).toBe("HALF_OPEN");
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
  });

  it("resets the failure count on success", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED"); // would have tripped without the reset
  });
});
