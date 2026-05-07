import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

interface LogoBrandProps {
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: 36,
  md: 72,
  lg: 96,
} as const;

// Edition VI · Champagne & Rose. Mirrors apps/web/public/logo-mark.svg and
// apps/web/src/components/marketing/logo.tsx so the mobile auth screens read
// as the same brand as the web sign-in.
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
              <Stop offset="0%" stopColor="#1A2438" />
              <Stop offset="60%" stopColor="#131C2C" />
              <Stop offset="100%" stopColor="#0A0F18" />
            </LinearGradient>
            <RadialGradient id="lf-glow" cx="72%" cy="24%" r="62%">
              <Stop offset="0%" stopColor="#F4E4D0" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#F4E4D0" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="lf-foil" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor="#B8936C" />
              <Stop offset="45%" stopColor="#E5C9A8" />
              <Stop offset="100%" stopColor="#F4E4D0" />
            </LinearGradient>
            <LinearGradient id="lf-rose" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#EDB99D" />
              <Stop offset="100%" stopColor="#A85A42" />
            </LinearGradient>
          </Defs>

          <Rect width="100" height="100" rx="22" fill="url(#lf-bg)" />
          <Rect width="100" height="100" rx="22" fill="url(#lf-glow)" />

          <Path
            d="M20 65 Q 30 32, 50 48 T 80 40"
            stroke="url(#lf-foil)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx="20" cy="65" r="5.5" fill="url(#lf-foil)" />
          <Circle cx="20" cy="65" r="1.7" fill="#0A0F18" />
          <Circle cx="80" cy="40" r="9" fill="url(#lf-rose)" />
          <Circle cx="80" cy="40" r="3" fill="#F5F1EA" />
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
