import type { AmbientIntensity, AmbientKind, AmbientVariant } from "./dossier-ambient";

/**
 * DOSSIER RACCOON (web) — a mood-driven character layered ON TOP of the existing
 * data-derived ambient scenes ({@link AmbientSpec} from ambientForSection).
 *
 * Ported for visual parity from the mobile implementation
 * (apps/mobile/src/lib/dossier-raccoon.ts + apps/mobile/src/components/move/
 * MoveRaccoon.tsx). The mood table is identical so a given reading shows the
 * SAME expression on web and mobile; the mark is the same geometric raccoon,
 * re-expressed as a plain inline SVG (no react-native-svg) so it is a cheap
 * static element with no new motion.
 *
 * The raccoon REACTS to the home's real readings without touching the data
 * layer: ambientForSection stays the data-honest source of truth, and the pure
 * mapper below translates each scene's (kind, level, variant) into one of the
 * five moods so the character's expression mirrors the data honesty —
 *   - a GOOD / safe reading    -> happy | approved
 *   - a NEUTRAL / mid reading   -> calm  | thinking
 *   - a BAD / high-risk reading  -> alert
 */

/** The five expressions exposed by the parametric raccoon mark. */
export type DossierRaccoonMood = "calm" | "alert" | "happy" | "thinking" | "approved";

/** The scene signals the character reacts to (a subset of the AmbientSpec). */
export interface DossierRaccoonInput {
  kind: AmbientKind;
  /** Clamped scene level: 0 = safe/calm, 1 = moderate, 2 = elevated/high-risk. */
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
}

/**
 * Weather reads its mood from the variant (the dramatic axis) first, then the
 * intensity, because a sunny level-0 and a stormy level-2 are different KINDS
 * of weather, not just degrees of one. Storm/lightning always alarms the
 * raccoon; clear/sun delights it. (Mirrors mobile weatherMood exactly.)
 */
function weatherMood(variant: AmbientVariant | undefined, level: AmbientIntensity): DossierRaccoonMood {
  switch (variant) {
    case "storm":
    case "lightning":
      return "alert";
    case "sun":
      return "happy";
    case "cloud":
      return "calm";
    case "snow":
    case "winter":
    case "cold":
    case "fog":
    case "wind":
    case "rain":
    case "heat":
      return level >= 2 ? "alert" : "thinking";
    default:
      return level >= 2 ? "alert" : level === 1 ? "calm" : "happy";
  }
}

/**
 * Map a dossier scene's (kind + level + variant) to the raccoon mood that
 * honestly reflects the underlying reading. EVERY AmbientKind and level is
 * covered — there is no scene-state without a fitting expression. Kept in
 * lockstep with apps/mobile/src/lib/dossier-raccoon.ts.
 */
export function dossierRaccoonFor(input: DossierRaccoonInput): DossierRaccoonMood {
  const { kind, intensity, variant } = input;
  switch (kind) {
    case "flood":
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "approved";
    case "school":
      return "happy";
    case "hazard":
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "calm";
    case "radon":
      return intensity >= 2 ? "alert" : intensity === 1 ? "calm" : "happy";
    case "water":
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "approved";
    case "air":
      return intensity >= 2 ? "alert" : intensity === 1 ? "calm" : "happy";
    case "housing":
      return intensity >= 2 ? "thinking" : intensity === 1 ? "calm" : "happy";
    case "evCharging":
      return intensity >= 2 ? "approved" : intensity === 1 ? "happy" : "calm";
    case "neighborhood":
      return intensity >= 2 ? "approved" : intensity === 1 ? "happy" : "calm";
    case "weather":
      return weatherMood(variant, intensity);
    default: {
      // Exhaustiveness guard: a new AmbientKind must extend the table above.
      const _never: never = kind;
      return _never;
    }
  }
}

/**
 * The geometric LocateFlow raccoon mark (ported from mobile MoveRaccoon). Colors
 * resolve to theme tokens via CSS variables so it sits naturally on the card in
 * both light and dark: the head/mask/ear use neutral foreground mixes, the eye
 * is tinted with the accent foil. A purely static SVG — it carries no animation,
 * so it is inherently reduced-motion safe and adds nothing to the GPU budget the
 * ambient scenes already manage.
 */
export function DossierRaccoon({
  mood = "calm",
  size = 44,
}: {
  mood?: DossierRaccoonMood;
  size?: number;
}) {
  // Source scene variables drive the prototype palette; tokens stay as fallbacks.
  const H = "var(--rc-head, color-mix(in srgb, var(--fg) 26%, transparent))";
  const M = "var(--rc-mask, color-mix(in srgb, var(--fg) 52%, transparent))";
  const E = "var(--rc-ear, color-mix(in srgb, var(--fg) 34%, transparent))";
  const EY = "var(--rc-eye, var(--foil-b))";
  const P = "var(--rc-pupil, color-mix(in srgb, var(--fg) 78%, transparent))";

  const squint = mood === "thinking";
  const happy = mood === "happy" || mood === "approved";
  const alert = mood === "alert";
  const sparkle = mood === "approved";
  const eyeR = squint ? 6 : 8;
  const pupilR = squint ? 3.5 : 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
    >
      {/* ears */}
      <path d="M18 40 L12 8 L34 24Z" fill={H} />
      <path d="M19 37 L15 14 L30 24Z" fill={E} opacity={0.9} />
      <path d="M82 40 L88 8 L66 24Z" fill={H} />
      <path d="M81 37 L85 14 L70 24Z" fill={E} opacity={0.9} />
      {/* head */}
      <ellipse cx={50} cy={58} rx={36} ry={31} fill={H} />
      {/* mask */}
      <ellipse cx={33} cy={51} rx={16} ry={13} fill={M} transform="rotate(-6 33 51)" />
      <ellipse cx={67} cy={51} rx={16} ry={13} fill={M} transform="rotate(6 67 51)" />
      <rect x={44} y={46} width={12} height={10} rx={5} fill={M} />
      <path d="M20 43 Q50 36 80 43" stroke={M} strokeWidth={8} strokeLinecap="round" fill="none" />
      {alert && (
        <g>
          <path d="M21 37 Q33 31 43 35" stroke={M} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
          <path d="M79 37 Q67 31 57 35" stroke={M} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
        </g>
      )}
      {/* eyes */}
      <circle cx={33} cy={51} r={eyeR} fill={EY} />
      <circle cx={33} cy={51} r={pupilR} fill={P} />
      <circle cx={35.5} cy={48.5} r={1.8} fill="white" opacity={0.75} />
      <circle cx={67} cy={51} r={eyeR} fill={EY} />
      <circle cx={67} cy={51} r={pupilR} fill={P} />
      <circle cx={69.5} cy={48.5} r={1.8} fill="white" opacity={0.75} />
      {squint && (
        <g>
          <line x1={25} y1={51} x2={41} y2={51} stroke={M} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
          <line x1={59} y1={51} x2={75} y2={51} stroke={M} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        </g>
      )}
      {sparkle && (
        <g>
          <path d="M24 37 L25.5 33 L27 37 L25.5 41Z" fill={EY} opacity={0.9} />
          <path d="M73 37 L74.5 33 L76 37 L74.5 41Z" fill={EY} opacity={0.9} />
        </g>
      )}
      {/* nose + mouth */}
      <path d="M46 66 L50 72 L54 66 Q50 63 46 66Z" fill={M} />
      {happy && (
        <path d="M43 75 Q50 81 57 75" stroke={M} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.45} />
      )}
    </svg>
  );
}
