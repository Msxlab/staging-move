import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, G, Rect, Ellipse } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";

/**
 * MoveRouteMap — the Moving tab hero's "Live move intelligence" route (D16).
 *
 * Parity with Move.dc.html (mv-dash / mv-travel): an abstract OSM-style map with
 * a gold DASHED route whose dashes MARCH (animated strokeDashoffset) and a
 * RACCOON-AS-TRUCK marker that travels from origin → destination along the same
 * curved Path, plus a glass "N mi route preview · arrival in N days" label.
 *
 * react-native-svg has no CSS `offset-path`, so the marker is positioned by
 * sampling the route's two cubic Béziers in JS and driving an Animated <G>'s
 * translate from a single shared progress value (0 → 1 → hold). Both motions are
 * reduce-motion-safe: dashes sit still and the truck rests at the destination.
 *
 * Additive + presentational: every value comes from the screen's real featured
 * move; `distanceMiles` is null when origin/destination coordinates are absent,
 * in which case the label falls back to the city pair + arrival-in-N-days only.
 */

// The route geometry, shared by the base, the marching dash overlay and the
// marker sampler. Two cubic segments — identical to the design handoff.
const ROUTE_D = "M44 124 C92 92 120 108 156 78 C196 46 226 60 262 36";
const ROUTE_SEGMENTS = [
  // [p0, c1, c2, p3] for each cubic Bézier segment.
  [
    { x: 44, y: 124 },
    { x: 92, y: 92 },
    { x: 120, y: 108 },
    { x: 156, y: 78 },
  ],
  [
    { x: 156, y: 78 },
    { x: 196, y: 46 },
    { x: 226, y: 60 },
    { x: 262, y: 36 },
  ],
] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

type Pt = { x: number; y: number };

/** Cubic Bézier point at parameter u∈[0,1] for one segment. Pure. */
function cubicAt(seg: readonly Pt[], u: number): Pt {
  const mu = 1 - u;
  const a = mu * mu * mu;
  const b = 3 * mu * mu * u;
  const c = 3 * mu * u * u;
  const d = u * u * u;
  return {
    x: a * seg[0].x + b * seg[1].x + c * seg[2].x + d * seg[3].x,
    y: a * seg[0].y + b * seg[1].y + c * seg[2].y + d * seg[3].y,
  };
}

/** Sample the whole route at t∈[0,1] (two equal-weight segments). Pure. */
function routeAt(t: number): Pt {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) return cubicAt(ROUTE_SEGMENTS[0], clamped / 0.5);
  return cubicAt(ROUTE_SEGMENTS[1], (clamped - 0.5) / 0.5);
}

export interface MoveRouteMapProps {
  fromCity: string;
  fromState?: string;
  toCity: string;
  toState?: string;
  /** Pre-localized move-date label (e.g. "Aug 14, 2026"). */
  dateLabel: string;
  /** Whole days until the move, or null when not derivable. */
  days: number | null;
  /** Real great-circle distance in miles, or null when coordinates are absent. */
  distanceMiles: number | null;
  /** Localized "{{count}} days left" string (matches the screen's i18n). */
  daysLeftLabel?: string;
  /** Localized "route preview" suffix; defaults to English. */
  routePreviewLabel?: string;
  /** Localized "arrival in N days" line; falls back to the date label. */
  arrivalLabel?: string | null;
  /** Localized status fallback shown when there is no positive countdown. */
  statusFallback?: string;
  fromLabel: string;
  toLabel: string;
}

/** US-style grouped integer (1742 → "1,742"). Locale-agnostic + dependency-free. */
function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function MoveRouteMap({
  fromCity,
  fromState,
  toCity,
  toState,
  dateLabel,
  days,
  distanceMiles,
  routePreviewLabel = "mi route preview",
  arrivalLabel,
  statusFallback,
  fromLabel,
  toLabel,
}: MoveRouteMapProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  // Single 0→1 progress channel feeds BOTH the marching dashes and the truck.
  // Under reduce-motion it is pinned (dashes still, truck at destination).
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  // Marching dashes: one dash+gap is 18px (9 9); march a full cycle each loop.
  const dashProps = useAnimatedProps(() => ({
    strokeDashoffset: reduceMotion ? 0 : -18 - progress.value * 18,
  }));

  // Traveling truck: sample the route at the current progress and translate.
  // The marker SVG is authored around (0,0); the design's translate(-8,-7)
  // recenters it on the path.
  const truckProps = useAnimatedProps(() => {
    "worklet";
    // Hold at the destination for the loop's tail (design's 80%→100% rest).
    const t = Math.min(1, progress.value / 0.8);
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    // Inline the cubic control points — worklets can't reach module-scope refs.
    // Segment A: (44,124)(92,92)(120,108)(156,78) · B: (156,78)(196,46)(226,60)(262,36)
    const p0x = clamped <= 0.5 ? 44 : 156;
    const p0y = clamped <= 0.5 ? 124 : 78;
    const p1x = clamped <= 0.5 ? 92 : 196;
    const p1y = clamped <= 0.5 ? 92 : 46;
    const p2x = clamped <= 0.5 ? 120 : 226;
    const p2y = clamped <= 0.5 ? 108 : 60;
    const p3x = clamped <= 0.5 ? 156 : 262;
    const p3y = clamped <= 0.5 ? 78 : 36;
    const u = clamped <= 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
    const mu = 1 - u;
    const a = mu * mu * mu;
    const b = 3 * mu * mu * u;
    const c = 3 * mu * u * u;
    const d = u * u * u;
    const x = a * p0x + b * p1x + c * p2x + d * p3x;
    const y = a * p0y + b * p1y + c * p2y + d * p3y;
    return { transform: `translate(${x - 8}, ${y - 7})` };
  });

  // Reduced-motion resting position (destination), used for the static fallback.
  const restPt = routeAt(1);

  const rc = theme.colors.raccoon;
  const gold = theme.colors.primary;

  // Glass-label content. Real distance → "1,742 mi route preview"; otherwise the
  // city pair carries the route and we show only date + arrival-in-N-days.
  const hasDistance = distanceMiles != null && Number.isFinite(distanceMiles) && distanceMiles > 0;
  const arrivalLine =
    days != null && days > 0 ? (arrivalLabel ?? `arrival in ${days} days`) : (statusFallback ?? dateLabel);

  return (
    <View style={styles.map}>
      <Svg
        viewBox="0 0 300 158"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
      >
        {/* Abstract OSM-style grid (parity with the static handoff) */}
        <G stroke={theme.colors.mapGrid} strokeWidth={1}>
          <Path d="M-10 40 C60 28 110 56 180 40 C240 26 280 44 320 32" fill="none" />
          <Path d="M-10 96 C60 80 120 104 190 88 C250 74 290 96 320 78" fill="none" />
          <Path d="M40 -10 C52 50 36 110 50 168" fill="none" />
          <Path d="M150 -10 C140 50 160 110 150 168" fill="none" />
          <Path d="M250 -10 C258 50 244 110 256 168" fill="none" />
        </G>

        {/* Route — soft base under a marching gold dashed line */}
        <Path
          d={ROUTE_D}
          stroke={theme.colors.mapRouteBase}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          d={ROUTE_D}
          stroke={gold}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray="9 9"
          fill="none"
          animatedProps={dashProps}
        />

        {/* Endpoints */}
        <Circle cx={44} cy={124} r={5} fill={theme.colors.background} stroke={theme.colors.info} strokeWidth={2.4} />
        <Circle cx={262} cy={36} r={5} fill={theme.colors.background} stroke={gold} strokeWidth={2.4} />

        {/* Raccoon-as-truck marker traveling the route (design: mv-travel) */}
        {reduceMotion ? (
          <G transform={`translate(${restPt.x - 8}, ${restPt.y - 7})`}>
            <RaccoonTruck gold={gold} goldLt={theme.colors.accent} head={rc.head} mask={rc.mask} />
          </G>
        ) : (
          <AnimatedG animatedProps={truckProps}>
            <RaccoonTruck gold={gold} goldLt={theme.colors.accent} head={rc.head} mask={rc.mask} />
          </AnimatedG>
        )}
      </Svg>

      {/* City tags */}
      <View style={[styles.mapTag, styles.mapTagFrom]}>
        <Text style={styles.mapTagTitleInfo} numberOfLines={1}>
          {fromCity}{fromState ? `, ${fromState}` : ""}
        </Text>
        <Text style={styles.mapTagSub}>{fromLabel}</Text>
      </View>
      <View style={[styles.mapTag, styles.mapTagTo]}>
        <Text style={styles.mapTagTitleAccent} numberOfLines={1}>
          {toCity}{toState ? `, ${toState}` : ""}
        </Text>
        <Text style={styles.mapTagSub}>{toLabel}</Text>
      </View>

      {/* Glass "route preview" label */}
      <View style={styles.mapFoot}>
        <Text style={styles.mapFootTitle} numberOfLines={1}>
          {hasDistance ? `${groupThousands(distanceMiles!)} ${routePreviewLabel}` : dateLabel}
        </Text>
        <Text style={styles.mapFootSub} numberOfLines={1}>
          {arrivalLine}
        </Text>
      </View>
    </View>
  );
}

/** The small gold truck with raccoon ears + masked eyes (design lines 258-267). */
function RaccoonTruck({ gold, goldLt, head, mask }: { gold: string; goldLt: string; head: string; mask: string }) {
  return (
    <G>
      <Ellipse cx={7} cy={11.5} rx={8} ry={1.6} fill="#000" opacity={0.28} />
      <Rect x={0} y={2} width={9.5} height={8} rx={1.5} fill={gold} />
      <Rect x={9} y={4} width={5} height={6} rx={1} fill={goldLt} />
      <Rect x={10} y={5.2} width={3} height={3} rx={0.5} fill={mask} opacity={0.6} />
      <Circle cx={3} cy={2.2} r={1.3} fill={head} />
      <Circle cx={6} cy={2.2} r={1.3} fill={head} />
      <Circle cx={3.2} cy={10.4} r={1.7} fill={mask} />
      <Circle cx={11} cy={10.4} r={1.7} fill={mask} />
    </G>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    map: {
      position: "relative",
      height: 158,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: theme.colors.mapBg[1],
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mapTag: {
      position: "absolute",
      top: 10,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: theme.colors.glassPane,
      borderWidth: 1,
    },
    mapTagFrom: { left: 10, borderColor: theme.colors.border },
    mapTagTo: { right: 10, borderColor: theme.colors.accentBorder, alignItems: "flex-end" },
    mapTagTitleInfo: { color: theme.colors.info, fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 0.6, textTransform: "uppercase" },
    mapTagTitleAccent: { color: theme.colors.primary, fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 0.6, textTransform: "uppercase" },
    mapTagSub: { color: theme.colors.faint, fontSize: 8, marginTop: 1 },
    mapFoot: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.glassPane,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
    mapFootTitle: { color: theme.colors.text, fontSize: 10, fontFamily: fonts.sansBold, flexShrink: 1 },
    mapFootSub: { color: theme.colors.faint, fontSize: 8, flexShrink: 0 },
  });
