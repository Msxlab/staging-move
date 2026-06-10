import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Home, Waves, GraduationCap, CloudSun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import {
  deriveHomeDossier,
  formatForecastDate,
  type HomeDossierResponse,
} from "@/lib/home-dossier";

interface HomeDossierCardProps {
  /** Destination address id. Drives GET /api/addresses/{id}/dossier. */
  addressId?: string | null;
}

/**
 * NEW HOME DOSSIER — a compact "Your new home" card for the moving plan
 * detail screen, mirroring the web dossier contract: FEMA flood zone, NCES
 * school district, and (within 7 days of the move) the moving-day forecast
 * for the destination address.
 *
 * Honesty + graceful degradation guarantees:
 *  - Self-fetches and renders NOTHING when the lookup is unconfigured, the
 *    address has no coordinates, the device is offline, or every section
 *    degraded — the move plan is the primary content, never blocked by this.
 *  - Each row renders only real upstream data (FEMA NFHL / NCES / NWS) and
 *    carries fine-print naming the source with a verify-with-the-authority
 *    disclaimer; nothing is modeled or fabricated.
 *  - High-risk flood zones get a honey/amber warning pill (warning tone
 *    tokens — no raw hex, no violet).
 *
 * Hermes-safe: date label via Date#toLocaleDateString only (no
 * Intl.RelativeTimeFormat / ListFormat / PluralRules). All row gating lives
 * in @/lib/home-dossier so it unit-tests under the node vitest environment.
 */
export function HomeDossierCard({ addressId }: HomeDossierCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const [dossier, setDossier] = useState<HomeDossierResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!addressId) {
      setDossier(null);
      return;
    }
    (async () => {
      const res = await api.get<HomeDossierResponse>(
        `/api/addresses/${addressId}/dossier`,
      );
      if (cancelled) return;
      // Any error (offline, 401, 404, 5xx) ⇒ render nothing. Same fail-open
      // pattern as StateRulesCard — no error wall for a supplemental card.
      setDossier(res.error ? null : res.data ?? null);
    })().catch(() => {
      if (!cancelled) setDossier(null);
    });
    return () => {
      cancelled = true;
    };
  }, [addressId]);

  const rows = useMemo(() => deriveHomeDossier(dossier), [dossier]);

  if (!addressId || !rows.hasContent || !dossier) return null;

  const dateLocale = (i18n.language || "").toLowerCase().startsWith("es")
    ? "es-ES"
    : "en-US";

  const weather = rows.weather;
  const forecastDateLabel = weather
    ? formatForecastDate(weather.forecastDate, dateLocale)
    : null;
  const weatherHeadline = weather
    ? [forecastDateLabel, weather.summary].filter(Boolean).join(" · ")
    : "";

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Home size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("dossier.title")}</Text>
          {dossier.address?.city ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {dossier.address.city}
              {dossier.address.state ? `, ${dossier.address.state}` : ""}
            </Text>
          ) : null}
        </View>
      </View>

      {rows.flood && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Waves size={14} color={theme.colors.sky.text} />
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowLabel}>{t("dossier.floodLabel")}</Text>
              {rows.flood.isHighRisk && (
                <UiBadge label={t("dossier.floodHighRisk")} variant="warning" mono dot />
              )}
            </View>
            <Text style={styles.rowValue}>
              {t("dossier.floodZone", { zone: rows.flood.zone })}
            </Text>
            <Text style={styles.finePrint}>{t("dossier.floodFinePrint")}</Text>
          </View>
        </View>
      )}

      {rows.school && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <GraduationCap size={14} color={theme.colors.emerald.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.schoolLabel")}</Text>
            <Text style={styles.rowValue}>{rows.school.districtName}</Text>
            <Text style={styles.finePrint}>
              {rows.school.ncesId
                ? `${t("dossier.schoolNces", { id: rows.school.ncesId })} — ${t("dossier.schoolFinePrint")}`
                : t("dossier.schoolFinePrint")}
            </Text>
          </View>
        </View>
      )}

      {weather && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <CloudSun size={14} color={theme.colors.amber.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.weatherLabel")}</Text>
            {!!weatherHeadline && <Text style={styles.rowValue}>{weatherHeadline}</Text>}
            {weather.tempHighF !== null && weather.tempLowF !== null && (
              <Text style={styles.rowMeta}>
                {t("dossier.weatherHighLow", {
                  high: weather.tempHighF,
                  low: weather.tempLowF,
                })}
                {weather.precipChancePct !== null
                  ? ` · ${t("dossier.weatherPrecip", { pct: weather.precipChancePct })}`
                  : ""}
              </Text>
            )}
            {weather.tempHighF === null && weather.precipChancePct !== null && (
              <Text style={styles.rowMeta}>
                {t("dossier.weatherPrecip", { pct: weather.precipChancePct })}
              </Text>
            )}
            <Text style={styles.finePrint}>{t("dossier.weatherFinePrint")}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { marginTop: 16 },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.colors.primaryFaded,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    subtitle: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    row: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    rowIcon: { width: 18, alignItems: "center", paddingTop: 1 },
    rowBody: { flex: 1 },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rowLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: 3,
    },
    rowMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 3,
    },
    finePrint: {
      fontSize: 10,
      color: theme.colors.textMuted,
      lineHeight: 15,
      marginTop: 5,
    },
  });
