/**
 * Shared-secret authentication for server-to-server calls.
 *
 * Historically a single `CRON_SECRET` protected three very different
 * surfaces — scheduled cron jobs, internal webhook fan-out (security events,
 * IP-rule cache, rate-limit logs), and the admin→web impersonation handoff.
 * One secret = one breach → three compromised surfaces. This helper lets
 * operators rotate them independently while staying backward-compatible
 * with deployments that only configure `CRON_SECRET`.
 *
 * Rollout strategy:
 *   1. Deploy this change — receivers accept EITHER the kind-specific
 *      secret (if set) OR the legacy `CRON_SECRET`. No break.
 *   2. Operator sets `INTERNAL_WEBHOOK_SECRET` + `IMPERSONATION_HANDOFF_SECRET`
 *      on both caller and receiver containers, then rotates `CRON_SECRET`
 *      to a fresh value used ONLY by scheduled cron endpoints.
 *   3. Once traffic stabilizes, operator may optionally drop acceptance
 *      of `CRON_SECRET` on internal/impersonation routes — but that
 *      enforcement switch is deliberately left for a later hardening pass.
 */
export type InternalSecretKind = "cron" | "internal" | "impersonation";

function getSpecificEnv(kind: InternalSecretKind): string | undefined {
  if (kind === "internal") return process.env.INTERNAL_WEBHOOK_SECRET;
  if (kind === "impersonation") return process.env.IMPERSONATION_HANDOFF_SECRET;
  return undefined;
}

/** Constant-time string equality — safe in Edge Runtime (no Node crypto). */
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

  const legacy = process.env.CRON_SECRET;
  if (legacy && safeEqual(token, legacy)) return true;

  return false;
}

export function getInternalCallerSecret(
  kind: InternalSecretKind,
): string | undefined {
  const specific = getSpecificEnv(kind);
  if (specific) return specific;
  return process.env.CRON_SECRET || undefined;
}
