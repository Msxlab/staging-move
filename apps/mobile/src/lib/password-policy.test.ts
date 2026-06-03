import { describe, expect, it } from "vitest";
import { getPasswordRuleResults, isPasswordPolicyMet } from "./password-policy";

describe("mobile password policy", () => {
  it("requires the same character classes as the server policy", () => {
    expect(isPasswordPolicyMet("Valid-Password-2026!")).toBe(true);
    expect(isPasswordPolicyMet("short1A!")).toBe(false);
    expect(isPasswordPolicyMet("valid-password-2026!")).toBe(false);
    expect(isPasswordPolicyMet("VALID-PASSWORD-2026!")).toBe(false);
    expect(isPasswordPolicyMet("Valid-Password-NoDigit!")).toBe(false);
    expect(isPasswordPolicyMet("ValidPassword2026")).toBe(false);
  });

  it("returns translated rule keys for live feedback", () => {
    expect(getPasswordRuleResults("Valid-Password-2026!")).toEqual([
      expect.objectContaining({ key: "length", labelKey: "auth.passwordRuleLength", passed: true }),
      expect.objectContaining({ key: "uppercase", labelKey: "auth.passwordRuleUppercase", passed: true }),
      expect.objectContaining({ key: "lowercase", labelKey: "auth.passwordRuleLowercase", passed: true }),
      expect.objectContaining({ key: "digit", labelKey: "auth.passwordRuleDigit", passed: true }),
      expect.objectContaining({ key: "special", labelKey: "auth.passwordRuleSpecial", passed: true }),
    ]);
  });
});
