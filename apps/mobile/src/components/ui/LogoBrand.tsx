import React from "react";
import { Image, View, StyleSheet } from "react-native";

interface LogoBrandProps {
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: 36,
  md: 72,
  lg: 96,
} as const;

const RACCOON_ICON = require("../../../assets/icon.png");

// Raccoon identity. Mirrors the active launcher/PWA icon sources so the app
// icon, favicon, and JS splash read as one mark.
export function LogoBrand({ size = "md" }: LogoBrandProps) {
  const markSize = SIZES[size];

  return (
    <View style={styles.container}>
      <View style={styles.iconShadow}>
        <Image
          source={RACCOON_ICON}
          resizeMode="contain"
          style={{
            width: markSize,
            height: markSize,
            borderRadius: markSize * 0.22,
          }}
        />
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
    shadowColor: "#5B8DEF",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
