export type PasswordLinkAction = {
  endpoint: "/api/auth/security" | "/api/auth/password/reset/request";
  body: Record<string, unknown>;
  titleKey: "settings.setPassword" | "settings.changePassword";
  descriptionKey: "settings.setPasswordDescription" | "settings.changePasswordDescription";
  buttonKey: "settings.emailSetupLink" | "settings.emailResetLink";
  successMessageKey: "settings.passwordSetupSent" | "settings.passwordResetSent";
};

export function getPasswordLinkAction(opts: {
  hasPasswordLogin: boolean;
  email: string;
}): PasswordLinkAction {
  if (opts.hasPasswordLogin) {
    return {
      endpoint: "/api/auth/password/reset/request",
      body: { email: opts.email },
      titleKey: "settings.changePassword",
      descriptionKey: "settings.changePasswordDescription",
      buttonKey: "settings.emailResetLink",
      successMessageKey: "settings.passwordResetSent",
    };
  }

  return {
    endpoint: "/api/auth/security",
    body: { action: "request_set_password" },
    titleKey: "settings.setPassword",
    descriptionKey: "settings.setPasswordDescription",
    buttonKey: "settings.emailSetupLink",
    successMessageKey: "settings.passwordSetupSent",
  };
}
