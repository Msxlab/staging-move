import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { getIconForEmoji } from "@/lib/icon-map";
import { useAppTheme, type Theme } from "@/lib/theme";

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
  color,
  bgColor,
  showBg = false,
}: CategoryIconProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tint = color ?? theme.colors.textSecondary;
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
        <Icon size={size} color={tint} />
      </View>
    );
  }

  return <Icon size={size} color={tint} />;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
});
