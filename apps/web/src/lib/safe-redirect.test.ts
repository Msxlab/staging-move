import { describe, expect, it } from "vitest";
import { normalizeAppRedirectPath } from "./safe-redirect";

describe("normalizeAppRedirectPath", () => {
  it("allows known app destinations", () => {
    expect(normalizeAppRedirectPath("/dashboard")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("/providers/provider_123")).toBe("/providers/provider_123");
    expect(normalizeAppRedirectPath("/settings?tab=security")).toBe("/settings?tab=security");
  });

  it("rejects unsafe or unsupported destinations", () => {
    expect(normalizeAppRedirectPath("//evil.example")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("/api/auth/me")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("/auth/callback")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("/login")).toBe("/dashboard");
    expect(normalizeAppRedirectPath("/dashboard%0aSet-Cookie:bad=1")).toBe("/dashboard");
  });
});
