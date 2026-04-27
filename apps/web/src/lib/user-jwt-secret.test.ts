import { afterEach, describe, expect, it, vi } from "vitest";
import { validateUserJwtSecret } from "./user-jwt-secret";

describe("validateUserJwtSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a runtime secret with at least 32 characters", () => {
    expect(validateUserJwtSecret("x".repeat(32))).toBe("x".repeat(32));
  });

  it("fails closed when the runtime secret is missing or too short", () => {
    vi.stubEnv("USER_JWT_SECRET", "");
    expect(() => validateUserJwtSecret()).toThrow(/USER_JWT_SECRET/);
    expect(() => validateUserJwtSecret("short")).toThrow(/USER_JWT_SECRET/);
  });
});
