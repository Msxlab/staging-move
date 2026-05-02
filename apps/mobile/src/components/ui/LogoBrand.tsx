import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

interface LogoBrandProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const SIZES = {
  sm: { icon: 32, fontSize: 0, gap: 0 },
  md: { icon: 48, fontSize: 22, gap: 10 },
  lg: { icon: 72, fontSize: 30, gap: 14 },
} as const;

// Edition VI · Champagne & Rose. Mirrors apps/web/public/logo-mark.svg and
// apps/web/src/components/marketing/logo.tsx so the mobile auth screens read
// as the same brand as the web sign-in.
export function LogoBrand({ size = "md", showText = true }: LogoBrandProps) {
  const s = SIZES[size];
  const markSize = s.icon;

  return (
    <View style={styles.container}>
      <Svg
        width={markSize}
        height={markSize}
        viewBox="0 0 100 100"
        fill="none"
      >
        <Defs>
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

        <Path
          d="M20 65 Q 30 32, 50 48 T 80 40"
          stroke="url(#lf-foil)"
          strokeWidth="3.25"
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx="20" cy="65" r="4.5" fill="url(#lf-foil)" />
        <Circle cx="20" cy="65" r="1.5" fill="#0E0A07" />
        <Circle cx="80" cy="40" r="7.25" fill="url(#lf-rose)" />
        <Circle cx="80" cy="40" r="2.5" fill="#F5F1EA" />
      </Svg>

      {showText && s.fontSize > 0 && (
        <Text style={[styles.brandText, { fontSize: s.fontSize, marginTop: s.gap }]}>
          <Text style={styles.brandLocate}>Locate</Text>
          <Text style={styles.brandFlow}>flow</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  brandText: {
    letterSpacing: -0.55,
    fontFamily: "Fraunces_400Regular",
  },
  brandLocate: {
    color: "#F5F1EA",
    fontFamily: "Fraunces_400Regular",
  },
  brandFlow: {
    // Italic foil "flow" — falls back to color-only if Fraunces italic isn't
    // loaded yet (the variable font is loaded at app init in app/_layout.tsx).
    color: "#E5C9A8",
    fontStyle: "italic",
    fontFamily: "Fraunces_400Regular_Italic",
  },
});
