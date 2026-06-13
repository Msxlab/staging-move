import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";

export function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.iconWrap}>
          <ShieldCheck size={26} color={theme.colors.primary} />
        </View>
        <Text style={styles.kicker}>SECURE ACCESS</Text>
        <Text style={styles.title}>{t("auth.oauthCompleting")}</Text>
        <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  panel: {
    width: "100%",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
  },
  kicker: {
    marginTop: 14,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    color: theme.colors.accent,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  spinner: {
    marginTop: 18,
  },
});
