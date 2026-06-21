/**
 * Shared-secret authentication for server-to-server calls.
 *
 * `CRON_SECRET` is scoped to scheduled cron endpoints only. Internal webhook
 * calls must use `INTERNAL_WEBHOOK_SECRET`, and admin-to-web impersonation
 * must use `IMPERSONATION_HANDOFF_SECRET`. Do not broaden one secret into
 * another security boundary.
 */
export type InternalSecretKind = "cron" | "backup" | "internal" | "impersonation";

// Lazy import to avoid pulling the security-events module into edge-runtime
// callers that don't need it. Failures are swallowed.
function emitSecretMisuse(kind: InternalSecretKind, reason: string) {
  Promise.resolve()
    .then(() => import("./security-events"))
    .then(({ emitSecurityEvent }) => {
      emitSecurityEvent({
        type: kind === "cron" || kind === "backup" ? "CRON_SECRET_MISUSE" : "INTERNAL_SECRET_MISUSE",
        severity: "warn",
        context: { kind, reason },
      });
    })
    .catch(() => {
      /* never throw from the auth path */
    });
}

function getSpecificEnv(kind: InternalSecretKind): string | undefined {
  if (kind === "backup") return process.env.BACKUP_CRON_SECRET;
  if (kind === "internal") return process.env.INTERNAL_WEBHOOK_SECRET;
  if (kind === "impersonation") return process.env.IMPERSONATION_HANDOFF_SECRET;
  return undefined; // "cron" has no kind-specific alternate
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

/**
 * Verify an incoming `Authorization: Bearer ...` header against the secret
 * appropriate for the given kind.
 */
export function verifyInternalAuth(
  authHeader: string | null | undefined,
  kind: InternalSecretKind,
): boolean {
  // Missing header is the noise case (uncreated cookies, health probes).
  // We deliberately do NOT emit on it; that would drown the signal.
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    emitSecretMisuse(kind, "MALFORMED_AUTH_HEADER");
    return false;
  }
  const token = match[1].trim();
  if (!token) {
    emitSecretMisuse(kind, "EMPTY_TOKEN");
    return false;
  }

  const specific = getSpecificEnv(kind);
  if (specific && safeEqual(token, specific)) return true;
  if (kind === "cron" || (kind === "backup" && !specific)) {
    const cron = process.env.CRON_SECRET;
    if (cron && safeEqual(token, cron)) return true;
  }

  // A token was supplied and did not match any accepted secret for this
  // kind: definite misuse signal.
  emitSecretMisuse(kind, "TOKEN_MISMATCH");
  return false;
}

/**
 * Return the secret a caller should send for a given kind of internal call.
 * Internal and impersonation calls require kind-specific secrets.
 */
export function getInternalCallerSecret(
  kind: InternalSecretKind,
): string | undefined {
  const specific = getSpecificEnv(kind);
  if (specific) return specific;
  if (kind === "cron" || kind === "backup") return process.env.CRON_SECRET || undefined;
  return undefined;
}
