export type HealthTone = "sage" | "honey" | "rose";

interface HealthPillProps {
  tone: HealthTone;
  /** Short label, e.g. "Healthy", "Idle 18d", "At risk". */
  label: string;
  /** Tooltip detail — shown on hover. */
  title?: string;
}

/**
 * A 3-state user health indicator: sage = healthy, honey = idle, rose = at
 * risk (the rose dot pulses to draw attention). Pairs a Lucide-free dot
 * with a label so the meaning survives a "no color" reading (WCAG 1.4.1).
 */
export function HealthPill({ tone, label, title }: HealthPillProps) {
  return (
    <span
      className={`health-pill tone-${tone}`}
      title={title}
      aria-label={title ?? label}
    >
      <span className="health-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
