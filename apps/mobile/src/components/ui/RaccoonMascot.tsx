import React from "react";
import Svg, { Path, Ellipse, Circle, Rect, G } from "react-native-svg";

export type RaccoonVariant = "dad" | "mom" | "kid";

type Props = {
  /** Rendered width in px; height keeps the 124:134 aspect. */
  size?: number;
  /** Fur color (neutral greys read best as a raccoon). */
  fur?: string;
  variant?: RaccoonVariant;
  /** Pro: top hat + bow tie. */
  suited?: boolean;
};

const DARK = "#3a4350";

/**
 * Kawaii household raccoon mascot — big head, big sparkly eyes, blush, soft
 * mask, fluffy ringed tail. Pure react-native-svg (OTA-safe, no binary asset).
 * variant differentiates the household: dad (cowlick, biggest), mom (lashes +
 * flower), kid (small cowlick, smallest). `suited` adds the Pro hat + bow tie.
 */
export function RaccoonMascot({ size = 100, fur = "#aeb9c6", variant = "kid", suited = false }: Props) {
  const height = Math.round(size * (134 / 124));
  return (
    <Svg width={size} height={height} viewBox="0 0 124 134">
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
      {/* tiny nose + cute mouth */}
      <Path d="M62 68 q-4.5 0 -4.5 3.8 q0 3.8 4.5 4.4 q4.5 -0.6 4.5 -4.4 q0 -3.8 -4.5 -3.8 z" fill="#2a3038" />
      <Path
        d="M62 76 q-4.5 4.5 -9 2 M62 76 q4.5 4.5 9 2"
        stroke="#9aa7b5"
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
      />
      {/* pink blush */}
      <Ellipse cx={32} cy={70} rx={6.5} ry={4.2} fill="#F58FB4" opacity={0.7} />
      <Ellipse cx={92} cy={70} rx={6.5} ry={4.2} fill="#F58FB4" opacity={0.7} />

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
    </Svg>
  );
}
