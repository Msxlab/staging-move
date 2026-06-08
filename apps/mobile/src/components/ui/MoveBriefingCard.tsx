import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";

interface MoveBriefingCardProps {
  /** The briefing text (plain text: a short summary + numbered actions). */
  briefing: string;
  /**
   * True when the text came from the LLM. Drives the subtle "AI-generated"
   * label. When false the card renders the same way but without that label
   * (the rule-based fallback is still a real, useful briefing).
   */
  aiGenerated: boolean;
  onDismiss?: () => void;
}

/**
 * First-run "move briefing" card. Renders a plain-English situation summary +
 * the top 3 next actions. Shows a subtle "AI-generated" chip when the text was
 * produced by the LLM. The whole card is hidden by the parent when the briefing
 * feature is unconfigured ({ configured: false }) — this component only renders
 * text it is given and never calls the network itself.
 */
export function MoveBriefingCard({ briefing, aiGenerated, onDismiss }: MoveBriefingCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  const lines = briefing
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Card variant="glow" style={{ marginBottom: 16 }}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Sparkles size={18} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("dashboard.briefingTitle", "Your move briefing")}</Text>
          {aiGenerated && (
            <Text style={styles.aiLabel}>{t("dashboard.briefingAiLabel", "AI-generated")}</Text>
          )}
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.briefingDismiss", "Dismiss briefing")}
          >
            <X size={18} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        {lines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded ?? "rgba(127,182,232,0.14)",
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    aiLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    body: {
      gap: 6,
    },
    line: {
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
  });
