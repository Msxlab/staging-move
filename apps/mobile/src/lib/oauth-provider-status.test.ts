import { describe, expect, it } from "vitest";
import {
  canAttemptAppleOAuth,
  canAttemptGoogleOAuth,
  shouldShowOAuthReadinessNote,
} from "./oauth-provider-status";

describe("OAuth provider readiness", () => {
  it("keeps Google clickable while readiness is unknown", () => {
    expect(canAttemptGoogleOAuth(null)).toBe(true);
    expect(canAttemptGoogleOAuth({})).toBe(true);
    expect(shouldShowOAuthReadinessNote(null)).toBe(false);
  });

  it("only disables Google when the server explicitly marks it unavailable", () => {
    expect(canAttemptGoogleOAuth({
      google: { configured: false, label: "Google", message: "missing" },
    })).toBe(false);
    expect(canAttemptGoogleOAuth({
      google: { configured: true, label: "Google", message: "ready" },
    })).toBe(true);
  });

  it("keeps Apple strict and shows notes for explicit unavailability", () => {
    expect(canAttemptAppleOAuth(null)).toBe(false);
    expect(canAttemptAppleOAuth({
      apple: { configured: true, label: "Apple", message: "ready" },
    })).toBe(true);
    expect(shouldShowOAuthReadinessNote({
      google: { configured: true, label: "Google", message: "ready" },
      apple: { configured: false, label: "Apple", message: "missing" },
    })).toBe(false);
  });

  it("shows the broad readiness note only when all social providers are unavailable", () => {
    expect(shouldShowOAuthReadinessNote({
      google: { configured: false, label: "Google", message: "missing" },
      apple: { configured: false, label: "Apple", message: "missing" },
    })).toBe(true);
  });
});
