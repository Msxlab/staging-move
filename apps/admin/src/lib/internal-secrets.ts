/**
 * Shared-secret authentication for server-to-server calls.
 *
 * `CRON_SECRET` is scoped to scheduled cron endpoints. Internal webhook calls
 * may still accept it for compatibility, but the admin-to-web impersonation
 * handoff must use `IMPERSONATION_HANDOFF_SECRET` and never falls back to
 * `CRON_SECRET`.
 */
export type InternalSecretKind = "cron" | "internal" | "impersonation";

function getSpecificEnv(kind: InternalSecretKind): string | undefined {
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
  if (kind === "impersonation") return false;

  const legacy = process.env.CRON_SECRET;
  if (legacy && safeEqual(token, legacy)) return true;

  return false;
}

export function getInternalCallerSecret(
  kind: InternalSecretKind,
): string | undefined {
  const specific = getSpecificEnv(kind);
  if (specific) return specific;
  if (kind === "impersonation") return undefined;
  return process.env.CRON_SECRET || undefined;
}
