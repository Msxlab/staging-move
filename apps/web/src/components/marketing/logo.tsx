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
        className="text-[22px] leading-none text-foreground"
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
