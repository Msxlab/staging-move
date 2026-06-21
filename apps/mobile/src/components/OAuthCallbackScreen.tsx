import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { MoveRaccoon, HeroCard } from "@/components/move";

export function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      <HeroCard style={styles.panel}>
        <View style={styles.brandBadge}>
          <MoveRaccoon size={56} mood="calm" />
        </View>
        <Text style={styles.kicker}>SECURE ACCESS</Text>
        <Text style={styles.title}>{t("auth.oauthCompleting")}</Text>
        <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
      </HeroCard>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  panel: {
    width: "100%",
    alignItems: "center",
  },
  brandBadge: {
    width: 78,
    height: 78,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    ...theme.shadow.sm,
  },
  kicker: {
    marginTop: 16,
    fontSize: 11,
    fontFamily: fonts.sansSemibold,
    letterSpacing: 1,
    color: theme.colors.accent,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 22,
    fontFamily: fonts.serifBold,
    textAlign: "center",
  },
  spinner: {
    marginTop: 18,
  },
});
