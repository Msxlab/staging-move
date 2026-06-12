import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Home,
  Waves,
  GraduationCap,
  CloudSun,
  TriangleAlert,
  Radiation,
  Droplets,
  Wind,
  Building2,
  Zap,
  Lock,
  ArrowRight,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticLight } from "@/lib/haptics";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { DossierAmbient } from "@/components/ui/DossierAmbient";
import {
  ambientForSection,
  deriveHomeDossierView,
  formatForecastDate,
  walkBandLabelKey,
  type HomeDossierResponse,
} from "@/lib/home-dossier";

interface HomeDossierCardProps {
  /** Destination address id. Drives GET /api/addresses/{id}/dossier. */
  addressId?: string | null;
}

/** Explicit zone→key map (greppable, no template-literal i18n keys). */
const RADON_ZONE_KEYS = {
  1: "dossier.radonZone1",
  2: "dossier.radonZone2",
  3: "dossier.radonZone3",
} as const;

/**
 * Whole-dollar USD label, Hermes-safe (no Intl.NumberFormat — the app avoids
 * locale-format APIs on this path). US-only product, so the "$" + thousands
 * grouping is correct for both languages. Returns "" for null so the caller
 * omits the figure. e.g. 412000 → "$412,000".
 */
function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${rounded < 0 ? "-" : ""}$${grouped}`;
}

/**
 * NEW HOME DOSSIER — a compact "Your new home" card for the moving plan
 * detail screen, mirroring the web dossier contract: FEMA flood zone, NCES
 * school district, (within 7 days of the move) the moving-day forecast for
 * the destination address, plus the extended sections — FEMA NRI natural
 * hazards (max 3 pills), EPA county radon zone, EPA drinking-water record,
 * and AirNow air quality.
 *
 * Honesty + graceful degradation guarantees:
 *  - Self-fetches and renders NOTHING when the lookup is unconfigured, the
 *    address has no coordinates, the device is offline, or every section
 *    degraded — the move plan is the primary content, never blocked by this.
 *  - Each row renders only real upstream data (FEMA NFHL/NRI / NCES / NWS /
 *    EPA / AirNow) and carries fine-print naming the source with a
 *    verify-with-the-authority disclaimer; nothing is modeled or fabricated.
 *    Sections are independent: older servers that omit the extended sections
 *    render exactly the original three rows.
 *  - High-risk flood zones get a honey/amber warning pill (warning tone
 *    tokens — no raw hex, no violet). Hazard pills stay NEUTRAL on purpose:
 *    the data is informational and county-relative, never alarming.
 *
 * Freemium packaging: the dossier is paid-plans-only. A FREE / FREE_TRIAL
 * user gets `{ configured: true, entitled: false }` from the server and sees
 * a value-first teaser instead — an honest pitch + the locked rows +
 * an "Unlock with Individual" CTA routed to the existing subscription screen
 * (same destination every mobile upsell uses). `configured: false` stays
 * fully hidden for everyone: never tease a feature the deployment can't
 * serve. Older servers without the flag are treated as entitled.
 *
 * Hermes-safe: date label via Date#toLocaleDateString only (no
 * Intl.RelativeTimeFormat / ListFormat / PluralRules). All row/teaser gating
 * lives in @/lib/home-dossier so it unit-tests under the node vitest
 * environment.
 *
 * Ambient scenes: each DATA row hosts a decorative DossierAmbient layer in
 * its right zone, with scene intensity derived from the row's REAL data via
 * ambientForSection (also in @/lib/home-dossier — pure and unit-tested).
 * Decoration only: pointerEvents none, hidden from assistive tech, faded out
 * toward the text side, and fully static under reduce-motion. Teaser and
 * locked rows stay scene-free.
 */
export function HomeDossierCard({ addressId }: HomeDossierCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
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

  const view = useMemo(() => deriveHomeDossierView(dossier), [dossier]);

  const handleUnlock = useCallback(() => {
    hapticLight();
    router.push("/settings/subscription");
  }, [router]);

  if (!addressId || !dossier || view.kind === "hidden") return null;

  // ── Value-first teaser (entitled:false) ─────────────────────────────
  if (view.kind === "teaser") {
    const lockedRows = [
      { Icon: Waves, color: theme.colors.sky.text, label: t("dossier.floodLabel"), value: t("dossier.teaserFlood") },
      { Icon: GraduationCap, color: theme.colors.emerald.text, label: t("dossier.schoolLabel"), value: t("dossier.teaserSchool") },
      { Icon: CloudSun, color: theme.colors.amber.text, label: t("dossier.weatherLabel"), value: t("dossier.teaserWeather") },
      { Icon: TriangleAlert, color: theme.colors.orange.text, label: t("dossier.hazardsLabel"), value: t("dossier.teaserHazards") },
      { Icon: Radiation, color: theme.colors.amber.text, label: t("dossier.radonLabel"), value: t("dossier.teaserRadon") },
      { Icon: Droplets, color: theme.colors.cyan.text, label: t("dossier.waterLabel"), value: t("dossier.teaserWater") },
      { Icon: Wind, color: theme.colors.sky.text, label: t("dossier.airLabel"), value: t("dossier.teaserAir") },
      { Icon: Building2, color: theme.colors.amber.text, label: t("dossier.housingLabel"), value: t("dossier.teaserHousing") },
      { Icon: Zap, color: theme.colors.emerald.text, label: t("dossier.evChargingLabel"), value: t("dossier.teaserEvCharging") },
    ];
    return (
      <Card variant="default" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Home size={16} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("dossier.title")}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {t("teaser.paidFeatureLabel")}
            </Text>
          </View>
        </View>

        <Text style={styles.teaserPitch}>{t("dossier.teaserPitch")}</Text>

        {lockedRows.map(({ Icon, color, label, value }) => (
          <View key={label} style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon size={14} color={color} />
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Lock size={12} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.teaserRowValue}>{value}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.unlockBtn}
          onPress={handleUnlock}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("teaser.unlockCta")}
        >
          <Lock size={14} color="#fff" />
          <Text style={styles.unlockBtnText}>{t("teaser.unlockCta")}</Text>
          <ArrowRight size={14} color="#fff" />
        </TouchableOpacity>
      </Card>
    );
  }

  // ── Entitled: real data rows ────────────────────────────────────────
  const rows = view.rows;

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

  // AQI number and/or AirNow category — the helper guarantees at least one.
  const air = rows.air;
  const airHeadline = air
    ? [air.aqi !== null ? t("dossier.airAqi", { aqi: air.aqi }) : null, air.category]
        .filter(Boolean)
        .join(" · ")
    : "";

  const housing = rows.housing;
  const housingArea = housing
    ? [housing.areaName, housing.zip ? t("dossier.housingZip", { zip: housing.zip }) : null]
        .filter(Boolean)
        .join(" - ")
    : "";

  const evCharging = rows.evCharging;

  // Neighborhood (Pro): either the locked teaser variant or the area medians.
  const neighborhood = rows.neighborhood;

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
          <DossierAmbient
            {...ambientForSection({ kind: "flood", isHighRisk: rows.flood.isHighRisk })}
          />
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
          <DossierAmbient {...ambientForSection({ kind: "school" })} />
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
          <DossierAmbient
            {...ambientForSection({
              kind: "weather",
              summary: weather.summary,
              precipChancePct: weather.precipChancePct,
            })}
          />
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

      {rows.hazards && (
        <View style={styles.row}>
          <DossierAmbient
            {...ambientForSection({ kind: "hazard", topRisks: rows.hazards.topRisks })}
          />
          <View style={styles.rowIcon}>
            <TriangleAlert size={14} color={theme.colors.orange.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.hazardsLabel")}</Text>
            {rows.hazards.overallRating !== null && (
              <Text style={styles.rowValue}>
                {t("dossier.hazardsOverall", { rating: rows.hazards.overallRating })}
              </Text>
            )}
            {rows.hazards.topRisks.length > 0 && (
              <View style={styles.pillWrap}>
                {/* Max 3 pills (helper-capped). Neutral on purpose — county-
                    relative ratings are informational, never an alarm. */}
                {rows.hazards.topRisks.map((risk) => (
                  <UiBadge
                    key={risk.hazard}
                    label={`${risk.hazard} · ${risk.rating}`}
                    variant="neutral"
                  />
                ))}
              </View>
            )}
            <Text style={styles.finePrint}>{t("dossier.hazardsFinePrint")}</Text>
          </View>
        </View>
      )}

      {rows.radon && (
        <View style={styles.row}>
          <DossierAmbient {...ambientForSection({ kind: "radon", zone: rows.radon.zone })} />
          <View style={styles.rowIcon}>
            <Radiation size={14} color={theme.colors.amber.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.radonLabel")}</Text>
            <Text style={styles.rowValue}>{t(RADON_ZONE_KEYS[rows.radon.zone])}</Text>
            <Text style={styles.finePrint}>{t("dossier.radonFinePrint")}</Text>
          </View>
        </View>
      )}

      {rows.water && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Droplets size={14} color={theme.colors.cyan.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.waterLabel")}</Text>
            <Text style={styles.rowValue}>{rows.water.systemName}</Text>
            {rows.water.violations5y !== null && (
              <Text style={styles.rowMeta}>
                {rows.water.violations5y === 0
                  ? t("dossier.waterViolationsNone")
                  : t("dossier.waterViolationsSome", { n: rows.water.violations5y })}
              </Text>
            )}
            <Text style={styles.finePrint}>{t("dossier.waterFinePrint")}</Text>
          </View>
        </View>
      )}

      {air && (
        <View style={styles.row}>
          {/* AQI bands drive the scene; a category-only row stays scene-free
              rather than inventing an intensity AirNow never published. */}
          {air.aqi !== null && (
            <DossierAmbient {...ambientForSection({ kind: "air", aqi: air.aqi })} />
          )}
          <View style={styles.rowIcon}>
            <Wind size={14} color={theme.colors.sky.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.airLabel")}</Text>
            {!!airHeadline && <Text style={styles.rowValue}>{airHeadline}</Text>}
            <Text style={styles.finePrint}>{t("dossier.airFinePrint")}</Text>
          </View>
        </View>
      )}

      {housing && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Building2 size={14} color={theme.colors.amber.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.housingLabel")}</Text>
            {!!housingArea && <Text style={styles.rowValue}>{housingArea}</Text>}
            {housing.twoBedroomFmr !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.housingTwoBedroomFmr")}</Text>
                <Text style={styles.statValue}>
                  {t("dossier.housingRentPerMonth", {
                    amount: formatUsd(housing.twoBedroomFmr),
                  })}
                </Text>
              </View>
            )}
            {housing.medianIncome !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.housingMedianIncome")}</Text>
                <Text style={styles.statValue}>{formatUsd(housing.medianIncome)}</Text>
              </View>
            )}
            {housing.lowIncome4Person !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.housingLowIncome4")}</Text>
                <Text style={styles.statValue}>{formatUsd(housing.lowIncome4Person)}</Text>
              </View>
            )}
            <Text style={styles.finePrint}>{t("dossier.housingFinePrint")}</Text>
          </View>
        </View>
      )}

      {evCharging && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Zap size={14} color={theme.colors.emerald.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.evChargingLabel")}</Text>
            <Text style={styles.rowValue}>
              {evCharging.stationCount === 0
                ? t("dossier.evChargingNone", { radius: evCharging.radiusMiles })
                : t("dossier.evChargingCount", {
                    count: evCharging.stationCount,
                    radius: evCharging.radiusMiles,
                  })}
            </Text>
            {evCharging.nearestDistanceMiles !== null && (
              <Text style={styles.rowMeta}>
                {t("dossier.evChargingNearest", { miles: evCharging.nearestDistanceMiles })}
              </Text>
            )}
            {(evCharging.dcFastPortCount > 0 || evCharging.level2PortCount > 0) && (
              <Text style={styles.rowMeta}>
                {t("dossier.evChargingPorts", {
                  dc: evCharging.dcFastPortCount,
                  level2: evCharging.level2PortCount,
                })}
              </Text>
            )}
            <Text style={styles.finePrint}>{t("dossier.evChargingFinePrint")}</Text>
          </View>
        </View>
      )}

      {/* Neighborhood (Pro-only). Locked teaser for an entitled-but-non-Pro
          user, else the area-median stat rows. The fine print is the honest
          core: ACS tract medians, never a valuation of THIS home. */}
      {neighborhood?.locked === true && (
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Home size={14} color={theme.colors.amber.text} />
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowLabel}>{t("dossier.neighborhoodLabel")}</Text>
              <UiBadge label={t("dossier.neighborhoodProPill")} variant="warning" mono dot />
            </View>
            <Text style={styles.teaserRowValue}>{t("dossier.neighborhoodTeaser")}</Text>
            <Text style={styles.finePrint}>{t("dossier.neighborhoodFinePrint")}</Text>
          </View>
        </View>
      )}

      {neighborhood?.locked === false && (
        <View style={styles.row}>
          <DossierAmbient
            {...ambientForSection({ kind: "neighborhood", walkBand: neighborhood.walkBand })}
          />
          <View style={styles.rowIcon}>
            <Home size={14} color={theme.colors.amber.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t("dossier.neighborhoodLabel")}</Text>

            {neighborhood.medianHomeValue !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodHomeValue")}</Text>
                <Text style={styles.statValue}>{formatUsd(neighborhood.medianHomeValue)}</Text>
              </View>
            )}
            {neighborhood.medianGrossRent !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodGrossRent")}</Text>
                <Text style={styles.statValue}>
                  {t("dossier.neighborhoodRentPerMonth", {
                    amount: formatUsd(neighborhood.medianGrossRent),
                  })}
                </Text>
              </View>
            )}
            {neighborhood.medianHouseholdIncome !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodIncome")}</Text>
                <Text style={styles.statValue}>{formatUsd(neighborhood.medianHouseholdIncome)}</Text>
              </View>
            )}
            {neighborhood.ownerOccupiedPct !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodOwnerOccupied")}</Text>
                <Text style={styles.statValue}>
                  {t("dossier.neighborhoodPercent", { percent: neighborhood.ownerOccupiedPct })}
                </Text>
              </View>
            )}
            {neighborhood.walkScore !== null && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodWalkability")}</Text>
                <Text style={styles.statValue}>
                  {neighborhood.walkBand
                    ? t("dossier.neighborhoodWalkValue", {
                        score: neighborhood.walkScore,
                        label: t(walkBandLabelKey(neighborhood.walkBand)),
                      })
                    : t("dossier.neighborhoodWalkScoreOnly", {
                        score: neighborhood.walkScore,
                      })}
                </Text>
              </View>
            )}

            {neighborhood.schools.length > 0 && (
              <View style={styles.schoolsBlock}>
                <Text style={styles.statLabel}>{t("dossier.neighborhoodSchools")}</Text>
                {neighborhood.schools.map((school) => (
                  <View key={school.name} style={styles.statRow}>
                    <Text style={styles.schoolName} numberOfLines={1}>
                      {school.name}
                    </Text>
                    {school.level || school.rating ? (
                      <Text style={styles.schoolRating}>{school.level ?? school.rating}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.finePrint}>{t("dossier.neighborhoodFinePrint")}</Text>
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
      position: "relative",
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: theme.colors.border,
      borderColor: theme.colors.border,
      backgroundColor: "rgba(255,255,255,0.025)",
      overflow: "hidden",
    },
    rowIcon: { width: 18, alignItems: "center", paddingTop: 1, zIndex: 1 },
    rowBody: { flex: 1, zIndex: 1 },
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
    // Hazard pills wrap onto extra lines on narrow devices (max 3 pills).
    pillWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6,
    },
    // ── Neighborhood stat rows (label left, value right) ──
    statRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 5,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      flexShrink: 1,
    },
    statValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    schoolsBlock: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    schoolName: {
      fontSize: 13,
      color: theme.colors.text,
      flexShrink: 1,
    },
    schoolRating: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    // ── Teaser-only styles (entitled:false) ──
    teaserPitch: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    teaserRowValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginTop: 3,
    },
    // Same CTA idiom as FreeMoveUpsellCard (the established mobile upsell).
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      paddingVertical: 12,
      marginTop: 14,
      ...theme.shadow.glow,
    },
    unlockBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -0.2,
    },
  });
