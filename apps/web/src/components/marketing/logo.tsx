import Link from "next/link";

/**
 * Brand mark — Edition VII Aurora palette, matches /public/logo-mark.svg from
 * the design system. Pass `animated` to get ripple/float/sweep motion;
 * static version is used in dense UI (table headers, compact menus).
 */
export function LogoMark({
  size = 32,
  animated = false,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const gid = animated ? "mk-anim" : "mk-static";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`${gid}-foil`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#5C9DDC" />
          <stop offset="45%" stopColor="#7FB6E8" />
          <stop offset="100%" stopColor="#DDE7F5" />
        </linearGradient>
        <linearGradient id={`${gid}-rose`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A5C9F0" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>

      {animated ? (
        <>
          <circle
            cx="80"
            cy="40"
            r="10"
            fill="none"
            stroke={`url(#${gid}-rose)`}
            strokeWidth="1.5"
            className="lf-ripple lf-ripple-1"
          />
          <circle
            cx="80"
            cy="40"
            r="10"
            fill="none"
            stroke={`url(#${gid}-rose)`}
            strokeWidth="1.5"
            opacity="0.7"
            className="lf-ripple lf-ripple-2"
          />
        </>
      ) : null}

      <path
        d="M20 65 Q 30 32, 50 48 T 80 40"
        stroke={`url(#${gid}-foil)`}
        strokeWidth="3.25"
        fill="none"
        strokeLinecap="round"
        className={animated ? "lf-sweep" : ""}
      />

      <circle cx="20" cy="65" r="4.5" fill={`url(#${gid}-foil)`} />
      <circle cx="20" cy="65" r="1.5" fill="#0A0F18" />

      <g className={animated ? "lf-pin-float" : ""}>
        <circle cx="80" cy="40" r="7.25" fill={`url(#${gid}-rose)`} />
        <circle
          cx="80"
          cy="40"
          r="2.5"
          fill="#ECF1F8"
          className={animated ? "lf-pin-dot" : ""}
        />
      </g>
    </svg>
  );
}

/**
 * Full wordmark lockup — mark + "Locateflow" with italic foil "flow" segment.
 * Uses Fraunces variable font (loaded globally via --fraunces CSS var) to
 * match the editorial display in the design system.
 */
export function Wordmark({
  href = "/",
  animated = true,
  markSize = 34,
}: {
  href?: string;
  animated?: boolean;
  markSize?: number;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 shrink-0 group">
      <LogoMark size={markSize} animated={animated} />
      <span
        className="text-[22px] leading-none tracking-[-0.025em] text-foreground"
        style={{
          fontFamily: "var(--fraunces), Didot, Georgia, serif",
          fontVariationSettings: "'opsz' 96, 'SOFT' 40",
          fontWeight: 400,
        }}
      >
        Locate
        <span
          className="italic bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #DDE7F5 0%, #7FB6E8 50%, #5C9DDC 100%)",
          }}
        >
          flow
        </span>
      </span>
    </Link>
  );
}
