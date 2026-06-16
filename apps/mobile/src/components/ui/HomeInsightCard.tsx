import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Building2, ChevronDown, ChevronUp, Home, Wind } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { fetchHomeDossier, peekHomeDossierMemoryCache, readHomeDossierCache } from "@/lib/home-dossier-cache";
import {
  getAirRow,
  getHousingRow,
  type HomeDossierResponse,
} from "@/lib/home-dossier";

interface HomeInsightCardProps {
  addressId?: string | null;
  label?: string | null;
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${rounded < 0 ? "-" : ""}$${grouped}`;
}

export function HomeInsightCard({ addressId, label }: HomeInsightCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [dossier, setDossier] = useState<HomeDossierResponse | null>(
    () => peekHomeDossierMemoryCache(addressId, "summary")?.data ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!addressId) {
      setDossier(null);
      return;
    }
    const memorySnapshot = peekHomeDossierMemoryCache(addressId, "summary");
    if (memorySnapshot) setDossier(memorySnapshot.data);

    (async () => {
      const cached = await readHomeDossierCache(addressId, "summary");
      if (!cancelled && cached) setDossier(cached.data);
      const res = await fetchHomeDossier(addressId, "summary");
      if (cancelled) return;
      setDossier(res.data ?? cached?.data ?? null);
    })().catch(() => {
      if (!cancelled) setDossier(null);
    });

    return () => {
      cancelled = true;
    };
  }, [addressId]);

  const air = dossier ? getAirRow(dossier) : null;
  const housing = dossier ? getHousingRow(dossier) : null;
  if (!addressId || (!air && !housing)) return null;

  const airValue = air
    ? [air.aqi !== null ? t("dossier.airAqi", { aqi: air.aqi }) : null, air.category]
        .filter(Boolean)
        .join(" - ")
    : null;
  const rentValue = housing?.twoBedroomFmr
    ? `${formatUsd(housing.twoBedroomFmr)}/mo`
    : null;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.homeInsightTitle", { defaultValue: "Current home snapshot" })}
      >
        <View style={styles.icon}>
          <Home size={16} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kicker}>
            {t("dashboard.homeInsightKicker", { defaultValue: "Current home" }).toUpperCase()}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {label || t("dashboard.homeInsightTitle", { defaultValue: "Current home snapshot" })}
          </Text>
        </View>
        <View style={styles.glanceWrap}>
          {airValue ? <Text style={styles.glance} numberOfLines={1}>{airValue}</Text> : null}
          {rentValue ? <Text style={styles.glance} numberOfLines={1}>{rentValue}</Text> : null}
        </View>
        {expanded ? (
          <ChevronUp size={16} color={theme.colors.textMuted} />
        ) : (
          <ChevronDown size={16} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.detailGrid}>
          {air && (
            <View style={styles.detail}>
              <Wind size={15} color={theme.colors.sky.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailLabel}>{t("dossier.airLabel")}</Text>
                <Text style={styles.detailValue}>{airValue}</Text>
              </View>
            </View>
          )}
          {housing && (
            <View style={styles.detail}>
              <Building2 size={15} color={theme.colors.amber.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailLabel}>{t("dossier.housingLabel")}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {rentValue || housing.areaName || t("dashboard.homeInsightHousing", { defaultValue: "HUD housing context" })}
                </Text>
                {housing.medianIncome !== null ? (
                  <Text style={styles.detailMeta}>
                    {t("dashboard.homeInsightIncome", {
                      income: formatUsd(housing.medianIncome),
                      defaultValue: "Median income {{income}}",
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 13,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    ...theme.shadow.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: theme.colors.textTertiary,
  },
  title: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  glanceWrap: {
    maxWidth: 116,
    alignItems: "flex-end",
    gap: 3,
  },
  glance: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.accent,
  },
  detailGrid: {
    gap: 9,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detail: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: theme.colors.textMuted,
  },
  detailValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
  detailMeta: {
    marginTop: 3,
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
});
