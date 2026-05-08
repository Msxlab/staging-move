import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearFailures,
  clearStepUpStateForTests,
  getFailureLockout,
  hasRecentConfirm,
  registerFailure,
  rememberConfirm,
} from "./auth-step-up-store";

describe("auth-step-up-store (in-memory fallback)", () => {
  beforeEach(() => {
    clearStepUpStateForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    clearStepUpStateForTests();
  });

  it("rememberConfirm + hasRecentConfirm round trips", async () => {
    await rememberConfirm("admin1:s1:op_a", 60);
    await expect(hasRecentConfirm("admin1:s1:op_a", 60_000)).resolves.toBe(true);
    await expect(hasRecentConfirm("admin1:s1:op_a", 0)).resolves.toBe(false);
  });

  it("returns false for unrelated keys", async () => {
    await rememberConfirm("admin1:s1:op_a", 60);
    await expect(hasRecentConfirm("admin1:s1:op_b", 60_000)).resolves.toBe(false);
    await expect(hasRecentConfirm("admin2:s1:op_a", 60_000)).resolves.toBe(false);
  });

  it("locks out after maxFailures", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await registerFailure({
        key: "admin:fail",
        windowSec: 300,
        maxFailures: 5,
        lockoutSec: 600,
      });
      expect(r.locked).toBe(false);
    }
    const final = await registerFailure({
      key: "admin:fail",
      windowSec: 300,
      maxFailures: 5,
      lockoutSec: 600,
    });
    expect(final.locked).toBe(true);
    expect(final.retryAfterSec).toBeGreaterThan(0);

    const lock = await getFailureLockout("admin:fail");
    expect(lock.locked).toBe(true);
    expect(lock.retryAfterSec).toBeGreaterThan(0);
  });

  it("clearFailures unlocks the key", async () => {
    for (let i = 0; i < 5; i++) {
      await registerFailure({
        key: "admin:clear",
        windowSec: 300,
        maxFailures: 5,
        lockoutSec: 600,
      });
    }
    expect((await getFailureLockout("admin:clear")).locked).toBe(true);
    await clearFailures("admin:clear");
    expect((await getFailureLockout("admin:clear")).locked).toBe(false);
  });
});
