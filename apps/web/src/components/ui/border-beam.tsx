import type { CSSProperties } from "react";

/**
 * BORDER BEAM — a premium animated accent that traces a soft light around a
 * container's border (Magic-UI-style "border beam", re-implemented in-house).
 *
 * Implemented as PURE CSS (a rotating conic-gradient masked to the border
 * frame, spun by the hand-written `lf-border-beam-spin` keyframe in
 * globals.css). Deliberately NOT motion/framer-motion: (a) a plain CSS
 * keyframe always runs on Tailwind v3, unlike v4-style keyframe utilities that
 * silently no-op here, and (b) it renders cleanly under SSR/test without the
 * dual-React hook pitfall. Purely decorative + `aria-hidden`; the spin is
 * disabled under prefers-reduced-motion via the same stylesheet.
 *
 * Sapphire-themed by default via the `--primary` design token (no hardcoded
 * brand colour); pass `color` to override. Drop it as the LAST child of a
 * `position: relative; overflow: hidden` container and mirror that container's
 * corner radius via `radius`.
 */
export function BorderBeam({
  radius = 16,
  duration = 8,
  thickness = 1.5,
  color = "var(--primary)",
  opacity = 0.7,
  className,
}: {
  /** Match the host container's border-radius (px). */
  radius?: number;
  /** Seconds for one full lap. */
  duration?: number;
  /** Border thickness the beam rides on (px). */
  thickness?: number;
  /** Beam colour — defaults to the sapphire `--primary` token. */
  color?: string;
  /** Beam opacity (0–1). */
  opacity?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={["lf-border-beam", className].filter(Boolean).join(" ")}
      style={
        {
          borderRadius: radius,
          padding: thickness,
          "--lf-beam-duration": `${duration}s`,
          // Mask so only the `padding` frame (i.e. the border) reveals the
          // beam; the interior is cut out, leaving card content untouched.
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
        } as CSSProperties
      }
    >
      <span
        className="lf-border-beam__spin"
        style={{
          opacity,
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 300deg, ${color} 345deg, transparent 360deg)`,
        }}
      />
    </span>
  );
}
