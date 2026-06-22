import Link from "next/link";

/**
 * Brand mark — shared raccoon asset used by launcher, favicon, PWA, and admin.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <img
      src="/logo-mark.svg"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    />
  );
}

/**
 * Full wordmark lockup — mark + "Locateflow" with italic foil "flow" segment.
 * Uses the canonical display CSS variable from the Move design system.
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
        className="text-[22px] leading-none text-foreground"
        style={{
          fontFamily: 'var(--font-display, "Playfair Display", Didot, Georgia, serif)',
          fontWeight: 900,
        }}
      >
        LocateFlow
      </span>
    </Link>
  );
}
