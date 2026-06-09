import { getRuntimeConfigValue } from "@/lib/runtime-config";

/**
 * Operator-tunable controls for the admin daily digest, backed by runtime config
 * (env OR the RuntimeConfigEntry table) so they can be flipped WITHOUT a deploy
 * and WITHOUT a schema migration — the same mechanism the cron already uses for
 * the recipient address. Mirrors the pattern in daily-digest-config.ts.
 *
 *   ADMIN_DIGEST_ENABLED          "false" disables the digest entirely (default ON
 *                                 so current behavior is unchanged).
 *   ADMIN_DIGEST_SKIP_IF_EMPTY    "true" suppresses an all-zero digest (nothing
 *                                 happened in the window) so quiet days don't ping.
 *   ADMIN_DIGEST_MIN_CHURN_ALERT  churn % above which the anomaly alert fires
 *                                 immediately (default 5).
 *   ADMIN_DIGEST_EXCLUDE_EMAILS   comma-separated emails to omit from the
 *                                 per-admin recipient fan-out (no-migration opt-out).
 */
export interface AdminDigestConfig {
  enabled: boolean;
  skipIfEmpty: boolean;
  minChurnAlertPct: number;
  excludeEmails: string[];
}

export async function getAdminDigestConfig(): Promise<AdminDigestConfig> {
  const read = (key: string) => getRuntimeConfigValue(key).catch(() => null);
  const [enabledRaw, skipRaw, churnRaw, excludeRaw] = await Promise.all([
    read("ADMIN_DIGEST_ENABLED"),
    read("ADMIN_DIGEST_SKIP_IF_EMPTY"),
    read("ADMIN_DIGEST_MIN_CHURN_ALERT"),
    read("ADMIN_DIGEST_EXCLUDE_EMAILS"),
  ]);
  const churn = Number.parseFloat((churnRaw || "").trim());
  return {
    enabled: (enabledRaw || "").trim().toLowerCase() !== "false",
    skipIfEmpty: (skipRaw || "").trim().toLowerCase() === "true",
    minChurnAlertPct: Number.isFinite(churn) && churn > 0 ? churn : 5,
    excludeEmails: (excludeRaw || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}
