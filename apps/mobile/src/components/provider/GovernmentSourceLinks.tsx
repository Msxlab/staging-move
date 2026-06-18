import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  GOVERNMENT_INFO_DISCLAIMER_COPY,
  GOVERNMENT_INFO_SOURCE_LINKS,
  type GovernmentInfoSourceLink,
} from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";

interface GovernmentSourceLinksProps {
  sources?: readonly GovernmentInfoSourceLink[] | null;
  style?: ViewStyle;
}

export function GovernmentSourceLinks({ sources, style }: GovernmentSourceLinksProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const safeSources = sources?.length ? sources : GOVERNMENT_INFO_SOURCE_LINKS;

  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
      <Text style={styles.title}>{t("providers.stateGuideSourcesTitle")}</Text>
      <View style={styles.links}>
        {safeSources.map((source) => {
          const label = t(`providers.stateGuideSource_${source.id}`, {
            defaultValue: source.label,
          });
          return (
            <TouchableOpacity
              key={source.id}
              accessibilityRole="link"
              accessibilityLabel={t("providers.stateGuideOpenSourceA11y", { source: label })}
              onPress={() => Linking.openURL(source.url).catch(() => {})}
              style={styles.link}
            >
              <Text style={styles.linkText}>{label}</Text>
              <ExternalLink size={12} color={theme.colors.primary} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.disclaimer}>
        {t("providers.stateGuideGovernmentDisclaimer", {
          defaultValue: GOVERNMENT_INFO_DISCLAIMER_COPY,
        })}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: 12,
      gap: 8,
    },
    title: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    links: {
      gap: 6,
    },
    link: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    linkText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.primary,
      lineHeight: 17,
    },
    disclaimer: {
      fontSize: 10,
      color: theme.colors.textMuted,
      lineHeight: 15,
    },
  });
