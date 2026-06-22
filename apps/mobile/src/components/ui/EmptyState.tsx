import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "./Button";
import { MoveRaccoon, type RaccoonMood } from "@/components/move";

type LegacyMascotHint = "dad" | "mom" | "kid";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /**
   * When set, a friendly raccoon mascot greets the user instead of the plain
   * icon disc — consistent with the splash + PlanHero personality. The icon is
   * still accepted (and ignored) so call sites don't need to change shape.
   */
  mascot?: LegacyMascotHint | RaccoonMood;
}

function resolveMascotMood(mascot: NonNullable<EmptyStateProps["mascot"]>): RaccoonMood {
  if (mascot === "dad") return "calm";
  if (mascot === "mom") return "thinking";
  if (mascot === "kid") return "happy";
  return mascot;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  mascot,
}: EmptyStateProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel={title} accessibilityHint={description}>
      {mascot ? (
        <View style={styles.mascotWrapper} accessible={false}>
          <MoveRaccoon size={74} mood={resolveMascotMood(mascot)} />
        </View>
      ) : (
        <View style={styles.iconWrapper} accessible={false}>{icon}</View>
      )}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={{ marginTop: 16 }}
          accessibilityHint={`Activates ${actionLabel.toLowerCase()}`}
        />
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <Button
          title={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="secondary"
          size="md"
          style={{ marginTop: 10 }}
          accessibilityHint={`Activates ${secondaryActionLabel.toLowerCase()}`}
        />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  mascotWrapper: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
});
