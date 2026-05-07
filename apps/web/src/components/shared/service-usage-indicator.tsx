"use client";

interface ServiceUsageIndicatorProps {
  current: number;
  limit: number;
  className?: string;
}

export function ServiceUsageIndicator({
  current,
  limit,
  className = "",
}: ServiceUsageIndicatorProps) {
  if (!limit || limit <= 0) return null;
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
