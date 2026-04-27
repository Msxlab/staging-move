const BRAND = {
  url: "https://locateflow.com",
  supportEmail: "support@locateflow.com",
  bg: "#f5f7fb",
  card: "#ffffff",
  text: "#172033",
  muted: "#5f6b7a",
  border: "#d9e1ea",
  panel: "#eef3f8",
  primary: "#f97316",
  primaryDark: "#c2410c",
};

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${BRAND.text};">${text}</p>`;
}

function note(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${BRAND.muted};">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:24px 0 8px;"><tr><td bgcolor="${BRAND.primary}" style="border-radius:6px;"><a href="${href}" style="display:inline-block;padding:13px 20px;font-size:15px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px;">${label}</a></td></tr></table>`;
}

function rows(items: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BRAND.panel}" style="width:100%;border-collapse:collapse;background:${BRAND.panel};border-radius:8px;margin:0 0 4px;"><tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${items
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.muted};">${label}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;line-height:20px;color:${BRAND.text};font-weight:600;">${value}</td></tr>`,
    )
    .join("")}</table></td></tr></table>`;
}

type WrapLocale = "en" | "es";

const WRAP_STRINGS: Record<WrapLocale, { securityNote: string; footerNote: string }> = {
  en: {
    securityNote: "If this was not you, ignore this email or contact support.",
    footerNote: "You&#39;re receiving this email because you used LocateFlow.",
  },
  es: {
    securityNote: "Si no fuiste tú, ignora este correo o contacta con soporte.",
    footerNote: "Recibes este correo porque usaste LocateFlow.",
  },
};

function wrap(
  title: string,
  preheader: string,
  content: string,
  security = false,
  locale: WrapLocale = "en",
): string {
  const strings = WRAP_STRINGS[locale];
  const securityNote = security ? note(strings.securityNote) : "";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${title}</title></head><body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:${BRAND.text};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BRAND.bg}" style="border-collapse:collapse;background:${BRAND.bg};"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;"><tr><td style="padding:0 0 12px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td bgcolor="${BRAND.primary}" style="width:34px;height:34px;border-radius:8px;text-align:center;color:#ffffff;font-weight:700;font-size:13px;line-height:34px;">LF</td><td style="padding-left:10px;font-size:20px;line-height:24px;font-weight:700;color:${BRAND.text};">LocateFlow</td></tr></table></td></tr><tr><td bgcolor="${BRAND.card}" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:8px;padding:32px 28px;"><h1 style="margin:0 0 16px;font-size:24px;line-height:31px;color:${BRAND.text};font-weight:700;">${title}</h1>${content}${securityNote}</td></tr><tr><td style="padding:18px 4px 0;text-align:left;"><p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${BRAND.muted};font-weight:700;">LocateFlow</p><p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${BRAND.muted};"><a href="${BRAND.url}" style="color:${BRAND.primaryDark};text-decoration:underline;">${BRAND.url}</a>&nbsp;|&nbsp;<a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryDark};text-decoration:underline;">${BRAND.supportEmail}</a></p><p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.muted};">${strings.footerNote}</p></td></tr></table></td></tr></table></body></html>`;
}

export const EMAIL_TEMPLATES_ALL = [
  {
    slug: "welcome",
    name: "Welcome Email",
    subject: "Welcome to LocateFlow",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "dashboardLink", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Welcome to LocateFlow",
      "Your LocateFlow account is ready.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Welcome to LocateFlow. You can now organize addresses, services, reminders, and moving tasks in one place.") +
        rows([
          ["Start", "Review your dashboard"],
          ["Support", `<a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryDark};text-decoration:underline;">${BRAND.supportEmail}</a>`],
        ]) +
        button("{{dashboardLink}}", "Open Dashboard"),
    ),
  },
  {
    slug: "email-verify",
    name: "Email Verification",
    subject: "Verify your LocateFlow email",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "verifyLink"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Verify your email",
      "Confirm your email address to finish setting up LocateFlow.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Thanks for creating a LocateFlow account. Confirm your email address to finish setting up your account.") +
        note("This link expires in 24 hours.") +
        button("{{verifyLink}}", "Verify Email"),
      true,
    ),
  },
  {
    slug: "password-reset",
    name: "Password Reset",
    subject: "Reset your LocateFlow password",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "resetLink"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Reset your password",
      "Use this secure link to reset your LocateFlow password.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("We received a request to reset your LocateFlow password.") +
        note("This link expires in 1 hour and can only be used once.") +
        button("{{resetLink}}", "Reset Password"),
      true,
    ),
  },
  {
    slug: "bill-reminder",
    name: "Bill Reminder",
    subject: "Bill reminder: {{serviceName}} is due soon",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "serviceName", "amount", "dueDate", "daysLeft", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Bill reminder",
      "{{serviceName}} has an upcoming bill.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your <strong>{{serviceName}}</strong> bill is due in <strong>{{daysLeft}} days</strong>.") +
        rows([
          ["Service", "{{serviceName}}"],
          ["Amount", `<span style="color:${BRAND.primaryDark};">\${{amount}}</span>`],
          ["Due Date", "{{dueDate}}"],
        ]) +
        button("{{appUrl}}/services", "View Services"),
    ),
  },
  {
    slug: "weekly-digest",
    name: "Weekly Digest",
    subject: "Your LocateFlow weekly digest",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "weekStart", "weekEnd", "totalExpenses", "newServices", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Weekly digest",
      "Your LocateFlow weekly summary is ready.",
      p("Hi <strong>{{firstName}}</strong>, here is your LocateFlow summary for {{weekStart}} to {{weekEnd}}.") +
        rows([
          ["Monthly cost", "\${{totalExpenses}}"],
          ["New services", "{{newServices}}"],
        ]) +
        button("{{appUrl}}/dashboard", "Open Dashboard"),
    ),
  },
  {
    slug: "move-reminder",
    name: "Moving Day Reminder",
    subject: "Your move is coming up",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "moveDate", "fromCity", "toCity", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Moving day reminder",
      "Your move date is coming up.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your move from <strong>{{fromCity}}</strong> to <strong>{{toCity}}</strong> is scheduled for <strong>{{moveDate}}</strong>.") +
        button("{{appUrl}}/moving", "View Moving Plan"),
    ),
  },
  {
    slug: "contract-reminder",
    name: "Contract Reminder",
    subject: "Contract reminder: {{serviceName}}",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "serviceName", "contractEndDate", "daysRemaining", "serviceLink"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Contract reminder",
      "{{serviceName}} contract timing needs review.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your <strong>{{serviceName}}</strong> contract ends in <strong>{{daysRemaining}} days</strong>.") +
        rows([["Ends On", "{{contractEndDate}}"]]) +
        button("{{serviceLink}}", "Review Service"),
    ),
  },
  {
    slug: "trial-expiring",
    name: "Trial Expiring Soon",
    subject: "Your LocateFlow trial expires in {{daysLeft}} days",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "daysLeft", "upgradeLink", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Trial expiring soon",
      "Your LocateFlow trial is nearing its end.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your LocateFlow trial expires in <strong>{{daysLeft}} days</strong>. Your saved account data remains available according to LocateFlow account and billing settings.") +
        button("{{upgradeLink}}", "Review Subscription"),
    ),
  },
  {
    slug: "monthly-report",
    name: "Monthly Summary",
    subject: "Your {{month}} LocateFlow summary",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "month", "totalSpend", "servicesCount", "tasksCompleted", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Monthly summary",
      "Your LocateFlow monthly summary is ready.",
      p("Hi <strong>{{firstName}}</strong>, here is your {{month}} summary.") +
        rows([
          ["Total spend", "\${{totalSpend}}"],
          ["Active services", "{{servicesCount}}"],
          ["Tasks completed", "{{tasksCompleted}}"],
        ]) +
        button("{{appUrl}}/dashboard", "View Dashboard"),
    ),
  },
  {
    slug: "subscription-upgrade",
    name: "Plan Updated",
    subject: "Your LocateFlow plan was updated",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "planName", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Plan updated",
      "Your LocateFlow subscription changed.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your LocateFlow plan was updated to <strong>{{planName}}</strong>. You can review your current billing details from your account settings.") +
        button("{{appUrl}}/settings/subscription", "Review Subscription"),
    ),
  },
  {
    slug: "review-approved",
    name: "Review Approved",
    subject: "Your LocateFlow review was approved",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "providerName", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Review approved",
      "Your LocateFlow review was approved.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your review for <strong>{{providerName}}</strong> was approved. Thank you for sharing your experience with other LocateFlow users.") +
        button("{{appUrl}}/community", "View Reviews"),
    ),
  },
  {
    slug: "review-rejected",
    name: "Review Needs Attention",
    subject: "Your LocateFlow review needs attention",
    category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "providerName", "reason", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Review needs attention",
      "Your LocateFlow review needs attention.",
      p("Hi <strong>{{firstName}}</strong>,") +
        p("Your review for <strong>{{providerName}}</strong> could not be published as submitted.") +
        rows([["Reason", "{{reason}}"]]) +
        note("You can edit and resubmit your review at any time.") +
        button("{{appUrl}}/community", "Edit Review"),
    ),
  },
  {
    slug: "family-invite",
    name: "Family Invitation (Deprecated)",
    subject: "LocateFlow family invitations are not currently available",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["inviterName", "role", "inviteLink"]),
    isActive: false,
    isDefault: true,
    body: wrap(
      "Family invitations unavailable",
      "This LocateFlow template is inactive.",
      p("Family invitation emails are currently inactive because family sharing is not available in the current product."),
    ),
  },
  // ──────────────────────────────────────────────────────────────────────
  // Spanish (US Hispanic audience). Slug = "{base}-es".
  // Looked up via locale-aware fallback in renderTemplate; missing slugs
  // fall back to the English base template.
  // ──────────────────────────────────────────────────────────────────────
  {
    slug: "welcome-es",
    name: "Welcome Email (ES)",
    subject: "Bienvenido a LocateFlow",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "dashboardLink", "appUrl"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Bienvenido a LocateFlow",
      "Tu cuenta de LocateFlow está lista.",
      p("Hola <strong>{{firstName}}</strong>,") +
        p("Bienvenido a LocateFlow. Ya puedes organizar direcciones, servicios, recordatorios y tareas de mudanza en un solo lugar.") +
        rows([
          ["Comenzar", "Revisa tu panel"],
          ["Soporte", `<a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryDark};text-decoration:underline;">${BRAND.supportEmail}</a>`],
        ]) +
        button("{{dashboardLink}}", "Abrir el panel"),
      false,
      "es",
    ),
  },
  {
    slug: "email-verify-es",
    name: "Email Verification (ES)",
    subject: "Verifica tu correo de LocateFlow",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "verifyLink"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Verifica tu correo",
      "Confirma tu correo para terminar de configurar LocateFlow.",
      p("Hola <strong>{{firstName}}</strong>,") +
        p("Gracias por crear una cuenta en LocateFlow. Confirma tu correo para terminar de configurar tu cuenta.") +
        note("Este enlace expira en 24 horas.") +
        button("{{verifyLink}}", "Verificar correo"),
      true,
      "es",
    ),
  },
  {
    slug: "password-reset-es",
    name: "Password Reset (ES)",
    subject: "Restablece tu contraseña de LocateFlow",
    category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "resetLink"]),
    isActive: true,
    isDefault: true,
    body: wrap(
      "Restablece tu contraseña",
      "Usa este enlace seguro para restablecer tu contraseña de LocateFlow.",
      p("Hola <strong>{{firstName}}</strong>,") +
        p("Recibimos una solicitud para restablecer tu contraseña de LocateFlow.") +
        note("Este enlace expira en 1 hora y solo puede usarse una vez.") +
        button("{{resetLink}}", "Restablecer contraseña"),
      true,
      "es",
    ),
  },
];
