export type PasswordRule = {
  key: "length" | "uppercase" | "lowercase" | "digit" | "special";
  labelKey: string;
  test: (password: string) => boolean;
};

// Mirrors validatePasswordPolicy in apps/web/src/lib/user-auth.ts. The server
// remains the authority; mobile uses this for pre-submit feedback.
export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", labelKey: "auth.passwordRuleLength", test: (password) => password.length >= 12 },
  { key: "uppercase", labelKey: "auth.passwordRuleUppercase", test: (password) => /[A-Z]/.test(password) },
  { key: "lowercase", labelKey: "auth.passwordRuleLowercase", test: (password) => /[a-z]/.test(password) },
  { key: "digit", labelKey: "auth.passwordRuleDigit", test: (password) => /[0-9]/.test(password) },
  { key: "special", labelKey: "auth.passwordRuleSpecial", test: (password) => /[^A-Za-z0-9]/.test(password) },
];

export function getPasswordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) }));
}

export function isPasswordPolicyMet(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
