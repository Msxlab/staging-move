"use client";

// CONSUMER_FREE / M2 guard: the entitlement layer uses
// `Number.MAX_SAFE_INTEGER` as the UNLIMITED sentinel for an unlimited cap.
// Rendering that raw would show "3 / 9007199254740991" to a full-access free
// user. Treat any limit at/above the sentinel (and any non-finite limit) as
// unlimited. This is value-based, so it holds with the CONSUMER_FREE flag both
// ON and OFF — a paid plan with finite limits is unaffected (byte-identical).
const UNLIMITED_SENTINEL = Number.MAX_SAFE_INTEGER;

export function isUnlimited(limit: number | null | undefined): boolean {
  if (limit == null) return false;
  if (!Number.isFinite(limit)) return true;
  return limit >= UNLIMITED_SENTINEL;
}

interface ServiceUsageIndicatorProps {
  current: number;
  limit: number;
  className?: string;
  /**
   * CONSUMER_FREE pivot: full-access free users have no meaningful "X / limit"
   * count to surface. Defaults to `false` so flag-OFF callers render exactly as
   * before. When `true`, the indicator is suppressed entirely.
   */
  consumerFree?: boolean;
}

export function ServiceUsageIndicator({
  current,
  limit,
  className = "",
  consumerFree = false,
}: ServiceUsageIndicatorProps) {
  if (!limit || limit <= 0) return null;
  // Suppress when free (nothing to upsell) or when the cap is the UNLIMITED
  // sentinel (never show "9007199254740991"). Flag OFF + finite limit → falls
  // through to the unchanged render.
  if (consumerFree || isUnlimited(limit)) return null;
  const ratio = Math.min(1, Math.max(0, current / limit));
  const isWarn = current >= limit - 2 && current < limit;
  const isFull = current >= limit;
  const tone = isFull
    ? "text-destructive border-destructive/30 bg-destructive/10"
    : isWarn
      ? "text-tone-honey-fg border-tone-honey-br bg-tone-honey-bg"
      : "text-muted-foreground border-border bg-foreground/5";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${tone} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">Services tracked: {current} / {limit}</span>
      <span aria-hidden="true" className="h-1 w-12 rounded-full bg-foreground/10 overflow-hidden">
        <span
          className={`block h-full ${isFull ? "bg-destructive" : isWarn ? "bg-tone-honey-fg" : "bg-tone-orange-fg"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}
