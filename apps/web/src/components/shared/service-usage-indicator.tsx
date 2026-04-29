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
    ? "text-red-300 border-red-500/30 bg-red-500/10"
    : isWarn
      ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
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
          className={`block h-full ${isFull ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-orange-500"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}
