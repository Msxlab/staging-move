import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={theme.colors.primary} accessible={false} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function LoadingOverlay() {
  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <View style={styles.overlayBox}>
        <ActivityIndicator size="large" color={theme.colors.primary} accessible={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    gap: 16,
  },
  text: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  overlayBox: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.lg,
  },
});
