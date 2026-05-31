import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, statusForOutcome } from "./state";

describe("dispatch state machine", () => {
  it("allows the happy-path transitions", () => {
    expect(canTransition("QUEUED", "DISPATCHING")).toBe(true);
    expect(canTransition("DISPATCHING", "SUBMITTED")).toBe(true);
    expect(canTransition("DISPATCHING", "CONFIRMED")).toBe(true);
    expect(canTransition("SUBMITTED", "CONFIRMED")).toBe(true);
  });

  it("allows the retry and fallback transitions", () => {
    expect(canTransition("DISPATCHING", "FAILED")).toBe(true);
    expect(canTransition("FAILED", "QUEUED")).toBe(true);
    expect(canTransition("FAILED", "NEEDS_USER")).toBe(true);
    expect(canTransition("QUEUED", "NEEDS_USER")).toBe(true);
  });

  it("forbids transitions out of terminal states", () => {
    expect(canTransition("CONFIRMED", "QUEUED")).toBe(false);
    expect(canTransition("NEEDS_USER", "DISPATCHING")).toBe(false);
    expect(canTransition("CONFIRMED", "FAILED")).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isTerminal("CONFIRMED")).toBe(true);
    expect(isTerminal("NEEDS_USER")).toBe(true);
    expect(isTerminal("QUEUED")).toBe(false);
    expect(isTerminal("FAILED")).toBe(false);
  });

  it("maps connector outcomes to a dispatch status", () => {
    expect(statusForOutcome("CONFIRMED")).toBe("CONFIRMED");
    expect(statusForOutcome("SUBMITTED")).toBe("SUBMITTED");
    expect(statusForOutcome("NEEDS_USER")).toBe("NEEDS_USER");
    expect(statusForOutcome("FAILED")).toBe("FAILED");
  });
});
