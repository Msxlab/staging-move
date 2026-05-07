import React, { useMemo } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const resolvedMessage = message ?? t("common.loading");
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={resolvedMessage} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={theme.colors.primary} accessible={false} />
      <Text style={styles.text}>{resolvedMessage}</Text>
    </View>
  );
}

export function LoadingOverlay() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="progressbar" accessibilityLabel={t("common.loadingLabel")} accessibilityLiveRegion="polite">
      <View style={styles.overlayBox}>
        <ActivityIndicator size="large" color={theme.colors.primary} accessible={false} />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
