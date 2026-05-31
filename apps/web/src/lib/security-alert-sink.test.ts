import { beforeEach, describe, expect, it } from "vitest";
import { recordAndDetectBurst, __resetSecurityAlertState } from "./security-alert-sink";

const WINDOW_MS = 10 * 60_000;

describe("security alert burst detector", () => {
  beforeEach(() => __resetSecurityAlertState());

  it("ignores event types without an alert rule", () => {
    expect(recordAndDetectBurst("RATE_LIMIT_HIT", 1_000)).toBeNull();
  });

  it("does not alert below the threshold", () => {
    let decision = null;
    // WEBHOOK_SIG_FAILURE threshold is 5.
    for (let i = 0; i < 4; i++) decision = recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + i);
    expect(decision?.alert).toBe(false);
    expect(decision?.count).toBe(4);
  });

  it("alerts exactly when the threshold is reached inside the window", () => {
    let decision = null;
    for (let i = 0; i < 5; i++) decision = recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + i);
    expect(decision?.alert).toBe(true);
    expect(decision?.count).toBe(5);
  });

  it("stays quiet during the cooldown after firing (no flood)", () => {
    for (let i = 0; i < 5; i++) recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + i);
    const sixth = recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_006);
    expect(sixth?.count).toBe(6);
    expect(sixth?.alert).toBe(false); // within cooldown
  });

  it("opens a fresh window once windowMs elapses", () => {
    for (let i = 0; i < 5; i++) recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + i);
    const later = recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + WINDOW_MS + 1);
    expect(later?.count).toBe(1);
    expect(later?.alert).toBe(false);
  });

  it("tracks each event type independently", () => {
    for (let i = 0; i < 5; i++) recordAndDetectBurst("WEBHOOK_SIG_FAILURE", 1_000 + i);
    // CRON_SECRET_MISUSE has its own (lower=3) threshold and counter.
    let decision = null;
    for (let i = 0; i < 3; i++) decision = recordAndDetectBurst("CRON_SECRET_MISUSE", 2_000 + i);
    expect(decision?.alert).toBe(true);
    expect(decision?.count).toBe(3);
  });
});
