import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Home, MapPinned } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { fonts, type Theme, useAppTheme } from "@/lib/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const goBackOrHome = () => {
    const canGoBack = typeof (router as any).canGoBack === "function" && (router as any).canGoBack();
    if (canGoBack) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MapPinned size={30} color={theme.colors.primary} />
        </View>
        <Text style={styles.kicker}>{t("errors.routeNotFoundKicker", { defaultValue: "Route not found" })}</Text>
        <Text style={styles.title}>
          {t("errors.routeNotFoundTitle", { defaultValue: "This link does not point to an available screen." })}
        </Text>
        <Text style={styles.body}>
          {t("errors.routeNotFoundBody", {
            defaultValue: "It may be expired, mistyped, or from a newer version of Move.",
          })}
        </Text>
        <View style={styles.actions}>
          <Button
            title={t("common.goHome", { defaultValue: "Go home" })}
            icon={<Home size={18} color="#fff" />}
            onPress={() => router.replace("/(tabs)")}
            fullWidth
          />
          <Button
            title={t("common.goBack", { defaultValue: "Go back" })}
            variant="secondary"
            icon={<ArrowLeft size={18} color={theme.colors.primary} />}
            onPress={goBackOrHome}
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    kicker: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      color: theme.colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0,
    },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 28,
      lineHeight: 34,
      color: theme.colors.text,
    },
    body: {
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      maxWidth: 360,
    },
    actions: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
  });
}
