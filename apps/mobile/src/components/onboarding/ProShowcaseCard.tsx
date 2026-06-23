import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Sparkles, Truck, Home, GraduationCap, FileText, Bot, ArrowRight } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";

/**
 * Onboarding move-plan showcase (mobile mirror of apps/web ob-pro-showcase).
 *
 * A final-moment, aspirational "what your full move plan includes" card shown at
 * the END of onboarding (the move step) once the user has entered an origin +
 * destination, BEFORE the finish CTA. SHOWCASE, not a paywall:
 *  - copy is personalized from the user's REAL entered context (origin →
 *    destination state + household) so the value is concrete;
 *  - LocateFlow is free forever, so this lists what's INCLUDED for the user's
 *    move — there is NO plan-purchase / payment / upgrade step here;
 *  - the only action is a neutral "Continue" that proceeds in-flow; it does NOT
 *    route to any buy / subscription surface;
 *  - the screen's existing primary CTA proceeds normally below.
 *
 * Hermes-safe: no Intl.RelativeTimeFormat, theming via useAppTheme/makeStyles.
 */

export type ProShowcaseFeatureId = "movers" | "neighborhood" | "schools" | "dossier" | "ai";

export interface ProShowcaseContext {
  fromState: string | null;
  toState: string | null;
  hasChildren: boolean;
  hasPets: boolean;
}

/**
 * Pick which concrete Pro value rows to surface — pure, deterministic, sorted
 * by a fixed priority. "schools" only appears when the household actually has
 * children. Shared logic with the web component (kept in sync by hand).
 */
export function selectProShowcaseFeatures(
  ctx: ProShowcaseContext,
  max = 4,
): ProShowcaseFeatureId[] {
  const ordered: ProShowcaseFeatureId[] = ["movers", "neighborhood"];
  if (ctx.hasChildren) ordered.push("schools");
  ordered.push("dossier", "ai");
  return ordered.slice(0, Math.max(1, max));
}

/** True when we have enough REAL context (a destination state) to be concrete. */
export function hasProShowcaseContext(ctx: ProShowcaseContext): boolean {
  return Boolean(ctx.toState && ctx.toState.trim());
}

const FEATURE_ICON: Record<ProShowcaseFeatureId, typeof Truck> = {
  movers: Truck,
  neighborhood: Home,
  schools: GraduationCap,
  dossier: FileText,
  ai: Bot,
};

type Props = {
  context: ProShowcaseContext;
  /** Localized origin label (falls back to "your state"). */
  fromLabel: string;
  /** Localized destination label (falls back to "your state"). */
  toLabel: string;
  /** Neutral in-flow continue. MUST NOT route to a buy/subscription surface. */
  onContinue: () => void;
};

export function ProShowcaseCard({ context, fromLabel, toLabel, onContinue }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  const features = useMemo(() => selectProShowcaseFeatures(context), [context]);

  return (
    <Card variant="glow" style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Sparkles size={13} color={theme.colors.warning} />
        <Text style={styles.eyebrow}>
          {t("onboarding.proShowcase_eyebrow", { defaultValue: "Included free" })}
        </Text>
      </View>

      <Text style={styles.headline}>
        {t("onboarding.proShowcase_headline", {
          defaultValue: "Your {{from}} → {{to}} move plan includes:",
          from: fromLabel,
          to: toLabel,
        })}
      </Text>

      <View style={styles.features}>
        {features.map((id) => {
          const Icon = FEATURE_ICON[id];
          return (
            <View key={id} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon size={14} color={theme.colors.warning} />
              </View>
              <Text style={styles.featureLabel}>
                {t(`onboarding.proShowcase_feature_${id}`, {
                  defaultValue: proShowcaseFeatureFallback(id),
                })}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footnote}>
          {t("onboarding.proShowcase_footnote", {
            defaultValue: "Free forever — every step above is included, no upgrade needed.",
          })}
        </Text>
        <TouchableOpacity
          style={styles.seeProBtn}
          onPress={onContinue}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.proShowcase_cta", { defaultValue: "Continue" })}
        >
          <Text style={styles.seeProText}>
            {t("onboarding.proShowcase_cta", { defaultValue: "Continue" })}
          </Text>
          <ArrowRight size={13} color={theme.colors.warning} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function proShowcaseFeatureFallback(id: ProShowcaseFeatureId): string {
  switch (id) {
    case "movers":
      return "Licensed, vetted movers for your route";
    case "neighborhood":
      return "Your new neighborhood's home values & market";
    case "schools":
      return "School ratings near your new address";
    case "dossier":
      return "A PDF home dossier you can save or share";
    case "ai":
      return "AI guidance tailored to your move";
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { padding: 18, gap: 12 },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.warning,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    headline: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
      lineHeight: 21,
      letterSpacing: 0,
    },
    features: { gap: 8 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    featureIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.warningFaded,
    },
    featureLabel: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 2,
    },
    footnote: { flex: 1, fontSize: 11, color: theme.colors.textTertiary, lineHeight: 15 },
    seeProBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    seeProText: { fontSize: 13, fontWeight: "700", color: theme.colors.warning, letterSpacing: 0 },
  });
