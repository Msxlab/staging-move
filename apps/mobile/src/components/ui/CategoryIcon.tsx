import React from "react";
import { View, StyleSheet } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { getIconForEmoji } from "@/lib/icon-map";
import { theme } from "@/lib/theme";

interface CategoryIconProps {
  emoji: string;
  size?: number;
  color?: string;
  bgColor?: string;
  showBg?: boolean;
}

export function CategoryIcon({
  emoji,
  size = 16,
  color = theme.colors.textSecondary,
  bgColor,
  showBg = false,
}: CategoryIconProps) {
  const Icon = getIconForEmoji(emoji) || ClipboardList;

  if (showBg) {
    const boxSize = size * 2.2;
    return (
      <View
        style={[
          styles.iconBox,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: boxSize * 0.3,
            backgroundColor: bgColor || theme.colors.primaryFaded,
          },
        ]}
      >
        <Icon size={size} color={color} />
      </View>
    );
  }

  return <Icon size={size} color={color} />;
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
});
