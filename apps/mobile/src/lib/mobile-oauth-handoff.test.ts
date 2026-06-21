import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("@/lib/pkce", () => ({
  consumePkceVerifier: vi.fn(),
}));

import { isMobileOAuthCallbackUrl, readMobileOAuthCallback } from "./mobile-oauth-handoff";

describe("mobile OAuth handoff URLs", () => {
  it("accepts only the native scheme and canonical HTTPS callback by default", () => {
    expect(isMobileOAuthCallbackUrl("locateflow://oauth?code=abc")).toBe(true);
    expect(isMobileOAuthCallbackUrl("https://locateflow.com/mobile/oauth?code=abc")).toBe(true);

    expect(isMobileOAuthCallbackUrl("https://app.locateflow.com/mobile/oauth?code=abc")).toBe(false);
    expect(isMobileOAuthCallbackUrl("https://locateflow.app/mobile/oauth?code=abc")).toBe(false);
  });

  it("reads callback params from the canonical HTTPS callback", () => {
    expect(readMobileOAuthCallback("https://locateflow.com/mobile/oauth?code=abc&state=s1&provider=google")).toEqual({
      code: "abc",
      state: "s1",
      provider: "google",
    });
  });
});
