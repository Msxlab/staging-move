/**
 * Validation for the admin-supplied notification `href`.
 *
 * The consumer web feed renders each notification with `<Link href={notif.href}>`,
 * which stamps the raw value straight into an `<a href>`. Without validation an
 * admin (or anyone with the `settings.canCreate` permission) could store a
 * `javascript:`/`data:`/`vbscript:` URL — stored XSS in every recipient's
 * browser — or an `http(s)://evil.example` URL — an open redirect / phishing
 * pivot. We therefore fail closed at the WRITE boundary so a bad href can never
 * reach the database, regardless of how a future renderer treats it.
 *
 * Allowed:
 *   - in-app relative paths: a single leading "/" followed by a non-slash
 *     (e.g. "/dashboard", "/moving/plan/abc"). Optional query/hash.
 *   - absolute https:// URLs whose host matches the configured app origin.
 *
 * Rejected (non-exhaustive): "javascript:...", "data:...", "vbscript:...",
 * "mailto:...", "http://..." (downgrade), protocol-relative "//evil",
 * backslash tricks "/\evil" or "\\evil", and any off-origin https host.
 */

// Reject any ASCII control char (0x00–0x1F), space (0x20), or DEL (0x7F).
// Browsers strip tab / LF / CR when resolving a URL, so "java\tscript:alert(1)"
// must be rejected outright rather than parsed. Implemented via char codes so
// no literal control bytes live in this source file.
function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

function appOriginHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns a normalized, safe href when valid; otherwise `{ ok: false }`.
 * A `null`/empty input is valid (no href) and yields `{ ok: true, value: null }`.
 */
export function sanitizeNotificationHref(
  href: string | null | undefined,
): { ok: true; value: string | null } | { ok: false } {
  if (href == null) return { ok: true, value: null };
  const trimmed = href.trim();
  if (trimmed === "") return { ok: true, value: null };

  // Reject any embedded control/space byte before scheme parsing.
  if (hasControlOrSpace(trimmed)) return { ok: false };

  // Relative in-app path: exactly one leading slash, and the second char must
  // not be "/" or "\" (which would make it protocol-relative or a backslash
  // bypass that resolves off-origin).
  if (trimmed.startsWith("/")) {
    if (trimmed.length === 1) return { ok: true, value: "/" };
    const second = trimmed[1];
    if (second === "/" || second === "\\") return { ok: false };
    return { ok: true, value: trimmed };
  }

  // Absolute URL: only https + same host as the configured app origin.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:") return { ok: false };
  const host = appOriginHost();
  if (!host || parsed.host.toLowerCase() !== host) return { ok: false };
  return { ok: true, value: parsed.toString() };
}

/** Convenience boolean guard for schema-level `.refine`. */
export function isValidNotificationHref(href: string | null | undefined): boolean {
  return sanitizeNotificationHref(href).ok;
}
