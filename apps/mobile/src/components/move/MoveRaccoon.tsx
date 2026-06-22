import React from "react";
import Svg, { Path, Ellipse, Circle, Rect, Line, G } from "react-native-svg";
import { useAppTheme } from "@/lib/theme";

/**
 * LocateFlow mascot mark - the sleek geometric mascot from the source theme
 * (Raccoon.dc.html), ported to react-native-svg (OTA-safe, no binary asset).
 *
 * Distinct from the kawaii household {@link RaccoonMascot} (dad/mom/kid): this
 * is the brand mark used in the AI briefing, splash, route card, subscription
 * and onboarding. Colors default to the active theme's `raccoon` tokens with
 * the eye on the Sapphire accent; pass overrides to match a specific surface.
 */
export type RaccoonMood = "calm" | "alert" | "happy" | "thinking" | "approved";

type Props = {
  /** Rendered size in px (square viewBox). */
  size?: number;
  mood?: RaccoonMood;
  head?: string;
  mask?: string;
  ear?: string;
  eye?: string;
  pupil?: string;
};

export function MoveRaccoon({ size = 80, mood = "calm", head, mask, ear, eye, pupil }: Props) {
  const { colors } = useAppTheme();
  const rc = colors.raccoon;
  const H = head ?? rc.head;
  const M = mask ?? rc.mask;
  const E = ear ?? rc.ear;
  const EY = eye ?? rc.eye;
  const P = pupil ?? rc.pupil;

  const squint = mood === "thinking";
  const happy = mood === "happy" || mood === "approved";
  const alert = mood === "alert";
  const sparkle = mood === "approved";
  const eyeR = squint ? 6 : 8;
  const pupilR = squint ? 3.5 : 5;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* ears */}
      <Path d="M18 40 L12 8 L34 24Z" fill={H} />
      <Path d="M19 37 L15 14 L30 24Z" fill={E} opacity={0.9} />
      <Path d="M82 40 L88 8 L66 24Z" fill={H} />
      <Path d="M81 37 L85 14 L70 24Z" fill={E} opacity={0.9} />
      {/* head + soft highlights */}
      <Ellipse cx={50} cy={58} rx={36} ry={31} fill={H} />
      <Ellipse cx={50} cy={45} rx={24} ry={14} fill="#B8C2D0" opacity={0.42} />
      <Ellipse cx={18} cy={66} rx={12} ry={9} fill="#C0CAD8" opacity={0.4} />
      <Ellipse cx={82} cy={66} rx={12} ry={9} fill="#C0CAD8" opacity={0.4} />
      {/* mask */}
      <Ellipse cx={33} cy={51} rx={16} ry={13} fill={M} transform="rotate(-6 33 51)" />
      <Ellipse cx={67} cy={51} rx={16} ry={13} fill={M} transform="rotate(6 67 51)" />
      <Rect x={44} y={46} width={12} height={10} rx={5} fill={M} />
      <Path d="M20 43 Q50 36 80 43" stroke={M} strokeWidth={8} strokeLinecap="round" fill="none" />
      {alert ? (
        <G>
          <Path d="M21 37 Q33 31 43 35" stroke={M} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
          <Path d="M79 37 Q67 31 57 35" stroke={M} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
        </G>
      ) : null}
      {/* eyes */}
      <Circle cx={33} cy={51} r={eyeR} fill={EY} />
      <Circle cx={33} cy={51} r={pupilR} fill={P} />
      <Circle cx={35.5} cy={48.5} r={1.8} fill="white" opacity={0.75} />
      <Circle cx={67} cy={51} r={eyeR} fill={EY} />
      <Circle cx={67} cy={51} r={pupilR} fill={P} />
      <Circle cx={69.5} cy={48.5} r={1.8} fill="white" opacity={0.75} />
      {squint ? (
        <G>
          <Line x1={25} y1={51} x2={41} y2={51} stroke={M} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
          <Line x1={59} y1={51} x2={75} y2={51} stroke={M} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        </G>
      ) : null}
      {sparkle ? (
        <G>
          <Path d="M24 37 L25.5 33 L27 37 L25.5 41Z" fill={EY} opacity={0.9} />
          <Path d="M73 37 L74.5 33 L76 37 L74.5 41Z" fill={EY} opacity={0.9} />
        </G>
      ) : null}
      {/* nose + mouth */}
      <Path d="M46 66 L50 72 L54 66 Q50 63 46 66Z" fill={M} />
      {happy ? (
        <Path d="M43 75 Q50 81 57 75" stroke={M} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.45} />
      ) : null}
      {/* whisker dots */}
      <Circle cx={17} cy={67} r={1.3} fill={M} opacity={0.26} />
      <Circle cx={23} cy={67} r={1.3} fill={M} opacity={0.26} />
      <Circle cx={30} cy={67} r={1.3} fill={M} opacity={0.26} />
      <Circle cx={70} cy={67} r={1.3} fill={M} opacity={0.26} />
      <Circle cx={77} cy={67} r={1.3} fill={M} opacity={0.26} />
      <Circle cx={83} cy={67} r={1.3} fill={M} opacity={0.26} />
      {/* muzzle */}
      <Ellipse cx={50} cy={76} rx={17} ry={10} fill="#C8D0DC" opacity={0.3} />
    </Svg>
  );
}
