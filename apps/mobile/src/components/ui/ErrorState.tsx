import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react-native";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Please check your connection and try again.",
  actionLabel = "Try Again",
  onRetry,
}: ErrorStateProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel={title}>
      <View style={styles.iconWrapper} accessible={false}>
        <AlertTriangle size={30} color={theme.colors.error} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.message}>{message || "Please try again."}</Text>
      {onRetry ? (
        <Button
          title={actionLabel}
          onPress={onRetry}
          variant="outline"
          size="md"
          style={styles.button}
          accessibilityHint="Retries loading this screen"
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
