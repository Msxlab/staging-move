import { Apple, Smartphone } from "lucide-react";

/**
 * Mobile app install CTA. The apps aren't on the App Store or Google Play
 * yet, so both buttons render as locked "Coming soon" chips pointing at
 * the contact page so interested users can get notified.
 *
 * When the app ships, replace `href="/contact"` with the real store URLs
 * and drop the `Coming soon` label.
 */
export function AppStoreCTA({ compact = false }: { compact?: boolean }) {
  const base =
    "group inline-flex items-center gap-3 rounded-xl border bg-card text-left transition-all";
  const size = compact ? "px-4 py-2.5" : "px-5 py-3";

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="/contact"
        className={`${base} ${size} hover:shadow-md hover:border-primary/40`}
      >
        <Apple className="h-7 w-7" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Coming soon on
          </p>
          <p className="text-sm font-semibold">App Store</p>
        </div>
      </a>
      <a
        href="/contact"
        className={`${base} ${size} hover:shadow-md hover:border-primary/40`}
      >
        <Smartphone className="h-7 w-7" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Coming soon on
          </p>
          <p className="text-sm font-semibold">Google Play</p>
        </div>
      </a>
    </div>
  );
}
