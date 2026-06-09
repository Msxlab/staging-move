import React from "react";
import Svg, { Path, Ellipse, Circle, Rect, G } from "react-native-svg";

export type RaccoonVariant = "dad" | "mom" | "kid";

/**
 * Emotional pose, orthogonal to {@link RaccoonVariant}. Drives the face
 * (eyes / brows / mouth) and optional accents (confetti, sparkle, raised paws):
 *   - "neutral"   — the default settled face (sparkly eyes + soft smile).
 *   - "happy"     — bright eyes + upturned smile + brand sparkles & blush.
 *   - "sad"       — droopy brows + frown, blush removed (mirrors the bundle).
 *   - "celebrate" — happy face + raised paws + confetti burst.
 * Existing call sites omit `pose` and keep the unchanged neutral face.
 */
export type RaccoonPose = "neutral" | "happy" | "sad" | "celebrate";

type Props = {
  /** Rendered width in px; height keeps the 124:134 aspect. */
  size?: number;
  /** Fur color (neutral greys read best as a raccoon). */
  fur?: string;
  variant?: RaccoonVariant;
  /** Pro: top hat + bow tie. */
  suited?: boolean;
  /** Emotional pose; defaults to "neutral" so existing call sites are untouched. */
  pose?: RaccoonPose;
};

const DARK = "#3a4350";

// Aurora brand tokens, mirrored from packages/shared/src/design-tokens.ts so the
// pose accents read on-brand (we can't import runtime theme into a pure SVG).
const AURORA_BLUE = "#7FB6E8";
const AURORA_VIOLET = "#B49BFF";
const AURORA_MINT = "#87DDC0";
const AURORA_AMBER = "#F2C46C";
const BLUSH = "#F58FB4";

/**
 * Kawaii household raccoon mascot — big head, big sparkly eyes, blush, soft
 * mask, fluffy ringed tail. Pure react-native-svg (OTA-safe, no binary asset).
 * variant differentiates the household: dad (cowlick, biggest), mom (lashes +
 * flower), kid (small cowlick, smallest). `suited` adds the Pro hat + bow tie.
 */
export function RaccoonMascot({ size = 100, fur = "#aeb9c6", variant = "kid", suited = false, pose = "neutral" }: Props) {
  const height = Math.round(size * (134 / 124));
  const celebrating = pose === "celebrate";
  const sad = pose === "sad";
  // happy + celebrate share the bright face; sad gets droopy brows + frown.
  const cheerful = pose === "happy" || celebrating;
  return (
    <Svg width={size} height={height} viewBox="0 0 124 134">
      {/* CELEBRATE: raised paws behind the body, drawn first so the body overlaps. */}
      {celebrating && (
        <G strokeLinecap="round">
          <Path d="M40 96 Q24 80 20 56" stroke={fur} strokeWidth={9} fill="none" />
          <Path d="M84 96 Q100 80 104 56" stroke={fur} strokeWidth={9} fill="none" />
          <Circle cx={19} cy={53} r={6.5} fill={fur} />
          <Circle cx={105} cy={53} r={6.5} fill={fur} />
        </G>
      )}
      {/* fluffy ringed tail */}
      <Ellipse cx={96} cy={112} rx={21} ry={18} fill={fur} />
      <Ellipse cx={108} cy={92} rx={18.5} ry={15.5} fill={DARK} />
      <Ellipse cx={113} cy={71} rx={16} ry={14} fill={fur} />
      <Ellipse cx={113} cy={53} rx={13.5} ry={12.5} fill={DARK} />
      <Ellipse cx={109} cy={38} rx={11.5} ry={11} fill={fur} />
      <Ellipse cx={102} cy={27} rx={9} ry={9} fill={DARK} />
      {/* feet */}
      <Ellipse cx={46} cy={128} rx={11} ry={6.5} fill={DARK} />
      <Ellipse cx={78} cy={128} rx={11} ry={6.5} fill={DARK} />
      {/* round body + belly */}
      <Ellipse cx={62} cy={106} rx={27} ry={23} fill={fur} />
      <Ellipse cx={62} cy={110} rx={16} ry={16} fill="#eef3f8" />
      {/* little hands */}
      <Ellipse cx={36} cy={102} rx={7.5} ry={9} fill={fur} />
      <Ellipse cx={88} cy={100} rx={7.5} ry={9} fill={fur} />
      {/* soft rounded ears w/ dark tips */}
      <Path d="M40 26 Q26 0 50 16 Q46 23 40 26 Z" fill={fur} />
      <Path d="M84 26 Q98 0 74 16 Q78 23 84 26 Z" fill={fur} />
      <Path d="M41 21 Q33 7 47 15 Q44 19 41 21 Z" fill={DARK} />
      <Path d="M83 21 Q91 7 77 15 Q80 19 83 21 Z" fill={DARK} />
      {/* BIG round head */}
      <Ellipse cx={62} cy={58} rx={41} ry={38} fill={fur} />
      {/* big soft dark eye-patches (kawaii mask) */}
      <Ellipse cx={45} cy={55} rx={16} ry={17.5} fill={DARK} />
      <Ellipse cx={79} cy={55} rx={16} ry={17.5} fill={DARK} />
      {/* white blaze + muzzle */}
      <Path d="M62 30 Q55 48 62 62 Q69 48 62 30 Z" fill="#f4f8fc" />
      <Ellipse cx={62} cy={76} rx={19} ry={16} fill="#f4f8fc" />
      {/* BIG sparkly eyes */}
      <Circle cx={45} cy={55} r={12} fill="#fff" />
      <Circle cx={79} cy={55} r={12} fill="#fff" />
      <Circle cx={46} cy={57} r={7} fill="#171d25" />
      <Circle cx={78} cy={57} r={7} fill="#171d25" />
      <Circle cx={49} cy={53.5} r={2.9} fill="#fff" />
      <Circle cx={82} cy={53.5} r={2.9} fill="#fff" />
      <Circle cx={43} cy={59.5} r={1.5} fill="#fff" />
      <Circle cx={75} cy={59.5} r={1.5} fill="#fff" />
      {/* SAD: droopy brows angled down toward the muzzle (mirrors mascot-sad.svg). */}
      {sad && (
        <G>
          <Path d="M37 47 Q45 44 52 48" stroke="#171d25" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d="M87 47 Q79 44 72 48" stroke="#171d25" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </G>
      )}
      {/* tiny nose */}
      <Path d="M62 68 q-4.5 0 -4.5 3.8 q0 3.8 4.5 4.4 q4.5 -0.6 4.5 -4.4 q0 -3.8 -4.5 -3.8 z" fill="#2a3038" />
      {/* cute mouth — pose-driven: frown / soft neutral / wide cheerful smile */}
      {sad ? (
        <Path
          d="M55 80 Q62 74 69 80"
          stroke="#7c8794"
          strokeWidth={2.1}
          fill="none"
          strokeLinecap="round"
        />
      ) : cheerful ? (
        <Path
          d="M54 76 Q62 87 70 76 Q62 81 54 76 Z"
          fill="#2a3038"
        />
      ) : (
        <Path
          d="M62 76 q-4.5 4.5 -9 2 M62 76 q4.5 4.5 9 2"
          stroke="#9aa7b5"
          strokeWidth={1.9}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* pink blush — kept for neutral + cheerful, dropped when sad. */}
      {!sad && (
        <G>
          <Ellipse cx={32} cy={70} rx={6.5} ry={4.2} fill={BLUSH} opacity={cheerful ? 0.85 : 0.7} />
          <Ellipse cx={92} cy={70} rx={6.5} ry={4.2} fill={BLUSH} opacity={cheerful ? 0.85 : 0.7} />
        </G>
      )}

      {/* variant accents */}
      {variant === "mom" && (
        <G>
          <Path d="M33 48 l-5 -3 M32.5 53 l-6 -1 M33 58 l-5 2" stroke="#171d25" strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M91 48 l5 -3 M91.5 53 l6 -1 M91 58 l5 2" stroke="#171d25" strokeWidth={1.5} strokeLinecap="round" />
          <Circle cx={40} cy={6.5} r={3} fill="#FBC8DB" />
          <Circle cx={45.2} cy={10.3} r={3} fill="#FBC8DB" />
          <Circle cx={43.2} cy={16.5} r={3} fill="#FBC8DB" />
          <Circle cx={36.8} cy={16.5} r={3} fill="#FBC8DB" />
          <Circle cx={34.8} cy={10.3} r={3} fill="#FBC8DB" />
          <Circle cx={40} cy={12} r={2.4} fill="#FFD86B" />
        </G>
      )}
      {variant === "dad" && (
        <Path
          d="M62 18 q-3 -10 3 -12 M62 18 q0 -11 7 -10 M62 18 q3 -9 10 -7"
          stroke={fur}
          strokeWidth={3.4}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {variant === "kid" && <Path d="M62 19 q-2 -9 4 -10 q-2 5 0 9 z" fill={fur} />}

      {/* Pro suit: top hat + bow tie */}
      {suited && (
        <G>
          <Ellipse cx={62} cy={22} rx={31} ry={6.5} fill="#15171c" />
          <Rect x={44} y={-5} width={36} height={24} rx={3.5} fill="#15171c" />
          <Rect x={44} y={6} width={36} height={6.5} fill="#E9C46A" />
          <Path d="M62 90 l-15 -8 v16 z" fill="#E9C46A" />
          <Path d="M62 90 l15 -8 v16 z" fill="#E9C46A" />
          <Circle cx={62} cy={90} r={4.8} fill="#caa24a" />
        </G>
      )}

      {/* HAPPY accent: two brand sparkles flanking the head (mascot-happy.svg). */}
      {pose === "happy" && (
        <G>
          <Path
            d="M16 30 l1.9 5 l5 1.9 l-5 1.9 l-1.9 5 l-1.9 -5 l-5 -1.9 l5 -1.9 z"
            fill={AURORA_AMBER}
          />
          <Path
            d="M106 24 l1.3 3.3 l3.3 1.3 l-3.3 1.3 l-1.3 3.3 l-1.3 -3.3 l-3.3 -1.3 l3.3 -1.3 z"
            fill={AURORA_BLUE}
          />
        </G>
      )}

      {/* CELEBRATE accent: confetti burst around the raised-paw raccoon. */}
      {celebrating && (
        <G>
          <Rect x={10} y={12} width={6} height={6} rx={1.5} fill={AURORA_BLUE} transform="rotate(20 13 15)" />
          <Rect x={106} y={16} width={6} height={6} rx={1.5} fill={AURORA_MINT} transform="rotate(-15 109 19)" />
          <Circle cx={26} cy={6} r={3} fill={AURORA_AMBER} />
          <Circle cx={98} cy={5} r={3} fill={AURORA_BLUE} />
          <Rect x={59} y={1} width={5} height={5} rx={1.3} fill={AURORA_AMBER} transform="rotate(30 61 3)" />
          <Path d="M4 52 l3 3 M7 52 l-3 3" stroke={AURORA_MINT} strokeWidth={2} strokeLinecap="round" />
          <Path d="M115 56 l3 3 M118 56 l-3 3" stroke={AURORA_AMBER} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={14} cy={40} r={2.4} fill={AURORA_VIOLET} />
          <Circle cx={110} cy={42} r={2.4} fill={AURORA_VIOLET} />
        </G>
      )}
    </Svg>
  );
}
