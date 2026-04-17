import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

interface AvatarProps {
  initials: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function Avatar({ initials, size = 40, color = theme.colors.primary, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + "20",
          borderColor: color + "40",
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38, color }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
