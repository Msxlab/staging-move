import * as React from "react";
import { cn } from "@/lib/utils";

type RaccoonReadingProps = {
  /** Rendered width in px; height keeps the 168:120 aspect. Default 168. */
  size?: number;
  className?: string;
};

/**
 * "Reading raccoon" — a calm web mascot peeking over an open field guide.
 * The blog's voice is "The Field Guide," so the mascot holds a little book;
 * it reuses the bandit-mask + sparkly-eye geometry of {@link RaccoonLost} so
 * the two illustrations read as the same character across the site.
 *
 * Theming: written entirely against the shadcn token ramp. The fur tone is
 * `currentColor` (the root <svg> defaults it to `text-muted-foreground`), the
 * mask/ears/nose layer `hsl(var(--foreground))` at a restrained alpha, and the
 * book cover picks up the brand `hsl(var(--primary))`. This tracks both dark
 * and light themes — and the per-plan `--primary` overrides — with no
 * hard-coded palette. Override the fur by passing a `text-*` class.
 *
 * Decorative only: `aria-hidden` + `role="presentation"`. Any heading or copy
 * placed alongside it carries the accessible meaning.
 */
export function RaccoonReading({ size = 168, className }: RaccoonReadingProps) {
  const height = Math.round(size * (120 / 168));
  // Dark accent — bandit mask / ear tips / nose. Foreground ink at a low alpha
  // keeps the raccoon soft (a calm grey, not a harsh black) and legible on both
  // the navy and the paper canvas.
  const DARK = "hsl(var(--foreground) / 0.55)";
  // Eye whites + muzzle + page: lift off the surface so they read light in dark
  // mode and clean off-white on paper.
  const LIGHT = "hsl(var(--background))";
  const PUPIL = "hsl(var(--foreground))";
  // Brand tones for the open book — primary + a softer wash for the spine.
  const BOOK = "hsl(var(--primary))";
  const BOOK_SOFT = "hsl(var(--primary) / 0.75)";

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 168 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      className={cn("text-muted-foreground", className)}
    >
      {/* fluffy ringed tail, curling up behind the right shoulder */}
      <ellipse cx="129" cy="78" rx="16" ry="14" fill="currentColor" />
      <ellipse cx="138" cy="63" rx="13.5" ry="11.5" fill={DARK} />
      <ellipse cx="141" cy="49" rx="11.5" ry="10.5" fill="currentColor" />
      <ellipse cx="138" cy="37" rx="9.5" ry="9" fill={DARK} />
      <ellipse cx="132" cy="29" rx="7.5" ry="7.5" fill="currentColor" />

      {/* soft rounded ears w/ dark tips */}
      <path d="M58 30 Q44 4 68 20 Q64 27 58 30 Z" fill="currentColor" />
      <path d="M102 30 Q116 4 92 20 Q96 27 102 30 Z" fill="currentColor" />
      <path d="M59 25 Q51 11 65 19 Q62 23 59 25 Z" fill={DARK} />
      <path d="M101 25 Q109 11 95 19 Q98 23 101 25 Z" fill={DARK} />

      {/* BIG round head */}
      <ellipse cx="80" cy="56" rx="40" ry="37" fill="currentColor" />

      {/* big soft dark eye-patches (the bandit mask) */}
      <ellipse cx="64" cy="54" rx="15.5" ry="17" fill={DARK} />
      <ellipse cx="96" cy="54" rx="15.5" ry="17" fill={DARK} />

      {/* white blaze + muzzle */}
      <path d="M80 28 Q73 46 80 60 Q87 46 80 28 Z" fill={LIGHT} opacity={0.7} />
      <ellipse cx="80" cy="72" rx="18" ry="15" fill={LIGHT} opacity={0.7} />

      {/* big calm eyes, gaze settled on the page just below */}
      <circle cx="64" cy="55" r="11.5" fill={LIGHT} />
      <circle cx="96" cy="55" r="11.5" fill={LIGHT} />
      <circle cx="64" cy="58" r="6.6" fill={PUPIL} />
      <circle cx="96" cy="58" r="6.6" fill={PUPIL} />
      {/* catchlights keep the eyes alive and friendly */}
      <circle cx="66.5" cy="54.5" r="2.4" fill={LIGHT} />
      <circle cx="98.5" cy="54.5" r="2.4" fill={LIGHT} />

      {/* gently relaxed brows — absorbed, content */}
      <path
        d="M54 43 Q63 40 72 44"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M88 44 Q97 40 106 43"
        stroke={DARK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* tiny nose + a small soft smile */}
      <path
        d="M80 64 q-4 0 -4 3.4 q0 3.4 4 3.9 q4 -0.5 4 -3.9 q0 -3.4 -4 -3.4 z"
        fill={DARK}
      />
      <path
        d="M74 76 q6 5 12 0"
        stroke={DARK}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* open field guide, held just in front — brand-toned cover, light pages */}
      {/* little paws resting on the cover */}
      <ellipse cx="55" cy="92" rx="7" ry="8" fill="currentColor" />
      <ellipse cx="105" cy="92" rx="7" ry="8" fill="currentColor" />
      {/* book cover */}
      <path d="M48 90 L80 96 L80 118 L46 112 Z" fill={BOOK} />
      <path d="M112 90 L80 96 L80 118 L114 112 Z" fill={BOOK_SOFT} />
      {/* pages */}
      <path d="M52 92 L80 97 L80 114 L51 109 Z" fill={LIGHT} />
      <path d="M108 92 L80 97 L80 114 L109 109 Z" fill={LIGHT} />
      {/* center spine */}
      <path d="M80 96 L80 118" stroke={DARK} strokeWidth="1.4" strokeLinecap="round" opacity={0.5} />
      {/* a couple of text lines on each page */}
      <path d="M57 99 L74 102" stroke={DARK} strokeWidth="1.3" strokeLinecap="round" opacity={0.4} />
      <path d="M57 104 L72 106.5" stroke={DARK} strokeWidth="1.3" strokeLinecap="round" opacity={0.3} />
      <path d="M86 102 L103 99" stroke={DARK} strokeWidth="1.3" strokeLinecap="round" opacity={0.4} />
      <path d="M88 106.5 L103 104" stroke={DARK} strokeWidth="1.3" strokeLinecap="round" opacity={0.3} />
    </svg>
  );
}

export default RaccoonReading;
