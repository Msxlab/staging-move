export const MAX_CSV_IMPORT_BYTES = 5 * 1024 * 1024;

const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Unknown";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Invalid email";

  const visible = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, visible)}***@${domain}`;
}

export function maskProviderIdentifier(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;

  const separatorIndex = trimmed.indexOf("_");
  const prefix =
    separatorIndex > 0
      ? trimmed.slice(0, separatorIndex + 1)
      : trimmed.slice(0, Math.min(4, trimmed.length));
  return `${prefix}****${trimmed.slice(-4)}`;
}

/**
 * Billing identifiers masked for non-privileged admin roles. Single source
 * of truth: the user-detail and subscriptions routes previously each kept
 * their own inline copy of this list + masking logic, so a new `stripe*Id`
 * added to one response could quietly ship raw from the other.
 */
export const BILLING_ID_FIELDS = [
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripePriceId",
  "billingProductId",
  "originalTransactionId",
  "latestTransactionId",
] as const;

export type BillingIdField = (typeof BILLING_ID_FIELDS)[number];

/** ADMIN and SUPER_ADMIN see raw billing identifiers; lower roles see masked. */
export function canSeeRawBillingIds(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Returns the billing-identifier fields for a subscription — raw when
 * `showRaw`, masked otherwise. Spread the result into the route response so
 * both endpoints expose the exact same set, masked the exact same way.
 */
export function redactBillingIds(
  subscription: Record<string, any> | null | undefined,
  showRaw: boolean,
): Record<BillingIdField, string | null> {
  const out = {} as Record<BillingIdField, string | null>;
  for (const field of BILLING_ID_FIELDS) {
    const value = subscription ? subscription[field] : null;
    out[field] = showRaw ? value ?? null : value ? maskProviderIdentifier(value) : null;
  }
  return out;
}

/**
 * Mask an IP address by zeroing the last 8 bits (IPv4) or the last 80
 * bits / 5 hextets (IPv6). Keeps enough of the address to identify a
 * geographic region or ISP without exposing a specific subscriber.
 */
export function maskIpAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // IPv4
  const ipv4 = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) return `${ipv4[1]}.0`;
  // IPv6 — drop everything after the third hextet
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return `${parts.slice(0, 3).join(":")}::`;
  }
  return "[redacted]";
}

/**
 * Truncate a User-Agent string to a coarse "client family" so admins
 * can recognise patterns ("a bunch of Chrome on Windows logins") without
 * the full fingerprint surface that the raw UA would expose. Anything
 * longer than the cap is replaced with the family marker only.
 */
export function summarizeUserAgent(value: string | null | undefined): string | null {
  if (!value) return null;
  const ua = value.trim();
  if (!ua) return null;
  let browser = "Unknown";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${browser} on ${os}`;
}

/**
 * Field-level redaction policy for the admin user-detail endpoint.
 *
 * Every admin role currently has `users:canRead` (VIEWER baseline), but
 * a VIEWER does not need raw IPs, full user-agents, OAuth provider IDs,
 * GDPR request payloads, or impersonation context. ADMIN gets enough
 * to investigate; SUPER_ADMIN gets the unredacted view.
 *
 * The shape of the returned object mirrors the input — fields that are
 * removed simply become null/undefined; consumers must tolerate either.
 */
export type AdminRoleForRedaction = "VIEWER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN" | string;

interface RedactionPayload {
  user?: any;
  sessions?: any[];
  recentEvents?: any[];
  pushDevices?: any[];
  loginSessions?: any[];
  gdprRequests?: any[];
  adminNotes?: any[];
  auditLogs?: any[];
  [key: string]: any;
}

export function redactUserDetail<T extends RedactionPayload>(
  payload: T,
  role: AdminRoleForRedaction,
): T {
  // SUPER_ADMIN: no redaction.
  if (role === "SUPER_ADMIN") return payload;

  const isAdmin = role === "ADMIN";
  const cloned: any = { ...payload };

  // User block — mask email for VIEWER/MODERATOR, scrub OAuth provider hints.
  if (cloned.user) {
    const u = { ...cloned.user };
    if (!isAdmin) {
      u.email = maskEmail(u.email);
      // Remove OAuth provider/providerId hints entirely for low-priv readers.
      if (Array.isArray(u.oauthAccounts)) {
        u.oauthAccounts = u.oauthAccounts.map((acc: any) => ({
          id: acc.id,
          provider: acc.provider,
          createdAt: acc.createdAt,
        }));
      }
      // Strip token metadata that exposes verification/reset history.
      delete u.emailVerificationTokens;
      delete u.passwordResetTokens;
      // Strip consent log; viewers don't need this for routine ops.
      delete u.dataConsents;
    }
    cloned.user = u;
  }

  // Session-shaped collections: redact IPs and UAs for non-ADMIN.
  const redactSessionLike = (rows: any[] | undefined) => {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => {
      const next = { ...row };
      if (!isAdmin) {
        if ("ipAddress" in next) next.ipAddress = maskIpAddress(next.ipAddress);
        if ("userAgent" in next) next.userAgent = summarizeUserAgent(next.userAgent);
      }
      // impersonation context is always SUPER_ADMIN-only context.
      if ("impersonatedByAdminId" in next && !isAdmin) {
        next.impersonatedByAdminId = next.impersonatedByAdminId ? "[redacted]" : null;
      }
      return next;
    });
  };

  cloned.sessions = redactSessionLike(cloned.sessions);
  cloned.loginSessions = redactSessionLike(cloned.loginSessions);
  cloned.recentEvents = redactSessionLike(cloned.recentEvents);

  // Push devices: even ADMIN sees deviceName masked beyond first 12 chars
  // because raw deviceName often includes the user's chosen device label.
  if (Array.isArray(cloned.pushDevices) && !isAdmin) {
    cloned.pushDevices = cloned.pushDevices.map((d: any) => ({
      ...d,
      deviceName: typeof d?.deviceName === "string" && d.deviceName.length > 12
        ? `${d.deviceName.slice(0, 12)}…`
        : d?.deviceName ?? null,
    }));
  }

  // GDPR requests: VIEWER/MODERATOR see only metadata (status/type/dates),
  // never the requestData payload which can contain free-form user input.
  if (Array.isArray(cloned.gdprRequests) && !isAdmin) {
    cloned.gdprRequests = cloned.gdprRequests.map((r: any) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));
  }

  // Admin notes: hidden from VIEWER/MODERATOR — these are operator-only.
  if (!isAdmin) {
    cloned.adminNotes = [];
  }

  return cloned as T;
}


export function validateCsvFileMetadata(file: {
  name?: unknown;
  size?: unknown;
  type?: unknown;
} | null | undefined):
  | { ok: true }
  | { ok: false; status: 413 | 415; error: string } {
  if (!file) return { ok: true };

  const name = typeof file.name === "string" ? file.name.trim() : "";
  const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const size =
    typeof file.size === "number"
      ? file.size
      : typeof file.size === "string"
      ? Number.parseInt(file.size, 10)
      : Number.NaN;
  const hasCsvExtension = name.toLowerCase().endsWith(".csv");

  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, status: 415, error: "CSV file metadata is invalid." };
  }

  if (size > MAX_CSV_IMPORT_BYTES) {
    return { ok: false, status: 413, error: "CSV import file must be 5 MB or smaller." };
  }

  const mimeAllowed =
    !type ||
    CSV_MIME_TYPES.has(type) ||
    ((type === "text/plain" || type === "application/octet-stream") && hasCsvExtension);

  if (!hasCsvExtension && !mimeAllowed) {
    return { ok: false, status: 415, error: "CSV import requires a .csv file." };
  }

  if (!mimeAllowed) {
    return { ok: false, status: 415, error: "CSV import file type is not supported." };
  }

  return { ok: true };
}
