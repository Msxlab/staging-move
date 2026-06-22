import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Line, Path, Polyline, Rect } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/lib/theme";
import type { AmbientIntensity, AmbientKind, AmbientVariant } from "@/lib/home-dossier";

/**
 * DOSSIER AMBIENT (mobile) — Aurora decorative scene layer for the
 * HomeDossierCard section rows, ported for visual parity from
 * apps/web/src/components/dashboard/dossier-ambient.tsx (same geometry,
 * palette mapping, and timings; scene parameters come from the REAL section
 * data via ambientForSection in @/lib/home-dossier).
 *
 * Mobile adaptations (Edition VII Aurora hard rules still apply):
 *  - All motion runs on the Reanimated UI thread via withRepeat/withTiming
 *    worklets — transform/opacity only, never a JS-thread interval.
 *  - useReducedMotion() => no animation is ever started; every scene freezes
 *    into an intentional settled composition (kids spaced out on the
 *    sidewalk, bolt hidden, windows softly lit), mirroring the web
 *    prefers-reduced-motion fallbacks.
 *  - RN has no CSS mask-image: the layer only occupies the right 55% of the
 *    row and a card-colored LinearGradient fades its left edge, so the text
 *    zone stays 100% clean.
 *  - Node counts are capped for mobile perf: particles top out at 8
 *    (web runs up to 14) and streaks at 3, preserving the calm < moderate
 *    < elevated density ordering the data drives.
 *  - Continuous drifts loop a 0..1 phase and add a per-element offset inside
 *    the worklet (`(phase + offset) % 1`) — the spatial stagger the web gets
 *    from negative animation-delays, and the frozen offset doubles as the
 *    settled reduced-motion position.
 */

// ── Shared plumbing ──────────────────────────────────────────────────────────

interface Palette {
  /** Foreground ink (web --fg): silhouettes, streaks, clouds. */
  ink: string;
  /** Move Sapphire (web --rose): calm water, rain. */
  cool: string;
  /** Sapphire foil (web --foil-b): bubbles, windows, sun, bolt. */
  honey: string;
  /** Aurora mint (web --sage): clean-air breeze + leaf. */
  mint: string;
  /** Aurora coral (web --danger): elevated water/air. */
  coral: string;
}

interface SceneProps {
  intensity: AmbientIntensity;
  width: number;
  height: number;
  palette: Palette;
  reduceMotion: boolean;
}

/** "#rrggbb" + alpha suffix; anything else falls back to fully transparent. */
function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : "transparent";
}

/**
 * A 0 -> 1 linear phase looping forever on the UI thread. Under reduce-motion
 * the phase never animates and rests at 0 — per-element offsets applied in
 * the consuming worklet turn that resting phase into the settled scene.
 */
function useLoopPhase(durationMs: number, reduceMotion: boolean) {
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [durationMs, reduceMotion, phase]);
  return phase;
}

/**
 * A 0 -> 1 -> 0 gentle ease-in-out yo-yo ("breathing"). `halfMs` is HALF the
 * full cycle (a web 16s breathe keyframe = halfMs 8000). Rests at
 * `staticPhase` under reduce-motion (0.5 = the neutral midpoint).
 */
function useBreathePhase(halfMs: number, reduceMotion: boolean, staticPhase = 0) {
  const phase = useSharedValue(reduceMotion ? staticPhase : 0);
  useEffect(() => {
    if (reduceMotion) {
      phase.value = staticPhase;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: halfMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(phase);
  }, [halfMs, reduceMotion, staticPhase, phase]);
  return phase;
}

// ── Flood — 3 stacked sine waves, parallax drift, level breathing ────────────

/**
 * Seamless sine band: period 120 over a 480-wide tile, stretched to 2x the
 * layer width, so a one-layer-width translateX lands exactly two periods
 * over (same construction as the web wavePath).
 */
function wavePath(amplitude: number, height: number): string {
  const mid = Math.min(height / 2, amplitude + 2);
  const amp = Math.min(amplitude, Math.max(0.5, mid - 0.5));
  let d = `M0 ${mid} Q30 ${Math.round((mid - amp) * 10) / 10} 60 ${mid}`;
  for (let x = 120; x <= 480; x += 60) d += ` T${x} ${mid}`;
  d += ` L480 ${height} L0 ${height} Z`;
  return d;
}

/** back / mid / front bands — mid drifts reversed (parallax), like the web. */
const FLOOD_WAVES = [
  { height: 16, durMs: 26000, highDurMs: 18000, reversed: false, op: 0.1, highOp: 0.12 },
  { height: 12, durMs: 19000, highDurMs: 13000, reversed: true, op: 0.12, highOp: 0.15 },
  { height: 8, durMs: 14000, highDurMs: 9500, reversed: false, op: 0.14, highOp: 0.18 },
] as const;

function FloodWave({
  width,
  band,
  amp,
  color,
  intensity,
  reduceMotion,
}: {
  width: number;
  band: (typeof FLOOD_WAVES)[number];
  amp: number;
  color: string;
  intensity: AmbientIntensity;
  reduceMotion: boolean;
}) {
  const elevated = intensity === 2;
  const phase = useLoopPhase(elevated ? band.highDurMs : band.durMs, reduceMotion);
  const reversed = band.reversed;
  const drift = useAnimatedStyle(() => {
    const p = reversed ? 1 - phase.value : phase.value;
    return { transform: [{ translateX: -width * p }] };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", bottom: 0, left: 0, width: width * 2, height: band.height }, drift]}
    >
      <Svg
        width={width * 2}
        height={band.height}
        viewBox={`0 0 480 ${band.height}`}
        preserveAspectRatio="none"
      >
        <Path d={wavePath(amp, band.height)} fill={color} opacity={elevated ? band.highOp : band.op} />
      </Svg>
    </Animated.View>
  );
}

function FloodScene({ intensity, width, palette, reduceMotion }: SceneProps) {
  const color = intensity === 2 ? palette.coral : intensity === 0 ? palette.cool : palette.honey;
  const amps = intensity === 2 ? [5.5, 4.5, 3.4] : intensity === 1 ? [3.5, 3, 2.4] : [1.4, 1.2, 1];
  // Whole water level "breathes" at the calm and elevated bands (web: 16s
  // -1.5px calm, 10s -4px elevated; moderate holds still).
  const breathe = useBreathePhase(intensity === 2 ? 5000 : 8000, reduceMotion || intensity === 1, 0);
  const breatheY = intensity === 2 ? -4 : -1.5;
  const level = useAnimatedStyle(() => ({
    transform: [{ translateY: breathe.value * breatheY }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, level]}>
      {FLOOD_WAVES.map((band, i) => (
        <FloodWave
          key={i}
          width={width}
          band={band}
          amp={amps[i]}
          color={color}
          intensity={intensity}
          reduceMotion={reduceMotion}
        />
      ))}
    </Animated.View>
  );
}

// ── School — hairline sidewalk + small silhouettes walking across ────────────

/** offset doubles as the settled (reduced-motion) spot on the sidewalk. */
const KID_WALKERS = [
  { h: 18, durMs: 26000, offset: 0.2, op: 0.28 },
  { h: 14, durMs: 31000, offset: 0.48, op: 0.22 },
  { h: 16, durMs: 36000, offset: 0.73, op: 0.25 },
] as const;

function SchoolKid({
  width,
  kid,
  color,
  reduceMotion,
}: {
  width: number;
  kid: (typeof KID_WALKERS)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(kid.durMs, reduceMotion);
  const bob = useBreathePhase(600, reduceMotion, 0.5);
  const offset = kid.offset;
  const track = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return { transform: [{ translateX: interpolate(p, [0, 1], [-0.06 * width, 1.04 * width]) }] };
  });
  const stride = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -1.5]) },
      { rotate: `${interpolate(bob.value, [0, 1], [-2, 2])}deg` },
    ],
  }));
  const w = Math.round((kid.h * 12) / 18);
  return (
    <Animated.View style={[{ position: "absolute", left: 0, bottom: 7 }, track]}>
      <Animated.View style={stride}>
        {/* head circle + rounded-capsule body + small backpack rect */}
        <Svg width={w} height={kid.h} viewBox="0 0 12 18" opacity={kid.op}>
          <Circle cx={6.5} cy={2.6} r={2.4} fill={color} />
          <Rect x={4} y={5.6} width={5} height={9.6} rx={2.5} fill={color} />
          <Rect x={1.6} y={7} width={3.2} height={5.4} rx={1.2} fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function SchoolScene({ intensity, width, palette, reduceMotion }: SceneProps) {
  const kids = intensity === 0 ? KID_WALKERS.slice(0, 2) : KID_WALKERS;
  return (
    <>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 6,
          height: 1,
          backgroundColor: palette.ink,
          opacity: 0.1,
        }}
      />
      {kids.map((kid, i) => (
        <SchoolKid key={i} width={width} kid={kid} color={palette.ink} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}

// ── Hazard / lightning — cloud puff + quick double-flash bolt & sweep ────────

function LightningScene({ intensity, palette, reduceMotion }: SceneProps) {
  const cycleMs = intensity === 2 ? 5000 : intensity === 1 ? 7000 : 10000;
  const flash = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      // Static scene: just the resting cloud — bolt and sweep stay hidden.
      flash.value = 0;
      return;
    }
    flash.value = 0;
    // Quick double-flash (~400ms) then a long rest, like the web keyframes.
    flash.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 90, easing: Easing.linear }),
        withTiming(1, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 130, easing: Easing.linear }),
        withTiming(0, { duration: cycleMs - 400 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(flash);
  }, [cycleMs, reduceMotion, flash]);
  const bolt = useAnimatedStyle(() => ({ opacity: flash.value }));
  const sweep = useAnimatedStyle(() => ({ opacity: flash.value * 0.04 }));
  return (
    <>
      <Svg
        style={{ position: "absolute", top: 6, right: "10%" }}
        width={64}
        height={24}
        viewBox="0 0 64 24"
      >
        <Ellipse cx={24} cy={14} rx={20} ry={9} fill={palette.ink} opacity={0.06} />
        <Ellipse cx={42} cy={11} rx={16} ry={8} fill={palette.ink} opacity={0.06} />
      </Svg>
      <Animated.View style={[{ position: "absolute", top: 26, right: "22%" }, bolt]}>
        <Svg width={12} height={18} viewBox="0 0 12 18">
          <Polyline
            points="7.5,1 3.5,8 6.5,8 4.5,16"
            stroke={palette.honey}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink }, sweep]} />
    </>
  );
}

// ── Drifting streak (hazard/wind + air breeze share this element) ────────────

function DriftStreak({
  width,
  top,
  streakWidth,
  durMs,
  offset,
  color,
  opacity,
  rotateDeg = 0,
  reduceMotion,
}: {
  width: number;
  top: `${number}%`;
  streakWidth: number;
  durMs: number;
  offset: number;
  color: string;
  opacity: number;
  rotateDeg?: number;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(durMs, reduceMotion);
  const drift = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return { transform: [{ translateX: interpolate(p, [0, 1], [-0.12 * width, 1.06 * width]) }] };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top }, drift]}>
      <LinearGradient
        colors={[withAlpha(color, "00"), color, withAlpha(color, "00")]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          width: streakWidth,
          height: 2,
          borderRadius: 999,
          opacity,
          transform: rotateDeg ? [{ rotate: `${rotateDeg}deg` }] : undefined,
        }}
      />
    </Animated.View>
  );
}

// ── Hazard / wind — thin streaks at -8 degrees, speed scales with rating ─────

const WIND_STREAKS = [
  { top: "22%", w: 72, durMs: 8500, offset: 0.2 },
  { top: "44%", w: 48, durMs: 7200, offset: 0.45 },
  { top: "62%", w: 88, durMs: 10600, offset: 0.66 },
] as const;

function WindScene({ intensity, width, palette, reduceMotion }: SceneProps) {
  // Mobile keeps 3 streaks at every band (web adds up to 5) — the data still
  // shows through the drift speed: elevated is visibly quicker.
  const speed = intensity === 2 ? 0.72 : intensity === 1 ? 0.88 : 1;
  return (
    <>
      {WIND_STREAKS.map((s, i) => (
        <DriftStreak
          key={i}
          width={width}
          top={s.top}
          streakWidth={s.w}
          durMs={Math.round(s.durMs * speed)}
          offset={s.offset}
          color={palette.ink}
          opacity={0.16}
          rotateDeg={-8}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

// ── Falling / rising particles (hazard/winter, radon, weather/rain) ──────────

/** Deterministic scatter (no Math.random) — mirrors the web particle tables. */
const SNOW_DOTS = Array.from({ length: 8 }, (_, i) => ({
  left: ((i * 31 + 9) % 94) / 100,
  size: 1.5 + ((i * 7) % 5) * 0.25,
  durMs: (9 + ((i * 13) % 11) * 0.5) * 1000,
  offset: 0.15 + (((i * 17) % 12) / 12) * 0.7,
}));

function SnowDot({
  width,
  height,
  dot,
  color,
  reduceMotion,
}: {
  width: number;
  height: number;
  dot: (typeof SNOW_DOTS)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(dot.durMs, reduceMotion);
  const offset = dot.offset;
  const fall = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.12, 0.7, 1], [0, 0.16, 0.16, 0]),
      transform: [
        { translateY: interpolate(p, [0, 1], [-6, height + 6]) },
        { translateX: interpolate(p, [0, 0.4, 0.7, 1], [0, 4, -3, 2]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: dot.left * width,
          top: 0,
          width: dot.size,
          height: dot.size,
          borderRadius: 999,
          backgroundColor: color,
        },
        fall,
      ]}
    />
  );
}

function WinterScene({ intensity, width, height, palette, reduceMotion }: SceneProps) {
  // Web falls 8/11/14 dots — mobile compresses to 4/6/8 under the particle cap.
  const dots = SNOW_DOTS.slice(0, 4 + intensity * 2);
  return (
    <>
      {dots.map((dot, i) => (
        <SnowDot
          key={i}
          width={width}
          height={height}
          dot={dot}
          color={palette.ink}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

// ── Radon — faint honey bubbles rising from the bottom ───────────────────────

const RADON_BUBBLES = Array.from({ length: 8 }, (_, i) => ({
  left: ((i * 37 + 11) % 92) / 100,
  size: 1.5 + ((i * 11) % 7) * 0.25,
  durMs: (8 + ((i * 13) % 13) * 0.5) * 1000,
  offset: 0.15 + (((i * 23) % 11) / 11) * 0.7,
  op: 0.12 + ((i * 5) % 7) * 0.01,
}));

function RadonBubble({
  width,
  height,
  bubble,
  color,
  reduceMotion,
}: {
  width: number;
  height: number;
  bubble: (typeof RADON_BUBBLES)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(bubble.durMs, reduceMotion);
  const offset = bubble.offset;
  const op = bubble.op;
  const rise = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.15, 0.85, 1], [0, op, op * 0.87, 0]),
      transform: [
        { translateY: interpolate(p, [0, 1], [4, -(height - 4)]) },
        { translateX: interpolate(p, [0, 0.55, 1], [0, 3, -2]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: bubble.left * width,
          bottom: 0,
          width: bubble.size,
          height: bubble.size,
          borderRadius: 999,
          backgroundColor: color,
        },
        rise,
      ]}
    />
  );
}

function RadonScene({ intensity, width, height, palette, reduceMotion }: SceneProps) {
  // Web rises 6/10/14 bubbles by EPA zone — mobile compresses to 4/6/8.
  const bubbles = RADON_BUBBLES.slice(0, 4 + intensity * 2);
  return (
    <>
      {bubbles.map((bubble, i) => (
        <RadonBubble
          key={i}
          width={width}
          height={height}
          bubble={bubble}
          color={palette.honey}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

// ── Air — long soft breeze streaks; mint / honey / coral by AQI band ─────────

const WATER_RIPPLES = [
  { left: 0.18, bottom: 12, w: 44, h: 10, durMs: 4800, offset: 0.1 },
  { left: 0.48, bottom: 24, w: 58, h: 12, durMs: 6200, offset: 0.38 },
  { left: 0.74, bottom: 9, w: 36, h: 8, durMs: 5400, offset: 0.66 },
] as const;

function WaterRipple({
  width,
  ripple,
  color,
  reduceMotion,
}: {
  width: number;
  ripple: (typeof WATER_RIPPLES)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(ripple.durMs, reduceMotion);
  const pulse = useAnimatedStyle(() => {
    const p = (phase.value + ripple.offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.18, 0.74, 1], [0, 0.18, 0.1, 0]),
      transform: [{ scaleX: interpolate(p, [0, 1], [0.68, 1.22]) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: ripple.left * width,
          bottom: ripple.bottom,
          width: ripple.w,
          height: ripple.h,
        },
        pulse,
      ]}
    >
      <Svg width={ripple.w} height={ripple.h} viewBox={`0 0 ${ripple.w} ${ripple.h}`}>
        <Ellipse
          cx={ripple.w / 2}
          cy={ripple.h / 2}
          rx={ripple.w / 2 - 1}
          ry={ripple.h / 2 - 1}
          stroke={color}
          strokeWidth={1.2}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

function WaterDrop({
  width,
  height,
  left,
  offset,
  color,
  reduceMotion,
}: {
  width: number;
  height: number;
  left: number;
  offset: number;
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(1800, reduceMotion);
  const fall = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.2, 0.84, 1], [0, 0.2, 0.18, 0]),
      transform: [{ translateY: interpolate(p, [0, 1], [-8, height * 0.72]) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: left * width,
          width: 2,
          height: 7,
          borderRadius: 999,
          backgroundColor: color,
        },
        fall,
      ]}
    />
  );
}

function WaterScene({ intensity, width, height, palette, reduceMotion }: SceneProps) {
  const color = intensity === 2 ? palette.coral : intensity === 1 ? palette.honey : palette.cool;
  const drops = intensity === 2 ? [0.28, 0.62, 0.82] : intensity === 1 ? [0.52] : [];
  return (
    <>
      {WATER_RIPPLES.map((ripple, i) => (
        <WaterRipple key={i} width={width} ripple={ripple} color={color} reduceMotion={reduceMotion} />
      ))}
      {drops.map((left, i) => (
        <WaterDrop
          key={left}
          width={width}
          height={height}
          left={left}
          offset={i * 0.29}
          color={color}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

const AIR_STREAKS = [
  { top: "20%", w: 130, durMs: 13000, offset: 0.18 },
  { top: "44%", w: 96, durMs: 16000, offset: 0.5 },
  { top: "64%", w: 116, durMs: 11000, offset: 0.74 },
] as const;

function AirLeaf({ width, color, reduceMotion }: { width: number; color: string; reduceMotion: boolean }) {
  const drift = useLoopPhase(9000, reduceMotion);
  const tumble = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      tumble.value = 0;
      return;
    }
    tumble.value = 0;
    tumble.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(tumble);
  }, [reduceMotion, tumble]);
  const track = useAnimatedStyle(() => {
    const p = (drift.value + 0.55) % 1;
    return { transform: [{ translateX: interpolate(p, [0, 1], [-0.12 * width, 1.06 * width]) }] };
  });
  const spin = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${tumble.value * 360}deg` },
      { translateY: interpolate(tumble.value, [0, 0.5, 1], [0, 2, 0]) },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: "34%" }, track]}>
      <Animated.View style={spin}>
        {/* two-arc leaf */}
        <Svg width={8} height={8} viewBox="0 0 10 10" opacity={0.3}>
          <Path d="M1 9 Q1 3 9 1 Q7 9 1 9 Z" fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function AirHaze({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const pulse = useBreathePhase(4500, reduceMotion, 0.5); // web: 9s full cycle
  const haze = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.06, 0.1]),
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: "18%",
          right: 8,
          width: 110,
          height: 40,
          borderRadius: 999,
          backgroundColor: color,
        },
        haze,
      ]}
    />
  );
}

function AirScene({ intensity, width, palette, reduceMotion }: SceneProps) {
  const color = intensity === 2 ? palette.coral : intensity === 1 ? palette.honey : palette.mint;
  const streaks = AIR_STREAKS.slice(0, Math.min(2 + intensity, 3));
  return (
    <>
      {streaks.map((s, i) => (
        <DriftStreak
          key={i}
          width={width}
          top={s.top}
          streakWidth={s.w}
          durMs={s.durMs}
          offset={s.offset}
          color={color}
          opacity={0.14}
          reduceMotion={reduceMotion}
        />
      ))}
      {intensity === 0 && <AirLeaf width={width} color={palette.mint} reduceMotion={reduceMotion} />}
      {intensity === 2 && <AirHaze color={palette.coral} reduceMotion={reduceMotion} />}
    </>
  );
}

// ── Neighborhood — skyline, honey windows lighting up, footstep cadence ──────

/** Skyline rects (x, y, w, h in a 220x36 box), same silhouette as the web. */
const HOUSING_BARS = [
  { x: 22, h: 15 },
  { x: 44, h: 24 },
  { x: 64, h: 18 },
  { x: 82, h: 30 },
] as const;

function HousingBar({
  index,
  x,
  h,
  color,
  intensity,
  reduceMotion,
}: {
  index: number;
  x: number;
  h: number;
  color: string;
  intensity: AmbientIntensity;
  reduceMotion: boolean;
}) {
  const phase = useBreathePhase(3200 + index * 420, reduceMotion, 0.45);
  const lift = intensity * 2;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(phase.value, [0, 1], [0, -lift]) }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: `${x}%`, bottom: 8 }, style]}>
      <Svg width={14} height={h + intensity * 4} viewBox={`0 0 14 ${h + intensity * 4}`}>
        <Rect
          x={2}
          y={0}
          width={10}
          height={h + intensity * 4}
          rx={3}
          fill={color}
          opacity={0.12 + intensity * 0.035}
        />
      </Svg>
    </Animated.View>
  );
}

function HousingScene({ intensity, palette, reduceMotion }: SceneProps) {
  const color = intensity === 2 ? palette.coral : intensity === 1 ? palette.honey : palette.mint;
  return (
    <>
      <Svg style={{ position: "absolute", left: "8%", right: "8%", bottom: 5 }} width="84%" height={30} viewBox="0 0 180 30">
        <Path d="M10 22 L24 12 L38 22 V29 H10 Z" fill={palette.ink} opacity={0.055} />
        <Rect x={18} y={22} width={6} height={7} rx={1.5} fill={color} opacity={0.18} />
        <Path d="M126 22 L140 12 L154 22 V29 H126 Z" fill={palette.ink} opacity={0.055} />
        <Rect x={134} y={22} width={6} height={7} rx={1.5} fill={color} opacity={0.18} />
        <Line x1={0} y1={29} x2={180} y2={29} stroke={palette.ink} strokeWidth={1} opacity={0.08} />
      </Svg>
      {HOUSING_BARS.map((bar, i) => (
        <HousingBar
          key={i}
          index={i}
          x={bar.x}
          h={bar.h}
          color={color}
          intensity={intensity}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

const EV_NODES = [
  { x: 0.24, y: 0.36, delay: 0.1 },
  { x: 0.48, y: 0.62, delay: 0.34 },
  { x: 0.72, y: 0.32, delay: 0.58 },
] as const;

function EvNode({
  width,
  height,
  node,
  color,
  reduceMotion,
}: {
  width: number;
  height: number;
  node: (typeof EV_NODES)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(2600, reduceMotion);
  const pulse = useAnimatedStyle(() => {
    const p = (phase.value + node.delay) % 1;
    return {
      opacity: interpolate(p, [0, 0.2, 0.62, 1], [0.18, 0.42, 0.18, 0.18]),
      transform: [{ scale: interpolate(p, [0, 0.2, 1], [0.88, 1.18, 0.88]) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: node.x * width,
          top: node.y * height,
          width: 7,
          height: 7,
          borderRadius: 999,
          backgroundColor: color,
        },
        pulse,
      ]}
    />
  );
}

function EvScene({ intensity, width, height, palette, reduceMotion }: SceneProps) {
  const color = intensity === 0 ? palette.ink : intensity === 1 ? palette.mint : palette.honey;
  const nodes = EV_NODES.slice(0, intensity === 0 ? 1 : intensity === 1 ? 2 : 3);
  const charge = useBreathePhase(1100, reduceMotion, 0.5);
  const boltStyle = useAnimatedStyle(() => ({
    opacity: intensity === 0 ? 0.12 : interpolate(charge.value, [0, 1], [0.22, 0.52]),
    transform: [{ scale: interpolate(charge.value, [0, 1], [0.96, 1.05]) }],
  }));
  return (
    <>
      <Svg style={{ position: "absolute", left: 0, top: 0 }} width="100%" height="100%" viewBox="0 0 180 72" preserveAspectRatio="none">
        <Path
          d="M28 36 C62 18 88 58 132 28"
          stroke={color}
          strokeWidth={1.2}
          fill="none"
          opacity={intensity === 0 ? 0.08 : 0.16}
          strokeDasharray="3 5"
        />
      </Svg>
      {nodes.map((node) => (
        <EvNode key={`${node.x}-${node.y}`} width={width} height={height} node={node} color={color} reduceMotion={reduceMotion} />
      ))}
      <Animated.View style={[{ position: "absolute", right: "14%", top: "24%" }, boltStyle]}>
        <Svg width={18} height={24} viewBox="0 0 18 24">
          <Polyline
            points="11,1 5,11 10,11 7,23"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </>
  );
}

const HOOD_BUILDINGS = [
  [0, 18, 28, 18],
  [32, 10, 22, 26],
  [58, 22, 30, 14],
  [92, 6, 24, 30],
  [120, 16, 28, 20],
  [152, 12, 26, 24],
  [182, 20, 30, 16],
] as const;

/** Six window dots (web lights 8) — positions in the same 220x36 box. */
const HOOD_WINDOWS = [
  [9, 24],
  [38, 16],
  [45, 22],
  [97, 11],
  [158, 17],
  [190, 25],
] as const;

const HOOD_STEPS = ["38%", "52%", "66%"] as const;
const WINDOW_CYCLE_MS = 12000;

function HoodWindow({
  x,
  y,
  index,
  color,
  reduceMotion,
}: {
  x: number;
  y: number;
  index: number;
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(WINDOW_CYCLE_MS, reduceMotion);
  const offset = (index * 1300) / WINDOW_CYCLE_MS;
  const glow = useAnimatedStyle(() => ({
    // Static fallback mirrors the web: windows read as softly lit (0.5).
    opacity: reduceMotion
      ? 0.5
      : interpolate((phase.value + offset) % 1, [0, 0.04, 0.4, 0.5, 1], [0, 0.7, 0.7, 0, 0]),
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: `${(x / 220) * 100}%`,
          top: y,
          width: 1.6,
          height: 1.6,
          backgroundColor: color,
        },
        glow,
      ]}
    />
  );
}

function HoodStep({
  left,
  index,
  cadenceMs,
  color,
  reduceMotion,
}: {
  left: `${number}%`;
  index: number;
  cadenceMs: number;
  color: string;
  reduceMotion: boolean;
}) {
  const periodMs = cadenceMs * 3.2;
  const phase = useLoopPhase(Math.round(periodMs), reduceMotion);
  const offset = (index * cadenceMs) / periodMs;
  const pulse = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 0.35
      : interpolate((phase.value + offset) % 1, [0, 0.1, 0.4, 0.6, 1], [0, 0.45, 0.45, 0, 0]),
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          bottom: 3,
          width: 3,
          height: 3,
          borderRadius: 999,
          backgroundColor: color,
        },
        pulse,
      ]}
    />
  );
}

function NeighborhoodScene({ intensity, palette, reduceMotion }: SceneProps) {
  // Footstep cadence from the walk band: above_average/most ~1.2s, else ~2.2s.
  const cadenceMs = intensity >= 1 ? 1200 : 2200;
  return (
    <>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 8, height: 36 }}>
        <Svg width="100%" height={36} viewBox="0 0 220 36" preserveAspectRatio="none">
          {HOOD_BUILDINGS.map(([x, y, w, h], i) => (
            <Rect key={i} x={x} y={y} width={w} height={h} fill={palette.ink} opacity={0.06} />
          ))}
        </Svg>
        {HOOD_WINDOWS.map(([x, y], i) => (
          <HoodWindow key={i} x={x} y={y} index={i} color={palette.honey} reduceMotion={reduceMotion} />
        ))}
      </View>
      {/* dotted walk path */}
      <Svg
        style={{ position: "absolute", left: "4%", right: "4%", bottom: 4 }}
        width="92%"
        height={2}
        opacity={0.12}
      >
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={palette.ink} strokeWidth={1} strokeDasharray="1,3" />
      </Svg>
      {HOOD_STEPS.map((left, i) => (
        <HoodStep
          key={i}
          left={left}
          index={i}
          cadenceMs={cadenceMs}
          color={palette.ink}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

// ── Weather — sun / cloud / rain by forecast ─────────────────────────────────

/** Eight rays at 45-degree steps around a 44x44 disc (r12 -> r17). */
const SUN_RAYS = [
  [34, 22, 39, 22],
  [30.5, 30.5, 34, 34],
  [22, 34, 22, 39],
  [13.5, 30.5, 10, 34],
  [10, 22, 5, 22],
  [13.5, 13.5, 10, 10],
  [22, 10, 22, 5],
  [30.5, 13.5, 34, 10],
] as const;

function SunScene({ palette, reduceMotion }: SceneProps) {
  const spin = useLoopPhase(60000, reduceMotion);
  const breathe = useBreathePhase(3500, reduceMotion, 0.5); // web: 7s full cycle
  const disc = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const rays = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.55, 1]),
  }));
  return (
    <Animated.View style={[{ position: "absolute", top: 6, right: "8%", width: 44, height: 44 }, disc]}>
      <Animated.View style={[StyleSheet.absoluteFill, rays]}>
        <Svg width={44} height={44} viewBox="0 0 44 44" opacity={0.16}>
          {SUN_RAYS.map(([x1, y1, x2, y2], i) => (
            <Line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={palette.honey}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </Svg>
      </Animated.View>
      <Svg
        style={StyleSheet.absoluteFill}
        width={44}
        height={44}
        viewBox="0 0 44 44"
        opacity={0.16}
      >
        <Circle cx={22} cy={22} r={8} fill={palette.honey} />
      </Svg>
    </Animated.View>
  );
}

function CloudPuff({
  top,
  right,
  width,
  height,
  driftPx,
  halfMs,
  opacity,
  color,
  reduceMotion,
}: {
  top: number;
  right: `${number}%`;
  width: number;
  height: number;
  driftPx: number;
  halfMs: number;
  opacity: number;
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useBreathePhase(halfMs, reduceMotion, 0);
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: phase.value * driftPx }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", top, right }, drift]}>
      <Svg width={width} height={height} viewBox="0 0 56 20" opacity={opacity}>
        <Ellipse cx={20} cy={12} rx={16} ry={7} fill={color} />
        <Ellipse cx={36} cy={10} rx={14} ry={8} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function CloudScene({ palette, reduceMotion }: SceneProps) {
  return (
    <>
      <CloudPuff
        top={10}
        right="24%"
        width={56}
        height={20}
        driftPx={-18}
        halfMs={15000}
        opacity={0.07}
        color={palette.ink}
        reduceMotion={reduceMotion}
      />
      <CloudPuff
        top={32}
        right="8%"
        width={44}
        height={16}
        driftPx={14}
        halfMs={20000}
        opacity={0.05}
        color={palette.ink}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

const RAIN_DROPS = Array.from({ length: 8 }, (_, i) => ({
  left: ((i * 29 + 6) % 92) / 100,
  durMs: Math.round((1.3 + ((i * 7) % 3) * 0.1) * 1000),
  offset: (i * 0.17) % 1,
}));

function RainDrop({
  width,
  height,
  drop,
  color,
  reduceMotion,
}: {
  width: number;
  height: number;
  drop: (typeof RAIN_DROPS)[number];
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useLoopPhase(drop.durMs, reduceMotion);
  const offset = drop.offset;
  const fall = useAnimatedStyle(() => {
    const p = (phase.value + offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.18, 0.82, 1], [0, 0.22, 0.22, 0]),
      transform: [
        { translateY: interpolate(p, [0, 1], [-10, height * 0.8]) },
        { translateX: interpolate(p, [0, 1], [0, -5]) },
        { rotate: "8deg" },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: drop.left * width,
          top: 0,
          width: 1.5,
          height: 6,
          borderRadius: 999,
          backgroundColor: color,
        },
        fall,
      ]}
    />
  );
}

function RainScene({ intensity, width, height, palette, reduceMotion }: SceneProps) {
  // Web falls 8/10/12 drops — mobile compresses to 4/6/8.
  const drops = RAIN_DROPS.slice(0, 4 + intensity * 2);
  return (
    <>
      {drops.map((drop, i) => (
        <RainDrop
          key={i}
          width={width}
          height={height}
          drop={drop}
          color={palette.cool}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

// ── Scene switch + layer component ───────────────────────────────────────────

function FogScene({ palette, reduceMotion }: SceneProps) {
  return (
    <>
      <CloudPuff
        top={12}
        right="24%"
        width={68}
        height={20}
        driftPx={-12}
        halfMs={12000}
        opacity={0.055}
        color={palette.ink}
        reduceMotion={reduceMotion}
      />
      <CloudPuff
        top={32}
        right="7%"
        width={72}
        height={18}
        driftPx={10}
        halfMs={16000}
        opacity={0.045}
        color={palette.ink}
        reduceMotion={reduceMotion}
      />
      <View style={{ position: "absolute", left: "12%", right: "6%", bottom: 12, gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <LinearGradient
            key={i}
            colors={[withAlpha(palette.ink, "00"), withAlpha(palette.ink, "26"), withAlpha(palette.ink, "00")]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ height: 1, borderRadius: 999, opacity: 0.7 - i * 0.12 }}
          />
        ))}
      </View>
    </>
  );
}

function HeatLine({
  left,
  height,
  color,
  reduceMotion,
}: {
  left: `${number}%`;
  height: number;
  color: string;
  reduceMotion: boolean;
}) {
  const phase = useBreathePhase(1700, reduceMotion, 0.4);
  const shimmer = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 1], [0.08, 0.18]),
    transform: [
      { translateY: interpolate(phase.value, [0, 1], [2, -2]) },
      { skewX: `${interpolate(phase.value, [0, 1], [-6, 6])}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          bottom: 9,
          width: 2,
          height,
          borderRadius: 999,
          backgroundColor: color,
        },
        shimmer,
      ]}
    />
  );
}

function HeatScene({ palette, reduceMotion }: SceneProps) {
  return (
    <>
      <SunScene intensity={2} width={0} height={0} palette={palette} reduceMotion={reduceMotion} />
      {(["48%", "58%", "68%"] as const).map((left, i) => (
        <HeatLine key={left} left={left} height={22 + i * 5} color={palette.honey} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}

function AmbientScene({
  kind,
  variant,
  ...scene
}: SceneProps & { kind: AmbientKind; variant?: AmbientVariant }) {
  switch (kind) {
    case "flood":
      return <FloodScene {...scene} />;
    case "school":
      return <SchoolScene {...scene} />;
    case "hazard":
      if (variant === "lightning") return <LightningScene {...scene} />;
      if (variant === "winter") return <WinterScene {...scene} />;
      return <WindScene {...scene} />;
    case "radon":
      return <RadonScene {...scene} />;
    case "water":
      return <WaterScene {...scene} />;
    case "air":
      return <AirScene {...scene} />;
    case "housing":
      return <HousingScene {...scene} />;
    case "evCharging":
      return <EvScene {...scene} />;
    case "neighborhood":
      return <NeighborhoodScene {...scene} />;
    case "weather":
      if (variant === "storm") return <LightningScene {...scene} />;
      if (variant === "snow" || variant === "cold") return <WinterScene {...scene} />;
      if (variant === "fog") return <FogScene {...scene} />;
      if (variant === "heat") return <HeatScene {...scene} />;
      if (variant === "wind") return <WindScene {...scene} />;
      if (variant === "rain") return <RainScene {...scene} />;
      if (variant === "cloud") return <CloudScene {...scene} />;
      return <SunScene {...scene} />;
  }
}

function clampIntensity(value: number): AmbientIntensity {
  const n = Math.round(value);
  return n <= 0 ? 0 : n >= 2 ? 2 : 1;
}

/**
 * The ambient layer for one HomeDossierCard section row. Fills most of the row
 * from the right side (the host row clips it implicitly via this layer's own
 * overflow:hidden), never intercepts touches, and is hidden from assistive
 * tech. A card-colored gradient fades the scene's left edge so the row's
 * text zone stays crisp — the RN stand-in for the web layer's
 * mask-image: linear-gradient(to right, transparent, black 30%).
 */
export function DossierAmbient({
  kind,
  intensity,
  variant,
}: {
  kind: AmbientKind;
  intensity: number;
  variant?: AmbientVariant;
}) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  // Seed a sensible default (≈ a dossier row's right-side layer) so the scene
  // renders on first paint and corrects on the first onLayout — instead of
  // staying blank until measurement lands, which silently never happens if the
  // host row is collapsed / display:none-then-revealed / measured late.
  const [size, setSize] = useState({ w: 240, h: 64 });
  const level = clampIntensity(intensity);
  const palette = useMemo<Palette>(
    () => ({
      ink: theme.colors.text,
      cool: theme.colors.primary,
      honey: theme.colors.accent,
      mint: theme.colors.success,
      coral: theme.colors.error,
    }),
    [theme],
  );
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
      onLayout={onLayout}
    >
      {size.w > 0 && size.h > 0 && (
        <AmbientScene
          kind={kind}
          variant={variant}
          intensity={level}
          width={size.w}
          height={size.h}
          palette={palette}
          reduceMotion={reduceMotion}
        />
      )}
      <LinearGradient
        colors={[theme.colors.card, withAlpha(theme.colors.card, "00")]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.fade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "74%",
    overflow: "hidden",
  },
  // Fades the scene out toward the text side.
  fade: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "44%",
  },
});
