import { IOS_APP_STORE_URL, ANDROID_PLAY_STORE_URL } from "@/lib/store-links";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.564 12.793c-.027-2.685 2.193-3.974 2.292-4.038-1.249-1.825-3.193-2.075-3.886-2.105-1.654-.167-3.227.974-4.069.974-.84 0-2.135-.951-3.512-.925-1.808.026-3.476 1.052-4.405 2.671-1.879 3.258-.481 8.077 1.353 10.715.896 1.292 1.967 2.745 3.371 2.692 1.353-.054 1.864-.876 3.501-.876 1.638 0 2.097.876 3.527.847 1.456-.026 2.379-1.318 3.27-2.617 1.029-1.502 1.452-2.957 1.478-3.034-.032-.014-2.836-1.088-2.866-4.304zM14.882 4.876c.747-.91 1.252-2.169 1.114-3.426-1.077.045-2.388.722-3.162 1.626-.692.799-1.302 2.085-1.139 3.314 1.205.094 2.434-.611 3.187-1.514z" />
    </svg>
  );
}

function GooglePlayLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gp-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00d4ff" />
          <stop offset="1" stopColor="#00a3ff" />
        </linearGradient>
        <linearGradient id="gp-grad-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd400" />
          <stop offset="1" stopColor="#ff9c00" />
        </linearGradient>
        <linearGradient id="gp-grad-3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3a3a" />
          <stop offset="1" stopColor="#c20034" />
        </linearGradient>
        <linearGradient id="gp-grad-4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f076" />
          <stop offset="1" stopColor="#009245" />
        </linearGradient>
      </defs>
      <path d="M3.6 1.7c-.3.3-.5.7-.5 1.2v18.2c0 .5.2.9.5 1.2l9.4-9.4-9.4-11.2z" fill="url(#gp-grad-1)" />
      <path d="M16.6 16.4l-3.6-4 3.6-3.7 4.6 2.6c1.1.6 1.1 2.2 0 2.8l-4.6 2.3z" fill="url(#gp-grad-2)" />
      <path d="M3.6 22.3c.4.4 1 .5 1.6.1l11.4-6 -3.6-4 -9.4 9.9z" fill="url(#gp-grad-3)" />
      <path d="M3.6 1.7l9.4 11.2 3.6-3.7-11.4-6c-.6-.3-1.2-.2-1.6.5z" fill="url(#gp-grad-4)" />
    </svg>
  );
}

/**
 * Mobile app install CTA. Move is live on both stores — these deep-link
 * straight to the App Store / Google Play listings. (Store URLs are centralized
 * in lib/store-links so the marketing CTA, the install banner, and structured
 * data all agree.)
 */
export function AppStoreCTA({ compact = false }: { compact?: boolean }) {
  const base =
    "group inline-flex min-w-[15rem] items-center gap-3 rounded-xl border border-border bg-foreground text-background text-left shadow-sm transition-all hover:opacity-90 hover:scale-[1.02] dark:bg-foreground/95";
  const size = compact ? "px-4 py-2" : "px-5 py-3";

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={IOS_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Move on the App Store"
        className={`${base} ${size}`}
      >
        <AppleLogo className="h-8 w-8" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wider opacity-70">
            Download on the
          </p>
          <p className="text-lg font-semibold tracking-tight">App Store</p>
        </div>
      </a>
      <a
        href={ANDROID_PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get Move on Google Play"
        className={`${base} ${size}`}
      >
        <GooglePlayLogo className="h-8 w-8" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wider opacity-70">
            Get it on
          </p>
          <p className="text-lg font-semibold tracking-tight">Google Play</p>
        </div>
      </a>
    </div>
  );
}
