import type { ReactNode } from "react";

interface AdminPanelProps {
  /** Title shown in the panel head; rendered in foreground weight. */
  title?: string;
  /** Small caption below the title. */
  caption?: string;
  /** Right-aligned slot in the panel head — segmented control, link, etc. */
  actions?: ReactNode;
  /** Use the slim variant — less vertical padding for dense lists. */
  dense?: boolean;
  /** Apply foil hairline ring + soft top glow (used for flagship panels). */
  flagship?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Champagne-and-rose section wrapper used across admin pages. Pairs a head
 * row with a body. Apply `flagship` for the section that should pull the
 * eye first on a given page (revenue trend, premium upgrades, etc.).
 *
 * The visual treatment lives in admin globals.css — `.admin-panel` and
 * `.admin-panel-head` selectors so we can iterate without touching every
 * call site.
 */
export function AdminPanel({
  title,
  caption,
  actions,
  dense,
  flagship,
  className,
  children,
}: AdminPanelProps) {
  return (
    <section
      className={`admin-panel ${flagship ? "admin-panel-flagship" : ""} ${className ?? ""}`}
    >
      {(title || actions) && (
        <header className="admin-panel-head">
          {title ? (
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {title}
              </h3>
              {caption ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      )}
      <div className={dense ? "px-5 py-3" : "p-5"}>{children}</div>
    </section>
  );
}
