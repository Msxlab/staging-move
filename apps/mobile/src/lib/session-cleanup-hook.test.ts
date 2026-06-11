import { afterEach, describe, expect, it, vi } from "vitest";
import { runSessionCleanupHook, setSessionCleanupHook } from "./session-cleanup-hook";

afterEach(() => {
  setSessionCleanupHook(null);
});

describe("session cleanup hook registry", () => {
  it("is a no-op when no hook is registered (early boot / after reset)", async () => {
    await expect(runSessionCleanupHook()).resolves.toBeUndefined();
  });

  it("invokes the registered hook exactly once per run", async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    setSessionCleanupHook(hook);
    await runSessionCleanupHook();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it("swallows hook errors so a cleanup failure never blocks sign-out", async () => {
    setSessionCleanupHook(() => {
      throw new Error("storage unavailable");
    });
    await expect(runSessionCleanupHook()).resolves.toBeUndefined();
  });

  it("awaits an async hook and still resolves when it rejects", async () => {
    setSessionCleanupHook(() => Promise.reject(new Error("network")));
    await expect(runSessionCleanupHook()).resolves.toBeUndefined();
  });

  it("stops calling a hook once it is unregistered", async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    setSessionCleanupHook(hook);
    setSessionCleanupHook(null);
    await runSessionCleanupHook();
    expect(hook).not.toHaveBeenCalled();
  });
});
