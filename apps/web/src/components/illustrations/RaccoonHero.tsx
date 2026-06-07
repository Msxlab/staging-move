import * as React from "react";
import { cn } from "@/lib/utils";

type RaccoonHeroProps = {
  /** Rendered width in px; height keeps the 168:150 aspect. Default 168. */
  size?: number;
  className?: string;
};

/**
 * "Mover raccoon" — a cheerful little mascot hugging a moving box, for the
 * marketing homepage hero. It reuses the bandit-mask + sparkly-eye geometry of
 * {@link RaccoonLost} and {@link RaccoonReading} so all three illustrations
 * read as the same character across the site (404, blog, empty states, home).
 *
 * Theming: written entirely against the shadcn token ramp. The fur tone is
 * `currentColor` (the root <svg> defaults it to `text-muted-foreground`), the
 * mask/ears/nose layer `hsl(var(--foreground))` at a restrained alpha, and the
 * moving box picks up the brand `hsl(var(--primary))`. This tracks both dark
 * and light themes — and the per-plan `--primary` overrides — with no
 * hard-coded palette. Override the fur by passing a `text-*` class.
 *
 * Decorative only: `aria-hidden` + `role="presentation"`. The hero headline
 * and copy carry the accessible meaning.
 */
export function RaccoonHero({ size = 168, className }: RaccoonHeroProps) {
  const height = Math.round(size * (150 / 168));
  // Dark accent — bandit mask / ear tips / nose. Foreground ink at a low alpha
  // keeps the raccoon soft (a calm grey, not a harsh black) and legible on both
  // the navy and the paper canvas.
  const DARK = "hsl(var(--foreground) / 0.55)";
  // Eye whites + muzzle + box tape: lift off the surface so they read light in
  // dark mode and clean off-white on paper.
  const LIGHT = "hsl(var(--background))";
  const PUPIL = "hsl(var(--foreground))";
  // Brand tones for the moving box — primary front + a softer wash for the lid,
  // so the carton reads as two faces without a hard-coded palette.
  const BOX = "hsl(var(--primary))";
  const BOX_SOFT = "hsl(var(--primary) / 0.7)";
  const BOX_LID = "hsl(var(--primary) / 0.85)";

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 168 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      className={cn("text-muted-foreground", className)}
    >
      {/* fluffy ringed tail, curling up behind the right shoulder */}
      <ellipse cx="131" cy="92" rx="16" ry="14" fill="currentColor" />
      <ellipse cx="140" cy="77" rx="13.5" ry="11.5" fill={DARK} />
      <ellipse cx="143" cy="63" rx="11.5" ry="10.5" fill="currentColor" />
      <ellipse cx="140" cy="51" rx="9.5" ry="9" fill={DARK} />
      <ellipse cx="134" cy="43" rx="7.5" ry="7.5" fill="currentColor" />

      {/* soft rounded ears w/ dark tips */}
      <path d="M58 34 Q44 8 68 24 Q64 31 58 34 Z" fill="currentColor" />
      <path d="M102 34 Q116 8 92 24 Q96 31 102 34 Z" fill="currentColor" />
      <path d="M59 29 Q51 15 65 23 Q62 27 59 29 Z" fill={DARK} />
      <path d="M101 29 Q109 15 95 23 Q98 27 101 29 Z" fill={DARK} />

      {/* BIG round head */}
      <ellipse cx="80" cy="60" rx="40" ry="37" fill="currentColor" />

      {/* big soft dark eye-patches (the bandit mask) */}
      <ellipse cx="64" cy="58" rx="15.5" ry="17" fill={DARK} />
      <ellipse cx="96" cy="58" rx="15.5" ry="17" fill={DARK} />

      {/* white blaze + muzzle */}
      <path d="M80 32 Q73 50 80 64 Q87 50 80 32 Z" fill={LIGHT} opacity={0.7} />
      <ellipse cx="80" cy="76" rx="18" ry="15" fill={LIGHT} opacity={0.7} />

      {/* big bright eyes, gaze up-and-out: cheerful, ready to help */}
      <circle cx="64" cy="58" r="11.5" fill={LIGHT} />
      <circle cx="96" cy="58" r="11.5" fill={LIGHT} />
      <circle cx="65" cy="56" r="6.6" fill={PUPIL} />
      <circle cx="97" cy="56" r="6.6" fill={PUPIL} />
      {/* catchlights keep the eyes alive and friendly */}
      <circle cx="67.5" cy="53" r="2.6" fill={LIGHT} />
      <circle cx="99.5" cy="53" r="2.6" fill={LIGHT} />

      {/* gently lifted brows — bright, welcoming */}
      <path
        d="M54 45 Q63 41 72 45"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M88 45 Q97 41 106 45"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* tiny nose + a small happy open smile */}
      <path
        d="M80 68 q-4 0 -4 3.4 q0 3.4 4 3.9 q4 -0.5 4 -3.9 q0 -3.4 -4 -3.4 z"
        fill={DARK}
      />
      <path
        d="M73 79 q7 7 14 0"
        stroke={DARK}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* moving box, hugged just in front — brand-toned carton with light tape */}
      {/* lid flaps angled open at the top */}
      <path d="M58 104 L80 100 L80 110 L56 113 Z" fill={BOX_LID} />
      <path d="M102 104 L80 100 L80 110 L104 113 Z" fill={BOX_SOFT} />
      {/* box front face */}
      <path d="M56 113 L80 110 L80 146 L54 142 Z" fill={BOX} />
      {/* box side face (a touch darker for depth) */}
      <path d="M104 113 L80 110 L80 146 L106 142 Z" fill={BOX_SOFT} />
      {/* packing tape — vertical seam + a strip across the lid */}
      <path d="M80 100 L80 146" stroke={LIGHT} strokeWidth="3" strokeLinecap="round" opacity={0.85} />
      <path d="M58 108 L80 105 L102 108" stroke={LIGHT} strokeWidth="2.4" fill="none" opacity={0.75} />
      {/* little paws hugging the carton */}
      <ellipse cx="55" cy="118" rx="7" ry="8" fill="currentColor" />
      <ellipse cx="105" cy="118" rx="7" ry="8" fill="currentColor" />
    </svg>
  );
}

export default RaccoonHero;
