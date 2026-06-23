import * as React from "react";

/**
 * RaccoonMark — the official LocateFlow brand mark (admin copy).
 *
 * A faithful React/SVG port of the parametric raccoon from the design handoff
 * (`Raccoon.dc.html`, 100×100 viewBox), identical to `apps/web`'s
 * `components/brand/RaccoonMark`. Kept as a local copy because the admin app
 * cannot import from `apps/web`; a future pass consolidates both (plus the
 * mobile `MoveRaccoon`) into the shared package (roadmap 5.6).
 *
 * The **eye accent is bound to the theme token** by default —
 * `hsl(var(--primary))` resolves to Gold in dark mode and Sapphire in light
 * (D5/D7). Pass an explicit `eye` to pin it.
 */
export type RaccoonMarkMood = "calm" | "alert" | "happy" | "thinking" | "approved";

export type RaccoonMarkProps = {
  /** Square render size in px. */
  size?: number;
  /** Optional non-square height; the mark is centered in the box. */
  height?: number;
  mood?: RaccoonMarkMood;
  head?: string;
  mask?: string;
  ear?: string;
  /** Eye + sparkle accent. Defaults to the live theme primary. */
  eye?: string;
  pupil?: string;
  className?: string;
};

const HEAD = "#8C9AB2";
const MASK = "#0C1525";
const EAR = "#C4A090";
const PUPIL = "#04080F";
const EYE_TOKEN = "hsl(var(--primary))";

export function RaccoonMark({
  size = 80,
  height = size,
  mood = "calm",
  head = HEAD,
  mask = MASK,
  ear = EAR,
  eye = EYE_TOKEN,
  pupil = PUPIL,
  className,
}: RaccoonMarkProps) {
  const markSize = Math.min(size, height);
  const offsetX = (size - markSize) / 2;
  const offsetY = (height - markSize) / 2;
  const scale = markSize / 100;
  const squint = mood === "thinking";
  const happy = mood === "happy" || mood === "approved";
  const alert = mood === "alert";
  const sparkle = mood === "approved";
  const eyeR = squint ? 6 : 8;
  const pupilR = squint ? 3.5 : 5;

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="presentation"
      focusable="false"
      className={`inline-block${className ? ` ${className}` : ""}`}
    >
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
        {/* ears */}
        <path d="M18 40 L12 8 L34 24Z" fill={head} />
        <path d="M19 37 L15 14 L30 24Z" fill={ear} opacity="0.9" />
        <path d="M82 40 L88 8 L66 24Z" fill={head} />
        <path d="M81 37 L85 14 L70 24Z" fill={ear} opacity="0.9" />
        {/* head + soft highlights */}
        <ellipse cx="50" cy="58" rx="36" ry="31" fill={head} />
        <ellipse cx="50" cy="45" rx="24" ry="14" fill="#B8C2D0" opacity="0.42" />
        <ellipse cx="18" cy="66" rx="12" ry="9" fill="#C0CAD8" opacity="0.4" />
        <ellipse cx="82" cy="66" rx="12" ry="9" fill="#C0CAD8" opacity="0.4" />
        {/* mask */}
        <ellipse cx="33" cy="51" rx="16" ry="13" fill={mask} transform="rotate(-6 33 51)" />
        <ellipse cx="67" cy="51" rx="16" ry="13" fill={mask} transform="rotate(6 67 51)" />
        <rect x="44" y="46" width="12" height="10" rx="5" fill={mask} />
        <path d="M20 43 Q50 36 80 43" stroke={mask} strokeWidth="8" strokeLinecap="round" fill="none" />
        {alert ? (
          <>
            <path d="M21 37 Q33 31 43 35" stroke={mask} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M79 37 Q67 31 57 35" stroke={mask} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
          </>
        ) : null}
        {/* eyes */}
        <circle cx="33" cy="51" r={eyeR} fill={eye} />
        <circle cx="33" cy="51" r={pupilR} fill={pupil} />
        <circle cx="35.5" cy="48.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
        <circle cx="67" cy="51" r={eyeR} fill={eye} />
        <circle cx="67" cy="51" r={pupilR} fill={pupil} />
        <circle cx="69.5" cy="48.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
        {squint ? (
          <>
            <line x1="25" y1="51" x2="41" y2="51" stroke={mask} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="59" y1="51" x2="75" y2="51" stroke={mask} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </>
        ) : null}
        {sparkle ? (
          <>
            <path d="M24 37 L25.5 33 L27 37 L25.5 41Z" fill={eye} opacity="0.9" />
            <path d="M73 37 L74.5 33 L76 37 L74.5 41Z" fill={eye} opacity="0.9" />
          </>
        ) : null}
        {/* nose + mouth */}
        <path d="M46 66 L50 72 L54 66 Q50 63 46 66Z" fill={mask} />
        {happy ? <path d="M43 75 Q50 81 57 75" stroke={mask} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45" /> : null}
        {/* whisker dots */}
        <circle cx="17" cy="67" r="1.3" fill={mask} opacity="0.26" />
        <circle cx="23" cy="67" r="1.3" fill={mask} opacity="0.26" />
        <circle cx="30" cy="67" r="1.3" fill={mask} opacity="0.26" />
        <circle cx="70" cy="67" r="1.3" fill={mask} opacity="0.26" />
        <circle cx="77" cy="67" r="1.3" fill={mask} opacity="0.26" />
        <circle cx="83" cy="67" r="1.3" fill={mask} opacity="0.26" />
        {/* muzzle */}
        <ellipse cx="50" cy="76" rx="17" ry="10" fill="#C8D0DC" opacity="0.3" />
      </g>
    </svg>
  );
}

export default RaccoonMark;
