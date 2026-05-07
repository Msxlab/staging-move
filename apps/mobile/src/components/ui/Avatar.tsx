import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/theme";

interface AvatarProps {
  initials: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function Avatar({ initials, size = 40, color, style }: AvatarProps) {
  const theme = useAppTheme();
  const tint = color ?? theme.colors.primary;
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint + "20",
          borderColor: tint + "40",
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38, color: tint }]}>{initials}</Text>
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
