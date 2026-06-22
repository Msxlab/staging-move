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
 * LocateFlow Admin page header / top bar. Mirrors the design's MAIN header: a
 * Playfair Display (`font-display`) title, a small faint meta line under
 * it, and a right-aligned actions cluster, sitting on a translucent
 * sticky-feeling bar that reads like the operations console top bar. The
 * optional mono eyebrow is preserved as an uppercase kicker above the
   * title. The `<em>` segment keeps the brand foil gradient (the design's
   * Sapphire maps to the brand accent) and renders upright. This stays a
 * server-rendered, client-free component.
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
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 px-6 py-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="font-display text-2xl font-extrabold leading-none tracking-tight text-foreground md:text-[28px]"
        >
          {emMatch ? (
            <>
              {emMatch[1]}
              {/* Foil gradient stays (brand accent); inline style overrides
                  .foil-text's italic/400 so the Playfair headline reads as
                  one upright display run. */}
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
          <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
