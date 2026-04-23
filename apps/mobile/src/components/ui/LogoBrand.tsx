import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  G,
} from "react-native-svg";
import { theme } from "@/lib/theme";

interface LogoBrandProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const SIZES = {
  sm: { icon: 32, fontSize: 0, gap: 0 },
  md: { icon: 48, fontSize: 20, gap: 8 },
  lg: { icon: 72, fontSize: 28, gap: 12 },
} as const;

export function LogoBrand({ size = "md", showText = true }: LogoBrandProps) {
  const s = SIZES[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconWrap,
          {
            width: s.icon,
            height: s.icon,
            borderRadius: s.icon * 0.3,
          },
        ]}
      >
        <Svg
          width={s.icon * 0.7}
          height={s.icon * 0.7}
          viewBox="0 0 64 64"
          fill="none"
        >
          <Defs>
            {/* Edition VI · pin draws from rose-light → rose for the body. */}
            <LinearGradient id="pinGrad" x1="20" y1="8" x2="44" y2="56">
              <Stop offset="0%" stopColor="#EDB99D" />
              <Stop offset="100%" stopColor="#D4846A" />
            </LinearGradient>
            {/* Inner dot — full foil gradient (the brand's hero treatment). */}
            <LinearGradient id="dotGrad" x1="26" y1="30" x2="38" y2="42">
              <Stop offset="0%" stopColor="#F4E4D0" />
              <Stop offset="50%" stopColor="#E5C9A8" />
              <Stop offset="100%" stopColor="#B8936C" />
            </LinearGradient>
            {/* Flow waves arc from rose into foil — the wordmark "flow". */}
            <LinearGradient id="waveGrad" x1="12" y1="48" x2="52" y2="48">
              <Stop offset="0%" stopColor="#D4846A" stopOpacity="0.6" />
              <Stop offset="50%" stopColor="#E5C9A8" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#B8936C" stopOpacity="0.4" />
            </LinearGradient>
          </Defs>
          {/* Subtle glow */}
          <Circle cx="32" cy="32" r="22" fill="#D4846A" opacity={0.06} />
          {/* Pin body outline */}
          <Path
            d="M32 10C32 10 18 26 18 36C18 43.7 24.3 50 32 50C39.7 50 46 43.7 46 36C46 26 32 10 32 10Z"
            stroke="url(#pinGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#pinGrad)"
            fillOpacity={0.08}
          />
          {/* Inner dot */}
          <Circle cx="32" cy="35" r="6" fill="url(#dotGrad)" />
          {/* Flow waves */}
          <Path
            d="M16 50C20 47 24 51 28 48C32 45 36 49 40 46C44 43 48 47 52 45"
            stroke="url(#waveGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M14 54C18 51 22 55 26 52C30 49 34 53 38 50C42 47 46 51 50 49"
            stroke="url(#waveGrad)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity={0.4}
          />
        </Svg>
      </View>
      {showText && s.fontSize > 0 && (
        <Text style={[styles.brandText, { fontSize: s.fontSize, marginTop: s.gap }]}>
          <Text style={styles.brandLocate}>Locate</Text>
          <Text style={styles.brandFlow}>Flow</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212, 132, 106, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(212, 132, 106, 0.25)",
    ...theme.shadow.glow,
  },
  brandText: {
    // Edition VI wordmark — Fraunces light, italic em on "Flow" with foil.
    fontFamily: "Fraunces-Light",
    letterSpacing: -0.5,
  },
  brandLocate: {
    color: "#F5F1EA",
    fontFamily: "Fraunces-Light",
  },
  brandFlow: {
    color: "#E5C9A8",
    fontFamily: "Fraunces-LightItalic",
  },
});
