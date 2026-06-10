import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Path,
  Circle,
  Ellipse,
} from "react-native-svg";

interface LogoBrandProps {
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: 36,
  md: 72,
  lg: 96,
} as const;

// Edition VII · Aurora — the box-raccoon identity tile. Mirrors the production
// app icon (apps/mobile/assets/icon.svg / design handoff app-icon-mascot.svg)
// so the in-app brand mark, the launcher icon, the favicon, and the splash all
// read as ONE identity ("app icon, fav icon, hepsi maskotla birleşsin").
// Geometry is the canonical 100-unit box-raccoon group on the navy tile with
// the aurora glow; mask gradient is the violet-free cool ramp.
export function LogoBrand({ size = "md" }: LogoBrandProps) {
  const markSize = SIZES[size];

  return (
    <View style={styles.container}>
      <View style={styles.iconShadow}>
        <Svg
          width={markSize}
          height={markSize}
          viewBox="0 0 100 100"
          fill="none"
        >
          <Defs>
            <LinearGradient id="lf-bg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#131C2C" />
              <Stop offset="55%" stopColor="#0A0F18" />
              <Stop offset="100%" stopColor="#06080F" />
            </LinearGradient>
            <RadialGradient id="lf-glow" cx="36%" cy="28%" r="85%">
              <Stop offset="0%" stopColor="#7FB6E8" stopOpacity="0.32" />
              <Stop offset="55%" stopColor="#7FB6E8" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#06080F" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient
              id="lf-mask"
              x1="22"
              y1="44"
              x2="78"
              y2="26"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#56A8F0" />
              <Stop offset="100%" stopColor="#9CCBF2" />
            </LinearGradient>
            <LinearGradient
              id="lf-fur"
              x1="50"
              y1="6"
              x2="50"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#D9E2EE" />
              <Stop offset="100%" stopColor="#9DAAC0" />
            </LinearGradient>
            <LinearGradient
              id="lf-box"
              x1="26"
              y1="56"
              x2="74"
              y2="92"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#8FC0EE" />
              <Stop offset="100%" stopColor="#5C9DDC" />
            </LinearGradient>
          </Defs>

          <Rect width="100" height="100" rx="22" fill="url(#lf-bg)" />
          <Rect width="100" height="100" rx="22" fill="url(#lf-glow)" />

          {/* Box-raccoon art, scaled from the 100-unit master into the tile
              with a small safe margin (matches the launcher icon's framing). */}
          <G transform="translate(8.5, 5.5) scale(0.83)">
            <Path d="M33 24 Q24 4 43 16 Q40 22 33 24 Z" fill="url(#lf-fur)" />
            <Path d="M67 24 Q76 4 57 16 Q60 22 67 24 Z" fill="url(#lf-fur)" />
            <Path d="M35 21 Q29 9 42 16 Q39 19 35 21 Z" fill="#6B788E" />
            <Path d="M65 21 Q71 9 58 16 Q61 19 65 21 Z" fill="#6B788E" />
            <Path
              d="M50 13 C33 13 27 27 27 39 C27 52 38 60 50 60 C62 60 73 52 73 39 C73 27 67 13 50 13 Z"
              fill="url(#lf-fur)"
            />
            <Path d="M50 18 Q45 31 50 41 Q55 31 50 18 Z" fill="#EEF3FA" />
            <Ellipse cx="50" cy="48" rx="14" ry="11" fill="#EEF3FA" />
            <G fill="url(#lf-mask)">
              <Path d="M29 35 Q36 28 45 32 Q50 35 48 40 Q45 46 36 45 Q28 44 29 35 Z" />
              <Path d="M71 35 Q64 28 55 32 Q50 35 52 40 Q55 46 64 45 Q72 44 71 35 Z" />
              <Path d="M45 33 Q50 31 55 33 L55 39 Q50 36 45 39 Z" />
            </G>
            <Circle cx="40" cy="37" r="5.4" fill="#0B1018" />
            <Circle cx="60" cy="37" r="5.4" fill="#0B1018" />
            <Circle cx="41.6" cy="35.4" r="2" fill="#EEF3FA" />
            <Circle cx="61.6" cy="35.4" r="2" fill="#EEF3FA" />
            <Path
              d="M50 44 q-3.6 0 -3.6 3 q0 3 3.6 3.7 q3.6 -0.7 3.6 -3.7 q0 -3 -3.6 -3 z"
              fill="#3D4A5E"
            />
            <Path
              d="M45 53 q5 4 10 0"
              stroke="#6B788E"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <Path d="M24 60 L50 56 L76 60 L76 64 L24 64 Z" fill="#B7D6F2" />
            <Path d="M24 64 L50 67 L50 90 L24 87 Z" fill="url(#lf-box)" />
            <Path d="M76 64 L50 67 L50 90 L76 87 Z" fill="#4E8CCB" />
            <Path
              d="M50 56 L50 90"
              stroke="#EAF2FB"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />
            <Path
              d="M24 62 L50 65 L76 62"
              stroke="#EAF2FB"
              strokeWidth="1.6"
              fill="none"
              opacity="0.7"
            />
            <Ellipse cx="30" cy="61" rx="6" ry="5" fill="#8A98AE" />
            <Ellipse cx="70" cy="61" rx="6" ry="5" fill="#8A98AE" />
            <Path
              d="M27 60 l1.6 0 M30 60 l1.6 0 M33 60 l1.6 0"
              stroke="#5E6B80"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <Path
              d="M67 60 l1.6 0 M70 60 l1.6 0 M73 60 l1.6 0"
              stroke="#5E6B80"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </G>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  iconShadow: {
    borderRadius: 22,
    shadowColor: "#7FB6E8",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
