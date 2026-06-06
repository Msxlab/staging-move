/**
 * Shared admin URL guard. Affiliate links and any other external URL that
 * becomes a user-facing action must be https — a single source of truth so the
 * provider create / edit / bulk paths can't drift apart on what they accept.
 */
export function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
