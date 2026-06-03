import { describe, expect, it } from "vitest";
import { getPasswordLinkAction } from "./password-management";

describe("getPasswordLinkAction", () => {
  it("returns the setup-password flow for OAuth-only accounts", () => {
    expect(getPasswordLinkAction({
      hasPasswordLogin: false,
      email: "mobile.qa@locateflow.com",
    })).toEqual({
      endpoint: "/api/auth/security",
      body: { action: "request_set_password" },
      titleKey: "settings.setPassword",
      descriptionKey: "settings.setPasswordDescription",
      buttonKey: "settings.emailSetupLink",
      successMessageKey: "settings.passwordSetupSent",
    });
  });

  it("returns the reset-password flow for accounts that already have a password", () => {
    expect(getPasswordLinkAction({
      hasPasswordLogin: true,
      email: "mobile.qa@locateflow.com",
    })).toEqual({
      endpoint: "/api/auth/password/reset/request",
      body: { email: "mobile.qa@locateflow.com" },
      titleKey: "settings.changePassword",
      descriptionKey: "settings.changePasswordDescription",
      buttonKey: "settings.emailResetLink",
      successMessageKey: "settings.passwordResetSent",
    });
  });
});
