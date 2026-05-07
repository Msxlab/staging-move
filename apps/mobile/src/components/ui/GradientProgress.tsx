import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme, type Theme } from "@/lib/theme";

interface GradientProgressProps {
  progress: number; // 0-100
  height?: number;
  animated?: boolean;
  colors?: readonly [string, string];
  trackColor?: string;
  style?: object;
}

export function GradientProgress({
  progress,
  height = 6,
  animated = true,
  colors,
  trackColor,
  style,
}: GradientProgressProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const animWidth = useRef(new Animated.Value(0)).current;
  const clamped = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    if (animated) {
      Animated.timing(animWidth, {
        toValue: clamped,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      animWidth.setValue(clamped);
    }
  }, [clamped, animated]);

  const gradientColors = colors || theme.colors.gradient.primary;

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor || "rgba(255, 255, 255, 0.06)",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: height / 2,
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={[gradientColors[0], gradientColors[1]]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.gradient, { borderRadius: height / 2 }]}
        />
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  track: {
    overflow: "hidden",
  },
  fill: {
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
  },
});
