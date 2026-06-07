import * as React from "react";
import { cn } from "@/lib/utils";

type RaccoonLostProps = {
  /** Rendered width in px; height keeps the 124:134 aspect. Default 140. */
  size?: number;
  className?: string;
};

/**
 * "Lost raccoon" — a calm, slightly-bewildered web mascot for the 404 page.
 * Adapted from the mobile kawaii RaccoonMascot (apps/mobile/.../RaccoonMascot.tsx)
 * but rewritten as plain React/SVG with no react-native-svg dependency.
 *
 * Theming: the fur and mask read off the shadcn token ramp via `currentColor`
 * and `hsl(var(--…))`, so the illustration tracks the active theme in both
 * dark and light mode without a hard-coded palette. The component sets
 * `text-muted-foreground` on the root <svg>, and shapes that should be the
 * fur tone use `fill="currentColor"`. Darker accents (mask, ears, nose) layer
 * `hsl(var(--foreground))` at low alpha on top.
 *
 * Decorative only: `aria-hidden` + `role="presentation"`. The 404 heading and
 * copy carry the accessible meaning.
 */
export function RaccoonLost({ size = 140, className }: RaccoonLostProps) {
  const height = Math.round(size * (134 / 124));
  // Dark accent tone — the bandit mask / ear tips / nose. Foreground ink at a
  // restrained alpha keeps the raccoon soft (a calm grey, not a harsh black)
  // and legible on both the navy and the paper canvas.
  const DARK = "hsl(var(--foreground) / 0.55)";
  // Eye whites + muzzle blaze: lift off the card surface so they read as light
  // in dark mode and as a clean off-white on paper.
  const LIGHT = "hsl(var(--background))";
  const PUPIL = "hsl(var(--foreground))";

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 124 134"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      // `currentColor` resolves to the muted foreground — a gentle grey fur in
      // both themes. Override by passing a `text-*` class.
      className={cn("text-muted-foreground", className)}
    >
      {/* fluffy ringed tail — fur / dark alternating rings */}
      <ellipse cx="96" cy="112" rx="21" ry="18" fill="currentColor" />
      <ellipse cx="108" cy="92" rx="18.5" ry="15.5" fill={DARK} />
      <ellipse cx="113" cy="71" rx="16" ry="14" fill="currentColor" />
      <ellipse cx="113" cy="53" rx="13.5" ry="12.5" fill={DARK} />
      <ellipse cx="109" cy="38" rx="11.5" ry="11" fill="currentColor" />
      <ellipse cx="102" cy="27" rx="9" ry="9" fill={DARK} />

      {/* feet */}
      <ellipse cx="46" cy="128" rx="11" ry="6.5" fill={DARK} />
      <ellipse cx="78" cy="128" rx="11" ry="6.5" fill={DARK} />

      {/* round body + soft belly */}
      <ellipse cx="62" cy="106" rx="27" ry="23" fill="currentColor" />
      <ellipse cx="62" cy="110" rx="16" ry="16" fill={LIGHT} opacity={0.55} />

      {/* little hands */}
      <ellipse cx="36" cy="102" rx="7.5" ry="9" fill="currentColor" />
      <ellipse cx="88" cy="100" rx="7.5" ry="9" fill="currentColor" />

      {/* soft rounded ears w/ dark tips */}
      <path d="M40 26 Q26 0 50 16 Q46 23 40 26 Z" fill="currentColor" />
      <path d="M84 26 Q98 0 74 16 Q78 23 84 26 Z" fill="currentColor" />
      <path d="M41 21 Q33 7 47 15 Q44 19 41 21 Z" fill={DARK} />
      <path d="M83 21 Q91 7 77 15 Q80 19 83 21 Z" fill={DARK} />

      {/* BIG round head */}
      <ellipse cx="62" cy="58" rx="41" ry="38" fill="currentColor" />

      {/* big soft dark eye-patches (the bandit mask) */}
      <ellipse cx="45" cy="55" rx="16" ry="17.5" fill={DARK} />
      <ellipse cx="79" cy="55" rx="16" ry="17.5" fill={DARK} />

      {/* white blaze + muzzle */}
      <path d="M62 30 Q55 48 62 62 Q69 48 62 30 Z" fill={LIGHT} opacity={0.7} />
      <ellipse cx="62" cy="76" rx="19" ry="16" fill={LIGHT} opacity={0.7} />

      {/* big eyes — gaze cast slightly down/aside: a little lost, not alarmed */}
      <circle cx="45" cy="55" r="12" fill={LIGHT} />
      <circle cx="79" cy="55" r="12" fill={LIGHT} />
      <circle cx="44" cy="58" r="7" fill={PUPIL} />
      <circle cx="78" cy="58" r="7" fill={PUPIL} />
      {/* catchlights keep the eyes alive and friendly */}
      <circle cx="47" cy="54.5" r="2.6" fill={LIGHT} />
      <circle cx="81" cy="54.5" r="2.6" fill={LIGHT} />

      {/* gently raised inner brows — the "where am I?" tell */}
      <path
        d="M35 44 Q44 41 52 45"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M72 45 Q80 41 89 44"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* tiny nose + small unsure mouth (soft wavy line, not a frown) */}
      <path
        d="M62 68 q-4.5 0 -4.5 3.8 q0 3.8 4.5 4.4 q4.5 -0.6 4.5 -4.4 q0 -3.8 -4.5 -3.8 z"
        fill={DARK}
      />
      <path
        d="M55 81 q3.5 -3 7 0 q3.5 3 7 0"
        stroke={DARK}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default RaccoonLost;
