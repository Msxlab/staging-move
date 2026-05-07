import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel={title} accessibilityHint={description}>
      <View style={styles.iconWrapper} accessible={false}>{icon}</View>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: "rgba(127, 182, 232, 0.2)",
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
