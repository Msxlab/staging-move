import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  /** Small uppercase mono kicker above the title (e.g. "Overview"). */
  eyebrow?: string;
  /**
   * Main page title. The string can contain a single `<em>...</em>` segment
   * which gets the brand foil gradient, useful for "Good morning, <em>Sarah</em>"
   * patterns. Pass plain text for a no-italic title.
   */
  title: string;
  /** Optional descriptive sentence under the title. */
  subtitle?: string;
  /** Action elements rendered to the right of the title block. */
  actions?: ReactNode;
}

/**
 * Corporate admin page header (Faz 3). Pairs a sans headline with the same
 * `--font-sans` / 600-weight typography as the topbar breadcrumb and a
 * mono kicker eyebrow and an actions slot, applied across all top-level
 * admin pages so they share the same visual rhythm. The `<em>` segment
 * keeps the brand foil gradient but renders upright (no serif italics in
 * the corporate direction).
 */
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  // Split <em>...</em> so the foil-italic span can be rendered with the
  // exact gradient defined in globals.css. We keep this client-free;
  // it's a server-rendered component that accepts a tightly-controlled
  // string format.
  const emMatch = title.match(/^(.*?)<em>(.*?)<\/em>(.*)$/);

  return (
    <div className="mb-6 rounded-[1.4rem] border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-mono font-semibold uppercase text-foreground/55">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="text-3xl md:text-4xl font-semibold text-foreground"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {emMatch ? (
            <>
              {emMatch[1]}
              {/* Foil gradient stays (brand accent); inline style overrides
                  .foil-text's italic/400 so the headline reads as one
                  upright corporate sans run. */}
              <em
                className="foil-text"
                style={{ fontStyle: "normal", fontWeight: "inherit" }}
              >
                {emMatch[2]}
              </em>
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
    </div>
  );
}
