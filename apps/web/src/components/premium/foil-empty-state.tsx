import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

interface FoilEmptyStateProps {
  /** Eyebrow caption above the title — uppercase mono. */
  eyebrow?: string;
  title: string;
  body?: string;
  /** Primary action — render a `<Link>` or `<Button>` here. */
  action?: ReactNode;
  /** Secondary action, optional. */
  secondaryAction?: ReactNode;
  /** Override the default Lucide icon shown above the title. */
  icon?: ReactNode;
}

/**
 * Aurora cool/violet foil empty state. Used when a list/grid has no items yet —
 * pairs a tonal foil illustration with one short sentence and one CTA.
 *
 * The "foil" effect comes from a soft radial glow behind a thin double ring;
 * we deliberately avoid stock illustration to stay on-brand.
 */
export function FoilEmptyState({
  eyebrow,
  title,
  body,
  action,
  secondaryAction,
  icon,
}: FoilEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="relative mb-6">
        {/* foil glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(180,155,255,0.22) 0%, rgba(180,155,255,0) 70%)",
            transform: "scale(2.4)",
          }}
        />
        {/* outer thin ring */}
        <div
          aria-hidden="true"
          className="absolute inset-[-12px] rounded-full"
          style={{ border: "1px solid rgba(180,155,255,0.22)" }}
        />
        {/* inner foil disc */}
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(221,231,245,0.18) 0%, rgba(180,155,255,0.10) 50%, rgba(127,182,232,0.16) 100%)",
            border: "1px solid rgba(127,182,232,0.30)",
          }}
        >
          {icon ?? (
            <Sparkles
              className="h-7 w-7 text-tone-orange-fg"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>

      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {eyebrow}
        </p>
      ) : null}
      <h3
        className="text-2xl md:text-3xl font-light tracking-tight mb-2 max-w-md"
        style={{ fontFamily: "var(--font-display, Fraunces, Georgia, serif)" }}
      >
        {title}
      </h3>
      {body ? (
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          {body}
        </p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
