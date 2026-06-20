import { rateLimit } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { logger } from "@/lib/logger";

/**
 * Global daily spend circuit-breaker ("the fuse").
 *
 * The consumer app is free, so cost-bearing external calls (Anthropic AI,
 * dossier upstream lookups) have no per-purchase ceiling. Per-user caps + the
 * durable dossier cache keep normal usage cheap, but a traffic spike or abuse
 * could still run up an app-wide bill. This adds an APP-WIDE daily budget: each
 * cost-bearing attempt consumes one unit of the day's budget for its `kind`;
 * once the configured cap is exceeded the caller degrades to cached/rule-based
 * for the rest of the UTC day and a single ops alert is emitted.
 *
 * Opt-in by design: when the cap RuntimeConfig value is unset or <= 0 there is
 * NO cap (always allowed), so this can never throttle before a number is set.
 *
 * Reuses the shared rate limiter (Upstash, in-memory fallback) as a global
 * counter+gate keyed by kind + UTC day, so the budget holds across instances
 * and restarts.
 */

export type SpendKind = "ai" | "dossier";

const CONFIG_KEY: Record<SpendKind, string> = {
  ai: "AI_DAILY_GLOBAL_CAP",
  dossier: "DOSSIER_DAILY_GLOBAL_CAP",
};

function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function parseCap(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export interface GlobalBudgetResult {
  /** Caller may proceed with the cost-bearing call. */
  allowed: boolean;
  /** Configured cap, or null when no cap is set. */
  cap: number | null;
}

/**
 * Consume one unit of the global daily budget for `kind` and report whether the
 * caller is still under it. See module docs. Never throws (config/limiter
 * failures fail OPEN — a monitoring fuse must not take down the feature).
 */
export async function checkGlobalBudget(
  kind: SpendKind,
  opts: { now?: Date } = {},
): Promise<GlobalBudgetResult> {
  const now = opts.now ?? new Date();
  let cap: number | null = null;
  try {
    cap = parseCap(await getRuntimeConfigValue(CONFIG_KEY[kind]));
  } catch {
    return { allowed: true, cap: null };
  }
  if (cap == null) return { allowed: true, cap: null };

  const day = utcDayKey(now);
  try {
    const gate = await rateLimit(`global-spend:${kind}:${day}`, {
      limit: cap,
      windowSeconds: 24 * 60 * 60,
    });
    if (gate.success) return { allowed: true, cap };

    // Over budget → emit a single ops alert per day (dedup via a 1/day limiter).
    const alert = await rateLimit(`global-spend-alert:${kind}:${day}`, {
      limit: 1,
      windowSeconds: 24 * 60 * 60,
    });
    if (alert.success) {
      logger.warn("global_spend_cap_exceeded", { kind, cap, day });
    }
    return { allowed: false, cap };
  } catch {
    // Limiter unavailable → fail open (don't break the feature on a fuse error).
    return { allowed: true, cap };
  }
}
