import React, { useState } from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";

type AffiliateSource = "provider_detail" | "providers" | "services" | "recommendation";

type Props = {
  providerId: string;
  providerName: string;
  source: AffiliateSource;
  /** Smaller styling when embedded inside a list card row. */
  compact?: boolean;
};

/**
 * Shared mobile "Get started" affiliate CTA + FTC disclosure (web parity for the
 * provider list/card; the detail screen has its own inline copy). The redirect
 * target is resolved server-side by /api/affiliate/click — the app never holds or
 * trusts the affiliate URL — and opened in an in-app browser. Tracking failures
 * never block the surface.
 *
 * When rendered inside a tappable card the inner TouchableOpacity owns the touch
 * responder, so pressing it opens the offer rather than navigating the card.
 */
export function AffiliateCtaButton({ providerId, providerName, source, compact = false }: Props) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post<{ url?: string }>("/api/affiliate/click", { providerId, source });
      if (res.data?.url) await openWebUrl(res.data.url);
    } catch {
      // Non-critical CTA — never block the screen on a tracking failure.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.btn}
        onPress={handlePress}
        disabled={busy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t("providers.getStartedA11y", { provider: providerName })}
        accessibilityHint={t("providers.getStartedHint", {
          defaultValue: "Opens the provider's site in a browser",
        })}
      >
        <Sparkles size={compact ? 14 : 16} color={theme.colors.primary} />
        <Text style={[styles.btnText, compact && styles.btnTextCompact]}>
          {t("providers.getStarted", { defaultValue: "Get started" })}
        </Text>
      </TouchableOpacity>
      <Text style={styles.disclosure}>
        {t("providers.affiliateDisclosure", {
          defaultValue:
            "Affiliate link — we may earn a commission if you sign up, at no extra cost to you. It never affects rankings.",
        })}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primaryFaded,
      borderRadius: theme.radius.lg,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    btnText: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
    btnTextCompact: { fontSize: 13 },
    disclosure: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textMuted,
      marginTop: 6,
      textAlign: "center",
    },
  });
