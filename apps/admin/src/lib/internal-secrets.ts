/**
 * Shared-secret authentication for server-to-server calls.
 *
 * `CRON_SECRET` is scoped to scheduled cron endpoints only. Internal webhook
 * calls must use `INTERNAL_WEBHOOK_SECRET`, and admin-to-web impersonation
 * must use `IMPERSONATION_HANDOFF_SECRET`. Do not broaden one secret into
 * another security boundary.
 */
export type InternalSecretKind = "cron" | "backup" | "internal" | "impersonation";

function getSpecificEnv(kind: InternalSecretKind): string | undefined {
  if (kind === "backup") return process.env.BACKUP_CRON_SECRET;
  if (kind === "internal") return process.env.INTERNAL_WEBHOOK_SECRET;
  if (kind === "impersonation") return process.env.IMPERSONATION_HANDOFF_SECRET;
  return undefined;
}

/** Constant-time string equality; safe in Edge Runtime. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyInternalAuth(
  authHeader: string | null | undefined,
  kind: InternalSecretKind,
): boolean {
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return false;
  const token = match[1].trim();
  if (!token) return false;

  const specific = getSpecificEnv(kind);
  if (specific && safeEqual(token, specific)) return true;
  if (kind === "cron" || (kind === "backup" && !specific)) {
    const cron = process.env.CRON_SECRET;
    if (cron && safeEqual(token, cron)) return true;
  }

  return false;
}

export function getInternalCallerSecret(
  kind: InternalSecretKind,
): string | undefined {
  const specific = getSpecificEnv(kind);
  if (specific) return specific;
  if (kind === "cron" || kind === "backup") return process.env.CRON_SECRET || undefined;
  return undefined;
}
