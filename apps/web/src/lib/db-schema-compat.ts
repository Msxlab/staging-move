type PrismaLikeError = {
  code?: string;
  message?: string;
  meta?: {
    column?: string;
    field_name?: string;
    target?: unknown;
  };
};

const warnedScopes = new Set<string>();

export function isMissingDbColumnError(error: unknown, column?: string): boolean {
  const err = error as PrismaLikeError;
  const message = String(err?.message || "");
  const metaColumn = String(err?.meta?.column || err?.meta?.field_name || "");
  const target = Array.isArray(err?.meta?.target)
    ? err.meta.target.join(" ")
    : String(err?.meta?.target || "");
  const haystack = `${message} ${metaColumn} ${target}`.toLowerCase();
  const missingColumn =
    err?.code === "P2022" ||
    haystack.includes("does not exist in the current database") ||
    haystack.includes("unknown column") ||
    haystack.includes("doesn't exist");

  if (!missingColumn) return false;
  return column ? haystack.includes(column.toLowerCase()) : true;
}

export function warnSchemaCompatibilityFallback(scope: string, error: unknown) {
  if (warnedScopes.has(scope)) return;
  warnedScopes.add(scope);
  const err = error as PrismaLikeError;
  console.warn("[schema-compat] using fallback", {
    scope,
    code: err?.code || null,
    column: err?.meta?.column || err?.meta?.field_name || null,
    message: err?.message || String(error),
  });
}
