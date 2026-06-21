import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Ellipse, Circle, Rect, G } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

const DARK = "#3a4350";
const FUR = "#aeb9c6";

/**
 * Startup "strolling-in" raccoon: the kawaii mascot adapted into a side-leaning
 * traveller carrying a little suitcase, animated entirely on the Reanimated UI
 * thread (OTA-safe — pure react-native-svg + reanimated, no binary/Lottie asset).
 *
 * The motion is layered to read as a gentle stroll rather than an anatomical
 * walk-cycle:
 *   - ENTRANCE: glides in from the left (translateX) + scales/fades up.
 *   - BOB:      a soft vertical sine (translateY) loops forever — the "stride".
 *   - SWAY:     the whole body tilts a touch left/right in sympathy with the bob.
 *   - BAG:      the suitcase swings on its own slightly-offset rhythm so it feels
 *               weighted and hand-held.
 *
 * Nothing here gates app readiness — the parent (AnimatedSplash) owns the
 * hand-off; this component is purely decorative and self-contained.
 */
export function RaccoonWalking({ size = 168 }: { size?: number }) {
  const reduceMotion = useReducedMotion();

  // Entrance drivers (one-shot).
  const enterX = useSharedValue(reduceMotion ? 0 : -64);
  const enterScale = useSharedValue(reduceMotion ? 1 : 0.82);
  const enterOpacity = useSharedValue(reduceMotion ? 1 : 0);
  // Looping drivers (idle stroll). 0..1 phase ramps we map to sine-ish motion
  // via interpolation in the worklet.
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const bagSwing = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      // Respect reduce-motion: hold the static, settled pose.
      enterX.value = 0;
      enterScale.value = 1;
      enterOpacity.value = 1;
      return;
    }

    // Glide + settle in. Spring on X/scale for a lively-but-soft arrival.
    enterOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    enterX.value = withSpring(0, { mass: 0.9, damping: 13, stiffness: 90 });
    enterScale.value = withDelay(
      60,
      withSpring(1, { mass: 0.7, damping: 11, stiffness: 120 }),
    );

    // Stroll loops. withRepeat(..., -1, true) yo-yos so there are no seams.
    bob.value = withRepeat(
      withTiming(1, { duration: 560, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 1120, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // Slightly offset phase + period so the bag never moves in lockstep.
    bagSwing.value = withDelay(
      140,
      withRepeat(
        withTiming(1, { duration: 980, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(bob);
      cancelAnimation(sway);
      cancelAnimation(bagSwing);
      cancelAnimation(enterX);
      cancelAnimation(enterScale);
      cancelAnimation(enterOpacity);
    };
  }, [reduceMotion, bob, sway, bagSwing, enterX, enterScale, enterOpacity]);

  // Whole-mascot transform: entrance + idle bob/sway combined.
  const bodyStyle = useAnimatedStyle(() => {
    // bob 0..1 -> -3..+3 px vertical
    const bobY = (bob.value - 0.5) * 6;
    // sway 0..1 -> -2.2..+2.2 deg
    const swayDeg = (sway.value - 0.5) * 4.4;
    return {
      opacity: enterOpacity.value,
      transform: [
        { translateX: enterX.value },
        { translateY: bobY },
        { scale: enterScale.value },
        { rotate: `${swayDeg}deg` },
      ],
    };
  });

  // The suitcase swings on its own gentle arc (rotation about the handle).
  const bagStyle = useAnimatedStyle(() => {
    const bagDeg = (bagSwing.value - 0.5) * 9; // -4.5..+4.5 deg
    const bagY = (bob.value - 0.5) * 3; // weighted lag against the body bob
    return {
      transform: [
        { translateY: bagY },
        { rotate: `${bagDeg}deg` },
      ],
    };
  });

  const height = Math.round(size * (150 / 124));
  const bagSize = Math.round(size * 0.36);

  return (
    <View style={[styles.wrap, { width: size, height }]} pointerEvents="none">
      <Animated.View style={bodyStyle}>
        <Svg width={size} height={height} viewBox="0 0 124 150">
          {/* soft ground shadow */}
          <Ellipse cx={60} cy={142} rx={34} ry={6} fill="#0A0F18" opacity={0.18} />

          {/* fluffy ringed tail (curled behind) */}
          <Ellipse cx={98} cy={118} rx={19} ry={16} fill={FUR} />
          <Ellipse cx={108} cy={100} rx={16} ry={13.5} fill={DARK} />
          <Ellipse cx={112} cy={82} rx={13.5} ry={12} fill={FUR} />
          <Ellipse cx={110} cy={66} rx={11} ry={10.5} fill={DARK} />
          <Ellipse cx={104} cy={54} rx={9} ry={9} fill={FUR} />

          {/* striding legs/feet — back foot planted, front foot lifted a touch */}
          <Ellipse cx={48} cy={134} rx={11} ry={6.5} fill={DARK} />
          <Ellipse cx={74} cy={130} rx={11} ry={6.5} fill={DARK} />

          {/* round body + belly, leaning slightly forward (toward the right) */}
          <Ellipse cx={60} cy={108} rx={26} ry={22} fill={FUR} />
          <Ellipse cx={61} cy={112} rx={15} ry={15} fill="#eef3f8" />

          {/* free hand (mid-stride, swinging back) */}
          <Ellipse cx={84} cy={104} rx={7} ry={8.5} fill={FUR} />

          {/* soft rounded ears w/ dark tips */}
          <Path d="M40 30 Q26 4 50 20 Q46 27 40 30 Z" fill={FUR} />
          <Path d="M84 30 Q98 4 74 20 Q78 27 84 30 Z" fill={FUR} />
          <Path d="M41 25 Q33 11 47 19 Q44 23 41 25 Z" fill={DARK} />
          <Path d="M83 25 Q91 11 77 19 Q80 23 83 25 Z" fill={DARK} />

          {/* BIG round head */}
          <Ellipse cx={62} cy={62} rx={40} ry={37} fill={FUR} />
          {/* big soft dark eye-patches (kawaii mask) */}
          <Ellipse cx={46} cy={59} rx={15.5} ry={17} fill={DARK} />
          <Ellipse cx={78} cy={59} rx={15.5} ry={17} fill={DARK} />
          {/* white blaze + muzzle */}
          <Path d="M62 34 Q55 52 62 66 Q69 52 62 34 Z" fill="#f4f8fc" />
          <Ellipse cx={62} cy={80} rx={18} ry={15} fill="#f4f8fc" />
          {/* BIG sparkly eyes, glancing forward (toward travel direction) */}
          <Circle cx={47} cy={59} r={11.5} fill="#fff" />
          <Circle cx={79} cy={59} r={11.5} fill="#fff" />
          <Circle cx={49} cy={60.5} r={6.8} fill="#171d25" />
          <Circle cx={81} cy={60.5} r={6.8} fill="#171d25" />
          <Circle cx={52} cy={57.5} r={2.8} fill="#fff" />
          <Circle cx={84} cy={57.5} r={2.8} fill="#fff" />
          {/* tiny nose + happy mouth */}
          <Path d="M62 72 q-4.3 0 -4.3 3.6 q0 3.6 4.3 4.2 q4.3 -0.6 4.3 -4.2 q0 -3.6 -4.3 -3.6 z" fill="#2a3038" />
          <Path
            d="M62 80 q-4.3 4.3 -8.6 1.9 M62 80 q4.3 4.3 8.6 1.9"
            stroke="#9aa7b5"
            strokeWidth={1.9}
            fill="none"
            strokeLinecap="round"
          />
          {/* pink blush */}
          <Ellipse cx={33} cy={74} rx={6.2} ry={4} fill="#F58FB4" opacity={0.7} />
          <Ellipse cx={91} cy={74} rx={6.2} ry={4} fill="#F58FB4" opacity={0.7} />
          {/* tiny cowlick */}
          <Path d="M62 23 q-2 -9 4 -10 q-2 5 0 9 z" fill={FUR} />
        </Svg>
      </Animated.View>

      {/* SUITCASE held in the leading hand — its own swinging layer so it feels
          weighted. Positioned over the front-left hand of the mascot. */}
      <Animated.View
        style={[
          styles.bag,
          { width: bagSize, height: bagSize, left: size * 0.05, top: height * 0.5 },
          bagStyle,
        ]}
      >
        <Suitcase size={bagSize} />
      </Animated.View>

      {/* the leading hand wraps the handle (drawn on top of the bag join) */}
      <Animated.View
        style={[
          styles.hand,
          { left: size * 0.16, top: height * 0.5 },
          bodyStyle,
        ]}
      >
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Ellipse cx={10} cy={10} rx={7.2} ry={8.5} fill={FUR} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Little rounded travel suitcase with a handle + clasps. Pure SVG. */
function Suitcase({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* handle */}
      <Path
        d="M18 12 Q18 4 24 4 Q30 4 30 12"
        stroke="#5a6470"
        strokeWidth={3.4}
        fill="none"
        strokeLinecap="round"
      />
      {/* case body */}
      <Rect x={8} y={12} width={32} height={28} rx={5} fill="#C46A4A" />
      <Rect x={8} y={12} width={32} height={28} rx={5} fill="none" stroke="#9E5239" strokeWidth={1.6} />
      {/* trim band */}
      <Rect x={8} y={22} width={32} height={6} fill="#CBA45E" />
      {/* clasps */}
      <Rect x={15} y={23} width={5} height={4} rx={1} fill="#9E7B2E" />
      <Rect x={28} y={23} width={5} height={4} rx={1} fill="#9E7B2E" />
      {/* corner stud highlight */}
      <Circle cx={13} cy={17} r={1.5} fill="#CBA45E" opacity={0.8} />
      <Circle cx={35} cy={17} r={1.5} fill="#CBA45E" opacity={0.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  bag: {
    position: "absolute",
  },
  hand: {
    position: "absolute",
    width: 20,
    height: 20,
  },
});
