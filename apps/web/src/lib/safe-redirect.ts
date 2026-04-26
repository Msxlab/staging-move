const ALLOWED_APP_REDIRECT_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/addresses",
  "/services",
  "/providers",
  "/moving",
  "/budget",
  "/settings",
  "/support",
] as const;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function normalizeAppRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value) return fallback;

  let path = value.trim();
  if (!path || CONTROL_CHARS.test(path)) return fallback;

  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }

  if (path.startsWith("/api") || path.startsWith("/auth")) {
    return fallback;
  }

  const allowed = ALLOWED_APP_REDIRECT_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`) ||
      path.startsWith(`${prefix}#`),
  );

  return allowed ? path : fallback;
}
