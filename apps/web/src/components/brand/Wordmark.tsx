import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RaccoonMark, type RaccoonMarkMood } from "./RaccoonMark";

/**
 * Brand lockup for LocateFlow — the RaccoonMark tile + the "LocateFlow"
 * wordmark set in Playfair Display 900 (D4).
 *
 * The name stays **"LocateFlow"** (never "Move"). The display font resolves
 * through the canonical `--font-display` variable (Playfair Display), with a
 * Didot/Georgia serif fallback so the lockup degrades gracefully before the
 * web font loads.
 *
 * This is a freshly-built foundation component. Existing logo/wordmark usages
 * across pages are intentionally NOT swapped here — that rollout is a later
 * phase. Use this in new surfaces and as the canonical reference.
 */

export type LogoProps = {
  /** Size (px) of the RaccoonMark tile. */
  markSize?: number;
  /** Font size (px) of the wordmark. Defaults proportionally to `markSize`. */
  textSize?: number;
  /** Mood/expression for the mark. */
  mood?: RaccoonMarkMood;
  /** Render the mark only (no wordmark text). */
  markOnly?: boolean;
  /** Wrap the lockup in a tile (rounded square behind the mark). */
  tile?: boolean;
  className?: string;
};

/**
 * The mark inside a rounded brand tile — the form used for app launchers,
 * avatars, and the OG card.
 */
export function LogoTile({
  markSize = 40,
  mood = "calm",
  className,
}: {
  markSize?: number;
  mood?: RaccoonMarkMood;
  className?: string;
}) {
  const pad = Math.round(markSize * 0.18);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-card border border-border",
        className,
      )}
      style={{
        width: markSize + pad * 2,
        height: markSize + pad * 2,
        borderRadius: "var(--radius-lg, 18px)",
      }}
    >
      <RaccoonMark size={markSize} mood={mood} />
    </span>
  );
}

/**
 * The full LocateFlow lockup: RaccoonMark tile + "LocateFlow" in Playfair 900.
 */
export function Logo({
  markSize = 36,
  textSize,
  mood = "calm",
  markOnly = false,
  tile = true,
  className,
}: LogoProps) {
  const fontSize = textSize ?? Math.round(markSize * 0.62);
  return (
    <span className={cn("inline-flex items-center gap-2.5 shrink-0", className)}>
      {tile ? (
        <LogoTile markSize={markSize} mood={mood} />
      ) : (
        <RaccoonMark size={markSize} mood={mood} />
      )}
      {markOnly ? null : (
        <span
          className="leading-none text-foreground"
          style={{
            fontFamily: 'var(--font-display, "Playfair Display", Didot, Georgia, serif)',
            fontWeight: 900,
            fontSize,
            letterSpacing: 0,
          }}
        >
          LocateFlow
        </span>
      )}
    </span>
  );
}

/**
 * Linked wordmark for headers/nav. Wraps {@link Logo} in a `next/link`.
 */
export function Wordmark({
  href = "/",
  markSize = 34,
  textSize,
  mood = "calm",
  tile = true,
  className,
}: LogoProps & { href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center", className)} aria-label="LocateFlow">
      <Logo markSize={markSize} textSize={textSize} mood={mood} tile={tile} />
    </Link>
  );
}

export default Wordmark;
