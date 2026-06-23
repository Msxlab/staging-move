import Link from "next/link";
import { RaccoonMark } from "@/components/brand/RaccoonMark";

/**
 * Brand mark — the parametric RaccoonMark (D4) inside a dark brand tile.
 *
 * Replaces the former static `/logo-mark.svg` raster: the eye now tracks the
 * live theme accent (Gold in dark, Sapphire in light — D5), and the mark shares
 * a single source of truth with the OG card / wordmark. The tile is kept a fixed
 * brand navy in BOTH themes (the design's logo lockup is dark-on-navy), so the
 * mark reads consistently and the accent eye pops in light mode too.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const pad = Math.round(size * 0.15);
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-lg, 15px)",
        background: "#0A0F1C",
      }}
      aria-hidden="true"
    >
      <RaccoonMark size={size - pad * 2} />
    </span>
  );
}

/**
 * Full wordmark lockup for LocateFlow.
 * Uses the canonical display CSS variable from the LocateFlow design system.
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
