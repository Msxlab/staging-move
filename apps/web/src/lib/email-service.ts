import { sharedSanitizeEmailHtml, sharedSanitizeEmailSubject } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import {
  appendUnsubscribeFooter,
  billReminderHtml,
  billReminderText,
  buildUnsubscribeHeaders,
  contractReminderHtml,
  contractReminderText,
  DEFAULT_APP_URL,
  emailVerificationContent,
  escapeHtml,
  type EmailContent,
  htmlToPlainText,
  normalizeBaseUrl,
  passwordResetContent,
  paymentFailedContent,
  renderLocateFlowEmail,
  resolveEmailLocale,
  securityNoticeContent,
  type SecurityNoticeKind,
  sendEmailWithResult,
  subscriptionActivatedContent,
  subscriptionCanceledContent,
  weeklyDigestHtml,
  weeklyDigestText,
} from "@/lib/email";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  type UnsubscribeKind,
} from "@/lib/unsubscribe";
import { isEmailTypeOptedOut } from "@/lib/unsubscribe-actions";

const SAFE_METADATA_KEYS = new Set([
  "kind",
  "templateSlug",
  "slug",
  "fromAddress",
  "configError",
  "resendApiError",
  "retryAvailable",
  "templateUnavailable",
  "userId",
  "serviceId",
  "taskId",
  "supportTicketId",
  "subscriptionId",
  "movingPlanId",
  "daysUntilDue",
  "daysOverdue",
  "daysRemaining",
  "weekStart",
  "weekEnd",
  "month",
  "status",
  "oldStatus",
  "newStatus",
  "provider",
  "platform",
  "planLabel",
  "billingInterval",
  "billingDate",
  "accessEndsOn",
]);
const SENSITIVE_METADATA_KEY = /password|token|otp|secret|jwt|cookie/i;

function detailTable(rows: Array<[string, string | null | undefined]>) {
  const visibleRows = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (visibleRows.length === 0) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef3f8" style="width:100%;border-collapse:collapse;background:#eef3f8;border-radius:8px;margin:0 0 4px;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            ${visibleRows.map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #d9e1ea;font-size:14px;line-height:20px;color:#5f6b7a;">${escapeHtml(label)}</td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #d9e1ea;font-size:14px;line-height:20px;color:#172033;font-weight:600;">${escapeHtml(String(value))}</td>
              </tr>`).join("")}
          </table>
        </td>
      </tr>
    </table>`;
}

function buildSimpleContent(opts: {
  subject: string;
  title: string;
  preheader: string;
  userName: string;
  bodyLines: string[];
  details?: Array<[string, string | null | undefined]>;
  cta?: { href: string; label: string };
  securityNote?: boolean;
  locale?: string | null;
}): EmailContent {
  const locale = resolveEmailLocale(opts.locale);
  const bodyHtml = [
    `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#172033;">Hi <strong>${escapeHtml(opts.userName || "there")}</strong>,</p>`,
    ...opts.bodyLines.map((line) => `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#172033;">${escapeHtml(line)}</p>`),
    opts.details ? detailTable(opts.details) : "",
  ].join("");
  const html = renderLocateFlowEmail({
    preheader: opts.preheader,
    title: opts.title,
    bodyHtml,
    cta: opts.cta,
    securityNote: opts.securityNote,
    locale,
  });
  return { subject: opts.subject, html, text: htmlToPlainText(html) };
}

function hasRenderableEmailBody(content: Pick<EmailContent, "html" | "text"> | null | undefined) {
  return Boolean(content?.html?.trim() || content?.text?.trim());
}

function buildEmailMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || SENSITIVE_METADATA_KEY.test(key)) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = typeof value === "string" ? value.slice(0, 191) : value;
    }
  }
  return JSON.stringify(safe);
}

function isUniqueConstraintError(error: any) {
  return error?.code === "P2002";
}

async function resolveAppUrl() {
  return normalizeBaseUrl(
    (await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL")) || DEFAULT_APP_URL,
  );
}

/**
 * Builds the per-recipient unsubscribe URL + List-Unsubscribe headers for
 * a marketing-class email. Returns null if no userId is provided (e.g.
 * tests or one-off ops sends) so the sender keeps working without
 * compliance plumbing.
 *
 * The "kind" maps to the type the email belongs to so the user lands on
 * an unsub page that pre-targets that category. The token itself is the
 * same per-user signature regardless of kind, so future emails can reuse
 * one-click links without DB lookups on click.
 */
function buildMarketingUnsubscribe(
  userId: string | null | undefined,
  appUrl: string,
  kind: UnsubscribeKind,
): { url: string; headers: Record<string, string> } | null {
  if (!userId) return null;
  try {
    const token = signUnsubscribeToken(userId);
    const url = buildUnsubscribeUrl(appUrl, token, kind);
    const headers = buildUnsubscribeHeaders(url);
    return { url, headers };
  } catch (err) {
    // Missing secret in dev — not worth blocking the email; log once.
    console.warn("[EMAIL] unsubscribe token unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function resolveTemplateId(
  templateId?: string | null,
  templateSlug?: string | null,
): Promise<string | null> {
  if (templateId) return templateId;
  if (!templateSlug) return null;

  const template = await prisma.emailTemplate.findUnique({
    where: { slug: templateSlug },
    select: { id: true },
  });
  return template?.id || null;
}

export async function sendLoggedEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string | null;
  templateSlug?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<{ success: boolean; skipped: boolean }> {
  const templateId = await resolveTemplateId(opts.templateId, opts.templateSlug);
  const metadataInput = {
    ...(opts.metadata || {}),
    templateSlug: opts.templateSlug || null,
  };
  const metadata = buildEmailMetadata(metadataInput);
  let logId: string;

  try {
    const log = await prisma.emailLog.create({
      data: {
        templateId,
        dedupeKey: opts.dedupeKey ?? null,
        to: opts.to,
        subject: opts.subject,
        status: "PENDING",
        metadata,
      },
    });
    logId = log.id;
  } catch (error) {
    if (opts.dedupeKey && isUniqueConstraintError(error)) {
      const existing = await prisma.emailLog.findFirst({
        where: { dedupeKey: opts.dedupeKey },
      });
      if (!existing) {
        return { success: false, skipped: true };
      }

      if (existing.status === "FAILED") {
        const claimed = await prisma.emailLog.updateMany({
          where: { id: existing.id, status: "FAILED" },
          data: {
            status: "PENDING",
            error: null,
            sentAt: null,
            providerMessageId: null,
            templateId,
            to: opts.to,
            subject: opts.subject,
            metadata,
          },
        });
        if (claimed.count === 0) {
          return { success: false, skipped: true };
        }
        logId = existing.id;
      } else {
        return { success: existing.status === "SENT", skipped: true };
      }
    } else {
      console.error("[EMAIL] Failed to create email log:", error);
      throw error;
    }
  }

  const result = await sendEmailWithResult({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...(opts.headers ? { headers: opts.headers } : {}),
  });
  const resultMetadata = buildEmailMetadata({
    ...metadataInput,
    fromAddress: result.fromEmail,
    configError: Boolean(result.configError),
    resendApiError: Boolean(result.error && !result.configError),
    retryAvailable: !result.success,
  });

  try {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: result.success ? "SENT" : "FAILED",
        error: result.error,
        providerMessageId: result.providerMessageId,
        sentAt: result.success ? new Date() : null,
        metadata: resultMetadata,
      },
    });
  } catch (error) {
    console.error("[EMAIL] Failed to update email log:", error);
  }

  return { success: result.success, skipped: false };
}

async function logUnavailableTemplateEmail(opts: {
  to: string;
  slug: string;
  userId?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}) {
  const error = `Email template '${opts.slug}' is missing or inactive.`;
  const metadata = buildEmailMetadata({
    ...(opts.metadata || {}),
    kind: "template-unavailable",
    slug: opts.slug,
    templateSlug: opts.slug,
    userId: opts.userId || null,
    templateUnavailable: true,
    retryAvailable: true,
  });

  try {
    await prisma.emailLog.create({
      data: {
        templateId: null,
        dedupeKey: opts.dedupeKey ?? null,
        to: opts.to,
        subject: `Email template unavailable: ${opts.slug}`.slice(0, 200),
        status: "FAILED",
        error,
        metadata,
      },
    });
  } catch (error) {
    if (opts.dedupeKey && isUniqueConstraintError(error)) return;
    console.error("[EMAIL] Failed to log unavailable email template:", error);
  }
}

/**
 * Renders an email template from the DB by replacing {{variable}} placeholders.
 */
/**
 * Resolve the actual template slug for a given locale. If `${baseSlug}-${locale}`
 * exists and is active, that is used; otherwise we fall back to the base slug.
 * "en" always returns the base slug (English is the canonical content).
 */
async function resolveLocalizedSlug(
  baseSlug: string,
  locale?: string | null,
): Promise<string> {
  const normalized = (locale || "").toLowerCase();
  if (!normalized || normalized === "en" || normalized.startsWith("en-")) {
    return baseSlug;
  }
  const lang = normalized.split("-")[0];
  const candidate = `${baseSlug}-${lang}`;
  const localized = await prisma.emailTemplate.findUnique({
    where: { slug: candidate },
    select: { isActive: true },
  });
  return localized?.isActive ? candidate : baseSlug;
}

export async function renderTemplate(
  slug: string,
  variables: Record<string, string>,
  locale?: string | null,
): Promise<(EmailContent & { templateId: string; slug: string }) | null> {
  const effectiveSlug = await resolveLocalizedSlug(slug, locale);
  const template = await prisma.emailTemplate.findUnique({
    where: { slug: effectiveSlug },
  });

  if (!template || !template.isActive) return null;

  let subject = template.subject;
  let html = template.body;

  for (const [key, value] of Object.entries(variables)) {
    const escaped = escapeTemplateHtml(value);
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(pattern, value);
    html = html.replace(pattern, escaped);
  }

  // Defense-in-depth: even though the admin save path sanitizes on write,
  // older templates persisted before sanitization (or any out-of-band DB
  // edit) could carry unsafe HTML. Sanitize again at render so the final
  // email body never contains <script>, <iframe>, event handlers, or
  // javascript: URLs regardless of what's stored. Variable values are
  // already escaped above, so this pass is idempotent on safe input.
  const safeSubject = sharedSanitizeEmailSubject(subject);
  const safeHtml = sharedSanitizeEmailHtml(html);

  return {
    subject: safeSubject,
    html: safeHtml,
    text: htmlToPlainText(safeHtml),
    templateId: template.id,
    slug: template.slug,
  };
}

/**
 * Send a DB-templated email and log it against the template row.
 */
export async function sendTemplatedEmail(opts: {
  to: string;
  slug: string;
  variables: Record<string, string>;
  userId?: string;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
  /**
   * When set, appends a per-recipient unsubscribe footer after the
   * template renders. Saves us from threading a {{unsubscribeLink}}
   * variable through every marketing template seed.
   */
  unsubscribeUrl?: string | null;
}): Promise<boolean> {
  const rendered = await renderTemplate(opts.slug, opts.variables, opts.locale);
  if (!rendered || !hasRenderableEmailBody(rendered)) {
    console.warn(`[EMAIL] Template '${opts.slug}' not found, inactive, or empty`);
    await logUnavailableTemplateEmail({
      to: opts.to,
      slug: opts.slug,
      userId: opts.userId,
      dedupeKey: opts.dedupeKey,
      metadata: opts.metadata,
    });
    return false;
  }

  const finalContent = opts.unsubscribeUrl
    ? appendUnsubscribeFooter(
        { subject: rendered.subject, html: rendered.html, text: rendered.text },
        opts.unsubscribeUrl,
        resolveEmailLocale(opts.locale),
      )
    : { subject: rendered.subject, html: rendered.html, text: rendered.text };

  const result = await sendLoggedEmail({
    to: opts.to,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateId: rendered.templateId,
    templateSlug: rendered.slug,
    dedupeKey: opts.dedupeKey,
    headers: opts.headers,
    metadata: {
      slug: opts.slug,
      renderedSlug: rendered.slug,
      locale: opts.locale || null,
      userId: opts.userId || null,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

/**
 * Welcome email, sent when a new user signs up.
 */
export async function sendWelcomeEmail(user: {
  email: string;
  firstName?: string | null;
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const variables = {
    firstName: user.firstName || "there",
    dashboardLink: `${appUrl}/dashboard`,
    appUrl,
  };
  const rendered = await renderTemplate("welcome", variables, user.locale);
  const renderedWelcome = hasRenderableEmailBody(rendered) ? rendered : null;
  const content = renderedWelcome
    ? renderedWelcome
    : buildSimpleContent({
        subject: "Welcome to LocateFlow",
        title: "Welcome to LocateFlow",
        preheader: "Your LocateFlow account is ready.",
        userName: user.firstName || "there",
        bodyLines: [
          "Welcome to LocateFlow. You can now organize addresses, services, reminders, and moving tasks in one place.",
        ],
        details: [["Start", "Review your dashboard"]],
        cta: { href: `${appUrl}/dashboard`, label: "Open Dashboard" },
        locale: user.locale,
      });

  if (!renderedWelcome) {
    console.warn("[EMAIL] Welcome template missing or empty; using inline fallback");
  }

  const result = await sendLoggedEmail({
    to: user.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateId: renderedWelcome?.templateId,
    templateSlug: renderedWelcome?.slug || "welcome",
    dedupeKey: user.dedupeKey,
    metadata: {
      kind: "welcome",
      templateUnavailable: !renderedWelcome,
    },
  });
  return result.success;
}

/**
 * Workspace invitation — sent when an owner/admin invites someone to a
 * workspace. Transactional (no unsubscribe). Inline content so it works without
 * a DB template; in dev with no email provider configured it logs as failed and
 * the route still surfaces the link to the inviter.
 */
export async function sendWorkspaceInvitationEmail(opts: {
  invitedEmail: string;
  workspaceName: string;
  inviterName?: string | null;
  roleLabel: string;
  acceptUrl: string;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const inviter = opts.inviterName?.trim() || "A LocateFlow member";
  const isEs = (opts.locale || "").toLowerCase().startsWith("es");
  const content = isEs
    ? buildSimpleContent({
        subject: sharedSanitizeEmailSubject(`Te invitaron a unirte a ${opts.workspaceName} en LocateFlow`),
        title: `Unirse a ${opts.workspaceName}`,
        preheader: `${inviter} te invitó a ${opts.workspaceName}.`,
        userName: "hola",
        bodyLines: [
          `${inviter} te invitó a unirte a ${opts.workspaceName} como ${opts.roleLabel}.`,
          "Abre la invitación para revisarla y unirte. Puedes salir del espacio cuando quieras.",
        ],
        details: [
          ["Espacio", opts.workspaceName],
          ["Rol", opts.roleLabel],
        ],
        cta: { href: opts.acceptUrl, label: "Revisar invitación" },
        securityNote: true,
        locale: opts.locale,
      })
    : buildSimpleContent({
        subject: sharedSanitizeEmailSubject(`You're invited to join ${opts.workspaceName} on LocateFlow`),
        title: `Join ${opts.workspaceName}`,
        preheader: `${inviter} invited you to ${opts.workspaceName}.`,
        userName: "there",
        bodyLines: [
          `${inviter} invited you to join ${opts.workspaceName} as ${opts.roleLabel}.`,
          "Open the invitation to review it and join. You can leave the workspace at any time.",
        ],
        details: [
          ["Workspace", opts.workspaceName],
          ["Role", opts.roleLabel],
        ],
        cta: { href: opts.acceptUrl, label: "Review invitation" },
        securityNote: true,
        locale: opts.locale,
      });
  const result = await sendLoggedEmail({
    to: opts.invitedEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "workspace-invitation",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "workspace-invitation", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Workspace ownership transfer — sent to the NEW owner when ownership moves to
 * them (manual transfer, or auto-transfer when the previous owner deletes their
 * account). Transactional. Without this the new owner silently inherits the
 * billing/management responsibility for the workspace.
 */
export async function sendWorkspaceOwnershipEmail(opts: {
  newOwnerEmail: string;
  newOwnerName?: string | null;
  workspaceName: string;
  manageUrl: string;
  reason?: "transfer" | "previous_owner_left";
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const name = opts.newOwnerName?.trim() || "there";
  const isEs = (opts.locale || "").toLowerCase().startsWith("es");
  const becauseLeft = opts.reason === "previous_owner_left";
  const content = isEs
    ? buildSimpleContent({
        subject: sharedSanitizeEmailSubject(`Ahora eres propietario de ${opts.workspaceName} en LocateFlow`),
        title: `Eres el propietario de ${opts.workspaceName}`,
        preheader: `La propiedad de ${opts.workspaceName} ahora es tuya.`,
        userName: name === "there" ? "hola" : name,
        bodyLines: [
          becauseLeft
            ? `El propietario anterior cerró su cuenta, así que la propiedad de ${opts.workspaceName} pasó a ti. Nada se perdió.`
            : `La propiedad de ${opts.workspaceName} se transfirió a ti.`,
          "Como propietario administras los miembros, los roles y el plan del espacio.",
        ],
        details: [["Espacio", opts.workspaceName]],
        cta: { href: opts.manageUrl, label: "Administrar espacio" },
        securityNote: false,
        locale: opts.locale,
      })
    : buildSimpleContent({
        subject: sharedSanitizeEmailSubject(`You're now the owner of ${opts.workspaceName} on LocateFlow`),
        title: `You own ${opts.workspaceName}`,
        preheader: `Ownership of ${opts.workspaceName} is now yours.`,
        userName: name,
        bodyLines: [
          becauseLeft
            ? `The previous owner closed their account, so ownership of ${opts.workspaceName} passed to you. Nothing was lost.`
            : `Ownership of ${opts.workspaceName} was transferred to you.`,
          "As the owner you manage the workspace's members, roles, and plan.",
        ],
        details: [["Workspace", opts.workspaceName]],
        cta: { href: opts.manageUrl, label: "Manage workspace" },
        securityNote: false,
        locale: opts.locale,
      });
  const result = await sendLoggedEmail({
    to: opts.newOwnerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "workspace-ownership",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "workspace-ownership", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Workspace membership change — sent to a member when their role changes or
 * they're removed from a workspace. Transactional, mirrors the in-app notice.
 */
export async function sendWorkspaceMembershipEmail(opts: {
  kind: "role_changed" | "removed";
  userEmail: string;
  userName?: string | null;
  workspaceName: string;
  roleLabel?: string | null;
  manageUrl: string;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const name = opts.userName?.trim() || "there";
  const isEs = (opts.locale || "").toLowerCase().startsWith("es");
  const removed = opts.kind === "removed";
  const ws = opts.workspaceName;
  const role = opts.roleLabel || "Member";
  const content = isEs
    ? buildSimpleContent({
        subject: sharedSanitizeEmailSubject(removed ? `Te quitaron de ${ws}` : `Tu rol en ${ws} cambió`),
        title: removed ? `Saliste de ${ws}` : `Tu rol en ${ws}`,
        preheader: removed ? `Ya no eres miembro de ${ws}.` : `Tu rol ahora es ${role}.`,
        userName: name === "there" ? "hola" : name,
        bodyLines: removed
          ? [`Te quitaron de ${ws} en LocateFlow.`, "Tu cuenta y tus datos personales no se ven afectados."]
          : [`Tu rol en ${ws} ahora es ${role}.`],
        details: removed ? [["Espacio", ws]] : [["Espacio", ws], ["Nuevo rol", role]],
        cta: { href: opts.manageUrl, label: "Ver espacio" },
        securityNote: false,
        locale: opts.locale,
      })
    : buildSimpleContent({
        subject: sharedSanitizeEmailSubject(removed ? `You were removed from ${ws}` : `Your role in ${ws} changed`),
        title: removed ? `Removed from ${ws}` : `Role updated in ${ws}`,
        preheader: removed ? `You're no longer a member of ${ws}.` : `Your role is now ${role}.`,
        userName: name,
        bodyLines: removed
          ? [`You were removed from ${ws} on LocateFlow.`, "Your own account and personal data are unaffected."]
          : [`Your role in ${ws} is now ${role}.`],
        details: removed ? [["Workspace", ws]] : [["Workspace", ws], ["New role", role]],
        cta: { href: opts.manageUrl, label: "View workspace" },
        securityNote: false,
        locale: opts.locale,
      });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "workspace-membership",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "workspace-membership", event: opts.kind, ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Connector "action needed" — sent when an address sync to a partner can't
 * complete automatically (NEEDS_USER: token expired, validation rejected, or
 * unsupported). Transactional; the user must act, so it always sends. Without
 * this the sync fails silently and the user thinks their address was updated.
 */
export async function sendConnectorActionNeededEmail(opts: {
  userEmail: string;
  userName?: string | null;
  connectorKey: string;
  dedupeKey?: string;
}): Promise<boolean> {
  const partner = opts.connectorKey.toUpperCase();
  const appUrl = await resolveAppUrl();
  const content = buildSimpleContent({
    subject: `Action needed: finish updating your address with ${partner}`,
    title: "Action needed to sync your address",
    preheader: `We couldn't finish updating your address with ${partner}.`,
    userName: opts.userName || "there",
    bodyLines: [
      `We couldn't finish updating your address with ${partner} automatically.`,
      "Open Connections to reconnect the partner or complete the change yourself.",
    ],
    details: [["Partner", partner]],
    cta: { href: `${appUrl}/settings/connections`, label: "Open Connections" },
    securityNote: true,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "connector-action-needed",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "connector-action-needed" },
  });
  return result.success;
}

/**
 * Email verification, sent after registration.
 */
function isNonEnglishLocale(locale?: string | null): boolean {
  if (!locale) return false;
  const normalized = locale.toLowerCase();
  return normalized !== "en" && !normalized.startsWith("en-");
}

export async function sendEmailVerificationEmail(opts: {
  userEmail: string;
  userName: string;
  verifyToken: string;
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const verifyLink = `${appUrl}/verify-email/${encodeURIComponent(opts.verifyToken)}`;

  // For non-English locales, prefer the DB-templated translation when available.
  // English keeps the inline content path so behavior is unchanged for the
  // dominant traffic.
  if (isNonEnglishLocale(opts.locale)) {
    const rendered = await renderTemplate(
      "email-verify",
      { firstName: opts.userName, verifyLink },
      opts.locale,
    );
    if (rendered && rendered.slug !== "email-verify") {
      const result = await sendLoggedEmail({
        to: opts.userEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        templateId: rendered.templateId,
        templateSlug: rendered.slug,
        dedupeKey: opts.dedupeKey,
        metadata: { kind: "email-verification", locale: opts.locale ?? null },
      });
      return result.success;
    }
  }

  const content = emailVerificationContent({
    userName: opts.userName,
    verifyLink,
  });

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "email-verify",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "email-verification", locale: opts.locale ?? null },
  });
  return result.success;
}

/**
 * Password reset or set-password link.
 */
export async function sendPasswordResetEmail(opts: {
  userEmail: string;
  userName: string;
  resetToken: string;
  mode?: "reset" | "set-password";
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const resetLink = `${appUrl}/reset-password/${encodeURIComponent(opts.resetToken)}`;
  const mode = opts.mode || "reset";

  // Reset (not set-password) has a Spanish DB template. Set-password is a
  // different flow with inline-only content.
  if (mode === "reset" && isNonEnglishLocale(opts.locale)) {
    const rendered = await renderTemplate(
      "password-reset",
      { firstName: opts.userName, resetLink },
      opts.locale,
    );
    if (rendered && rendered.slug !== "password-reset") {
      const result = await sendLoggedEmail({
        to: opts.userEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        templateId: rendered.templateId,
        templateSlug: rendered.slug,
        dedupeKey: opts.dedupeKey,
        metadata: { kind: "password-reset", locale: opts.locale ?? null },
      });
      return result.success;
    }
  }

  const content = passwordResetContent({
    userName: opts.userName,
    resetLink,
    mode,
  });

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "password-reset",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: mode === "set-password" ? "set-password" : "password-reset",
      locale: opts.locale ?? null,
    },
  });
  return result.success;
}

function escapeTemplateHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (str || "").replace(/[&<>"']/g, (c) => map[c] || c);
}

export async function sendBillReminderEmail(opts: {
  userEmail: string;
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const subject = `Bill reminder: ${opts.serviceName} - $${opts.amount.toFixed(2)} due in ${opts.daysUntilDue} day${opts.daysUntilDue !== 1 ? "s" : ""}`;
  const emailData = {
    userName: opts.userName,
    serviceName: opts.serviceName,
    category: opts.category,
    amount: opts.amount,
    dueDate: opts.dueDate,
    daysUntilDue: opts.daysUntilDue,
    appUrl,
  };
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const baseContent: EmailContent = {
    subject,
    html: billReminderHtml(emailData),
    text: billReminderText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "bill-reminder",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    metadata: {
      kind: "bill-reminder",
      daysUntilDue: opts.daysUntilDue,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

export async function sendWeeklyDigestEmail(opts: {
  userEmail: string;
  userName: string;
  weekStart: string;
  weekEnd: string;
  upcomingBills: { name: string; amount: number; dueDate: string }[];
  totalExpenses: number;
  newServices: number;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "MARKETING"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const emailData = {
    userName: opts.userName,
    weekStart: opts.weekStart,
    weekEnd: opts.weekEnd,
    upcomingBills: opts.upcomingBills,
    totalExpenses: opts.totalExpenses,
    newServices: opts.newServices,
    appUrl,
  };
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "marketing");
  const baseContent: EmailContent = {
    subject: `Your weekly digest - ${opts.weekStart} to ${opts.weekEnd}`,
    html: weeklyDigestHtml(emailData),
    text: weeklyDigestText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "weekly-digest",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    metadata: {
      kind: "weekly-digest",
      weekStart: opts.weekStart,
      weekEnd: opts.weekEnd,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

export async function sendContractReminderEmail(opts: {
  userEmail: string;
  userName: string;
  serviceName: string;
  contractEndDate: string;
  daysRemaining: number;
  serviceLink: string;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const subject = `${opts.serviceName} contract ends in ${opts.daysRemaining} day${opts.daysRemaining === 1 ? "" : "s"}`;
  const emailData = {
    userName: opts.userName || "there",
    serviceName: opts.serviceName,
    contractEndDate: opts.contractEndDate,
    daysRemaining: opts.daysRemaining,
    serviceLink: opts.serviceLink,
  };
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const baseContent: EmailContent = {
    subject,
    html: contractReminderHtml(emailData),
    text: contractReminderText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "contract-reminder",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    metadata: {
      kind: "contract-reminder",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

/**
 * Trial expiring email, sent before a free trial ends.
 */
export async function sendTrialExpiringEmail(opts: {
  userEmail: string;
  userName: string;
  daysRemaining: number;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  // Trial-expiry is a lifecycle/billing warning (imminent access loss +
  // auto-charge), NOT a promotional offer. Gate it on the REMINDER opt-out so
  // a user who unsubscribed from MARKETING offers still receives it.
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "trial-expiring",
    locale: opts.locale,
    userId: opts.userId ?? undefined,
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    unsubscribeUrl: unsubscribe?.url,
    metadata: {
      kind: "trial-expiring",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
    variables: {
      firstName: opts.userName || "there",
      daysLeft: String(opts.daysRemaining),
      upgradeLink: `${appUrl}/settings/subscription`,
      appUrl,
    },
  });
}

/**
 * Move reminder email, sent before moving day.
 */
export async function sendMoveReminderEmail(opts: {
  userEmail: string;
  userName: string;
  fromCity: string;
  toCity: string;
  moveDate: string;
  daysRemaining: number;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "move-reminder",
    locale: opts.locale,
    userId: opts.userId ?? undefined,
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    unsubscribeUrl: unsubscribe?.url,
    metadata: {
      kind: "move-reminder",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
    variables: {
      firstName: opts.userName || "there",
      fromCity: opts.fromCity,
      toCity: opts.toCity,
      moveDate: opts.moveDate,
      appUrl,
    },
  });
}

/**
 * Subscription activated, sent after Stripe checkout completes.
 */
export async function sendSubscriptionActivatedEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  amountFormatted?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = subscriptionActivatedContent({
    userName: opts.userName,
    planLabel: opts.planLabel,
    amountFormatted: opts.amountFormatted,
    manageLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-activated",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "subscription-activated", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Subscription canceled, sent on customer.subscription.deleted.
 */
export async function sendSubscriptionCanceledEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  accessEndsOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = subscriptionCanceledContent({
    userName: opts.userName,
    planLabel: opts.planLabel,
    accessEndsOn: opts.accessEndsOn,
    reactivateLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-canceled",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "subscription-canceled", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Payment failed, sent on invoice.payment_failed.
 */
export async function sendPaymentFailedEmail(opts: {
  userEmail: string;
  userName: string;
  amountFormatted?: string | null;
  nextAttemptOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = paymentFailedContent({
    userName: opts.userName,
    amountFormatted: opts.amountFormatted,
    nextAttemptOn: opts.nextAttemptOn,
    retryLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "payment-failed",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "payment-failed", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Subscription renewal resumed, sent when a user turns auto-renew back on.
 */
export async function sendSubscriptionResumedEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  renewsOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const details: Array<[string, string | null | undefined]> = [
    ["Plan", opts.planLabel],
    ["Next renewal", opts.renewsOn],
  ];
  const content = buildSimpleContent({
    subject: "Your LocateFlow subscription will renew",
    title: "Subscription renewal resumed",
    preheader: "Auto-renew is back on for your LocateFlow subscription.",
    userName: opts.userName,
    bodyLines: [
      "Auto-renew is back on for your subscription. Your LocateFlow access will continue without interruption.",
      "You can review billing details or make changes from subscription settings.",
    ],
    details,
    cta: { href: `${appUrl}/settings/subscription`, label: "Review Subscription" },
    locale: opts.locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-resumed",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "subscription-resumed",
      planLabel: opts.planLabel,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

/**
 * Subscription plan or billing cadence updated.
 */
export async function sendSubscriptionUpdatedEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  billingInterval?: string | null;
  effectiveOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const content = buildSimpleContent({
    subject: "Your LocateFlow plan was updated",
    title: "Plan updated",
    preheader: "Your LocateFlow subscription details changed.",
    userName: opts.userName,
    bodyLines: [
      "Your LocateFlow subscription has been updated.",
      "You can review the current plan, renewal date, and billing details from your account settings.",
    ],
    details: [
      ["Plan", opts.planLabel],
      ["Billing", opts.billingInterval],
      ["Effective", opts.effectiveOn],
    ],
    cta: { href: `${appUrl}/settings/subscription`, label: "Review Subscription" },
    locale: opts.locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-upgrade",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "subscription-updated",
      planLabel: opts.planLabel,
      billingInterval: opts.billingInterval || null,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

export async function sendTaskReminderEmail(opts: {
  userEmail: string;
  userName: string;
  taskTitle: string;
  dueDate: string;
  daysUntilDue: number;
  movingPlanLabel?: string | null;
  movingPlanId?: string | null;
  taskId?: string | null;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const dueText = opts.daysUntilDue === 0
    ? "due today"
    : `due in ${opts.daysUntilDue} day${opts.daysUntilDue === 1 ? "" : "s"}`;
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const baseContent = buildSimpleContent({
    subject: `Task reminder: ${opts.taskTitle} is ${dueText}`,
    title: "Task reminder",
    preheader: `${opts.taskTitle} is ${dueText}.`,
    userName: opts.userName,
    bodyLines: [
      `Your moving task "${opts.taskTitle}" is ${dueText}.`,
      "A quick review now can help keep your move timeline on track.",
    ],
    details: [
      ["Task", opts.taskTitle],
      ["Due date", opts.dueDate],
      ["Moving plan", opts.movingPlanLabel],
    ],
    cta: {
      href: opts.movingPlanId ? `${appUrl}/moving/${opts.movingPlanId}` : `${appUrl}/moving`,
      label: "View Moving Plan",
    },
    locale,
  });
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "task-reminder",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    metadata: {
      kind: "task-reminder",
      userId: opts.userId || null,
      taskId: opts.taskId || null,
      movingPlanId: opts.movingPlanId || null,
      daysUntilDue: opts.daysUntilDue,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

export async function sendBillOverdueEmail(opts: {
  userEmail: string;
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  serviceId?: string | null;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const overdueText = opts.daysOverdue === 1 ? "1 day overdue" : `${opts.daysOverdue} days overdue`;
  const baseContent = buildSimpleContent({
    subject: `Overdue bill: ${opts.serviceName}`,
    title: "Bill overdue",
    preheader: `${opts.serviceName} appears to be ${overdueText}.`,
    userName: opts.userName,
    bodyLines: [
      `Your ${opts.serviceName} bill appears to be ${overdueText}.`,
      "If you already handled it, you can ignore this reminder or update the service details in LocateFlow.",
    ],
    details: [
      ["Service", opts.serviceName],
      ["Category", opts.category],
      ["Amount", `$${opts.amount.toFixed(2)}`],
      ["Due date", opts.dueDate],
    ],
    cta: {
      href: opts.serviceId ? `${appUrl}/services/${opts.serviceId}` : `${appUrl}/services`,
      label: "Review Service",
    },
    locale,
  });
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "bill-overdue",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    metadata: {
      kind: "bill-overdue",
      userId: opts.userId || null,
      serviceId: opts.serviceId || null,
      daysOverdue: opts.daysOverdue,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

export async function sendMonthlyReportEmail(opts: {
  userEmail: string;
  userName: string;
  month: string;
  totalSpend: number;
  servicesCount: number;
  tasksCompleted: number;
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "MARKETING"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "marketing");
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "monthly-report",
    locale: opts.locale,
    userId: opts.userId ?? undefined,
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    unsubscribeUrl: unsubscribe?.url,
    metadata: {
      kind: "monthly-report",
      userId: opts.userId || null,
      month: opts.month,
      ...(opts.metadata || {}),
    },
    variables: {
      firstName: opts.userName || "there",
      month: opts.month,
      totalSpend: opts.totalSpend.toFixed(2),
      servicesCount: String(opts.servicesCount),
      tasksCompleted: String(opts.tasksCompleted),
      appUrl,
    },
  });
}

export async function sendSupportTicketCreatedEmail(opts: {
  userEmail: string;
  userName: string;
  ticketId: string;
  subject: string;
  priority: string;
  category: string;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const content = buildSimpleContent({
    subject: `Support ticket received: ${opts.subject}`.slice(0, 200),
    title: "Support ticket received",
    preheader: "We received your support request.",
    userName: opts.userName,
    bodyLines: [
      "We received your support request and will follow up as soon as we can.",
      "You can view the ticket and add more details from your support center.",
    ],
    details: [
      ["Ticket", `#${opts.ticketId.slice(-6)}`],
      ["Subject", opts.subject],
      ["Priority", opts.priority],
      ["Category", opts.category],
    ],
    cta: { href: `${appUrl}/support/${opts.ticketId}`, label: "View Ticket" },
    locale: opts.locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "support-ticket-created",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "support-ticket-created",
      supportTicketId: opts.ticketId,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

export async function sendSupportTicketReplyEmail(opts: {
  userEmail: string;
  userName: string;
  ticketId: string;
  ticketSubject: string;
  replyPreview?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const content = buildSimpleContent({
    subject: `New reply on: ${opts.ticketSubject}`.slice(0, 200),
    title: "New support reply",
    preheader: "Support replied to your ticket.",
    userName: opts.userName,
    bodyLines: [
      "Our support team replied to your ticket.",
      opts.replyPreview ? `Reply preview: ${opts.replyPreview.slice(0, 240)}` : "Open the ticket to read the latest reply.",
    ],
    details: [
      ["Ticket", `#${opts.ticketId.slice(-6)}`],
      ["Subject", opts.ticketSubject],
    ],
    cta: { href: `${appUrl}/support/${opts.ticketId}`, label: "View Reply" },
    locale: opts.locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "support-ticket-reply",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "support-ticket-reply",
      supportTicketId: opts.ticketId,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

export async function sendSupportTicketStatusEmail(opts: {
  userEmail: string;
  userName: string;
  ticketId: string;
  ticketSubject: string;
  status: string;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const content = buildSimpleContent({
    subject: `Support ticket ${opts.status.toLowerCase().replace(/_/g, " ")}`,
    title: "Support ticket updated",
    preheader: "Your support ticket status changed.",
    userName: opts.userName,
    bodyLines: ["Your support ticket status has changed."],
    details: [
      ["Ticket", `#${opts.ticketId.slice(-6)}`],
      ["Subject", opts.ticketSubject],
      ["Status", opts.status.replace(/_/g, " ")],
    ],
    cta: { href: `${appUrl}/support/${opts.ticketId}`, label: "View Ticket" },
    locale: opts.locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "support-ticket-status",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "support-ticket-status",
      supportTicketId: opts.ticketId,
      status: opts.status,
      ...(opts.metadata || {}),
    },
  });
  return result.success;
}

/**
 * Account-security notice (password changed, MFA toggled, OAuth linked, deletion requested).
 *
 * Single sender that branches on `kind` so all security-event copy lives
 * alongside each other in `securityNoticeContent` and we don't sprawl
 * one wrapper per event into this module.
 */
export async function sendSecurityNoticeEmail(opts: {
  userEmail: string;
  userName: string;
  kind: SecurityNoticeKind;
  detail?: string | null;
  occurredAt?: Date | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const occurredAt = opts.occurredAt ? opts.occurredAt.toISOString() : null;
  const content = securityNoticeContent({
    userName: opts.userName,
    kind: opts.kind,
    detail: opts.detail,
    occurredAt,
    manageLink: `${appUrl}/settings/security`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: `security-${opts.kind}`,
    dedupeKey: opts.dedupeKey,
    metadata: { kind: `security-${opts.kind}`, ...(opts.metadata || {}) },
  });
  return result.success;
}
