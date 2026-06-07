import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  /** Small uppercase mono kicker above the title (e.g. "Overview"). */
  eyebrow?: string;
  /**
   * Main page title. The string can contain a single `<em>...</em>` segment
   * which gets the brand foil gradient — useful for "Good morning, <em>Sarah</em>"
   * patterns. Pass plain text for a no-italic title.
   */
  title: string;
  /** Optional descriptive sentence under the title. */
  subtitle?: string;
  /** Action elements rendered to the right of the title block. */
  actions?: ReactNode;
}

/**
 * Champagne-and-rose admin page header. Pairs a Fraunces italic title with
 * a mono kicker eyebrow and an actions slot — applied across all top-level
 * admin pages so they share the same visual rhythm.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  // Split <em>...</em> so the foil-italic span can be rendered with the
  // exact gradient defined in globals.css. We keep this client-free —
  // it's a server-rendered component that accepts a tightly-controlled
  // string format.
  const emMatch = title.match(/^(.*?)<em>(.*?)<\/em>(.*)$/);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-foreground/55 mb-2">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="text-3xl md:text-4xl font-light tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display), Didot, Georgia, serif" }}
        >
          {emMatch ? (
            <>
              {emMatch[1]}
              <em className="foil-text not-italic-fallback">{emMatch[2]}</em>
              {emMatch[3]}
            </>
          ) : (
            title
          )}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
