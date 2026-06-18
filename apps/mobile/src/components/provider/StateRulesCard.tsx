import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BookOpen } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { GovernmentInfoSourceLink } from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { GovernmentSourceLinks } from "@/components/provider/GovernmentSourceLinks";

/**
 * The real, statewide rule contract returned by GET /api/state-rules?state=XX.
 * The API deliberately returns ONLY these fields (see apps/web .../state-rules/route.ts),
 * so this card never renders fabricated city/county or utility/insurance specifics —
 * only the columns the backend actually populates.
 */
export type StateRule = {
  stateCode: string;
  stateName: string | null;
  dmvRules: string | null;
  voterRegistration: string | null;
  taxInfo: string | null;
  officialSources?: readonly GovernmentInfoSourceLink[] | null;
};

interface StateRulesCardProps {
  /** Two-letter state code (e.g. "CA"). Drives the /api/state-rules fetch. */
  state?: string | null;
  /** Whether the card body starts expanded. Defaults to collapsed. */
  defaultOpen?: boolean;
}

/**
 * Shared "YOUR STATE" guide — the key statewide rules + deadlines a mover must
 * handle after relocating (DMV/license, voter registration, state taxes). Fed by
 * the real /api/state-rules endpoint and rendered identically wherever it's
 * surfaced (providers browse header + moving/[id]) so both stay in sync.
 *
 * Honesty guarantees:
 *  - Renders ONLY fields the API returns (no fabricated utility/insurance/city data).
 *  - Clearly labeled STATEWIDE with a disclaimer that local rules may add steps.
 *  - Renders nothing (null) when no state is set or no rule exists for it.
 *
 * OTA-safe: pure JS + react-native-svg icons; self-fetches so any screen can drop
 * it in with just a state code.
 */
export function StateRulesCard({ state, defaultOpen = false }: StateRulesCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [rule, setRule] = useState<StateRule | null>(null);

  const normalizedState = state?.trim().toUpperCase() || null;

  useEffect(() => {
    let cancelled = false;
    if (!normalizedState) {
      setRule(null);
      return;
    }
    (async () => {
      const res = await api.get<{ stateRule: StateRule | null }>("/api/state-rules", {
        state: normalizedState,
      });
      if (cancelled) return;
      // Gracefully render nothing on error or missing rule.
      setRule(res.error ? null : res.data?.stateRule ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedState]);

  if (!normalizedState || !rule) return null;

  // Build the list of populated sections from the real contract only. If every
  // field is empty there is nothing meaningful to show, so render nothing.
  const sections: { key: string; label: string; text: string }[] = [];
  if (rule.dmvRules) {
    sections.push({ key: "dmv", label: t("moving.dmvVehicle"), text: rule.dmvRules });
  }
  if (rule.voterRegistration) {
    sections.push({
      key: "voter",
      label: t("moving.voterRegistration"),
      text: rule.voterRegistration,
    });
  }
  if (rule.taxInfo) {
    sections.push({ key: "tax", label: t("moving.stateTax"), text: rule.taxInfo });
  }
  if (sections.length === 0) return null;

  const stateLabel = rule.stateName || normalizedState;

  return (
    <CollapsibleCard
      title={t("providers.stateGuideTitle", { state: stateLabel })}
      icon={<BookOpen size={16} color={theme.colors.primary} />}
      defaultOpen={defaultOpen}
      headerRight={<UiBadge label={t("providers.stateGuideBadge")} variant="info" />}
    >
      <Text style={styles.subtitle}>{t("providers.stateGuideSubtitle")}</Text>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          <Text style={styles.sectionText}>{section.text}</Text>
        </View>
      ))}
      <GovernmentSourceLinks sources={rule.officialSources} />
      <Text style={styles.disclaimer}>{t("providers.stateGuideDisclaimer")}</Text>
    </CollapsibleCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    subtitle: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      lineHeight: 17,
      marginTop: 6,
    },
    section: { marginTop: 14 },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    sectionText: { fontSize: 13, color: theme.colors.textTertiary, lineHeight: 20 },
    disclaimer: {
      fontSize: 10,
      color: theme.colors.textMuted,
      lineHeight: 15,
      marginTop: 16,
    },
  });
