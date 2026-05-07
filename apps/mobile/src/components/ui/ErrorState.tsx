import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react-native";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title,
  message,
  actionLabel,
  onRetry,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const resolvedTitle = title ?? t("common.errorTitle");
  const resolvedMessage = message ?? t("common.connectionError");
  const resolvedActionLabel = actionLabel ?? t("common.retry");
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel={resolvedTitle}>
      <View style={styles.iconWrapper} accessible={false}>
        <AlertTriangle size={30} color={theme.colors.error} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{resolvedTitle}</Text>
      <Text style={styles.message}>{resolvedMessage || t("common.tryAgainShort")}</Text>
      {onRetry ? (
        <Button
          title={resolvedActionLabel}
          onPress={onRetry}
          variant="outline"
          size="md"
          style={styles.button}
          accessibilityHint={t("common.retryHint")}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 28,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.errorFaded,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1,
    // Aurora coral (#F08C8E) at 22% — matches `theme.colors.error`.
    borderColor: "rgba(240, 140, 142, 0.22)",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  button: {
    marginTop: 18,
  },
});
