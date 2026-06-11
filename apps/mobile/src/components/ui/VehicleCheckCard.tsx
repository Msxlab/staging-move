import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Car, ChevronDown, ChevronUp, ExternalLink, Lock, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticLight, hapticError } from "@/lib/haptics";
import { openWebUrl } from "@/lib/in-app-browser";
import {
  NHTSA_RECALLS_URL,
  deriveVehicleCheckView,
  isValidVin,
  normalizeVinInput,
  type VehicleDecodeResponse,
} from "./VehicleCheckCard.helpers";

interface VehicleCheckCardProps {
  /** Destination state (two-letter) — drives the official DMV link lookup. */
  destinationState?: string | null;
}

/**
 * "CHECK YOUR VEHICLE" — compact inline helper rendered under the
 * vehicle-registration task row on the plan-detail timeline (moving/[id]).
 *
 * Collapsed by default (one small affordance, no new screens); expanding
 * reveals a VIN input + "Check" that calls GET /api/vehicles/decode and shows
 * e.g. "2019 HONDA CR-V — 2 open recalls" with the top recall items, a link
 * to the official NHTSA recalls site, and — when the destination state has a
 * DMV entry in the provider catalog (GOVERNMENT_DMV) — the state's official
 * DMV link.
 *
 * Honesty + graceful degradation:
 *  - VIN validation runs client-side first (17 chars, I/O/Q never used), so a
 *    typo never spends a server/NHTSA call.
 *  - Sections degrade independently: a decoded vehicle whose recall lookup
 *    failed still renders with honest "recall info unavailable" copy; request
 *    failures show one error line, never an error wall.
 *  - MANDATORY fine print: specs/recalls are NHTSA data — registration
 *    requirements come from the state DMV.
 *
 * Hermes-safe: all derivation lives in VehicleCheckCard.helpers.ts (no Intl).
 * External links go through openWebUrl (non-owned URLs ⇒ system browser).
 */
export function VehicleCheckCard({ destinationState }: VehicleCheckCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [vin, setVin] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKind, setErrorKind] = useState<"invalid" | "request" | null>(null);
  const [data, setData] = useState<VehicleDecodeResponse | null>(null);
  // Official state DMV link from the provider catalog (GOVERNMENT_DMV).
  // Omitted entirely when the state has no entry or the fetch fails.
  const [dmv, setDmv] = useState<{ name: string; website: string } | null>(null);
  const [dmvFetched, setDmvFetched] = useState(false);

  const state = destinationState?.trim().toUpperCase() || null;

  useEffect(() => {
    if (!open || !state || dmvFetched) return;
    setDmvFetched(true);
    let cancelled = false;
    (async () => {
      const res = await api.get<{ providers?: Array<{ name?: unknown; website?: unknown }> }>(
        "/api/providers",
        { state, category: "GOVERNMENT_DMV" },
      );
      if (cancelled || res.error) return;
      const providers = Array.isArray(res.data?.providers) ? res.data!.providers : [];
      const match = providers.find(
        (p) => typeof p?.name === "string" && typeof p?.website === "string" && /^https?:\/\//.test(p.website),
      );
      if (match) setDmv({ name: match.name as string, website: match.website as string });
    })().catch(() => {
      // No DMV link is an acceptable outcome — the row is simply omitted.
    });
    return () => {
      cancelled = true;
    };
  }, [open, state, dmvFetched]);

  const handleCheck = async () => {
    const normalized = normalizeVinInput(vin);
    if (!isValidVin(normalized)) {
      hapticError();
      setErrorKind("invalid");
      setData(null);
      return;
    }
    setBusy(true);
    setErrorKind(null);
    const res = await api.get<VehicleDecodeResponse>("/api/vehicles/decode", { vin: normalized });
    setBusy(false);
    if (res.error || !res.data) {
      hapticError();
      setErrorKind("request");
      setData(null);
      return;
    }
    hapticLight();
    setData(res.data);
  };

  const view = data ? deriveVehicleCheckView(data) : null;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => {
          hapticLight();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Car size={12} color={theme.colors.textSecondary} />
        <Text style={styles.triggerText}>{t("moving.vehicleCheckTitle")}</Text>
        {open ? (
          <ChevronUp size={12} color={theme.colors.textMuted} />
        ) : (
          <ChevronDown size={12} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <Text style={styles.intro}>{t("moving.vehicleCheckIntro")}</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.vinInput}
              value={vin}
              onChangeText={(text) => setVin(text.toUpperCase())}
              placeholder={t("moving.vehicleCheckVinPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              selectionColor={theme.colors.primary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={17}
              accessibilityLabel={t("moving.vehicleCheckVinPlaceholder")}
              onSubmitEditing={() => {
                if (!busy) void handleCheck();
              }}
            />
            <TouchableOpacity
              style={[styles.checkBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => void handleCheck()}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.checkBtnText}>{t("moving.vehicleCheckButton")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {errorKind === "invalid" && <Text style={styles.errorText}>{t("moving.vehicleCheckInvalidVin")}</Text>}
          {errorKind === "request" && <Text style={styles.mutedLine}>{t("moving.vehicleCheckError")}</Text>}
          {view?.kind === "no_match" && <Text style={styles.mutedLine}>{t("moving.vehicleCheckNoMatch")}</Text>}
          {view?.kind === "error" && <Text style={styles.mutedLine}>{t("moving.vehicleCheckError")}</Text>}

          {/* Paid-gate teaser — a FREE/lapsed user hit the entitlement gate.
              Show the upgrade CTA (same idiom as the briefing/dossier teasers),
              NOT the NHTSA error line. */}
          {view?.kind === "upgrade" && (
            <View style={styles.upgrade}>
              <Text style={styles.upgradeLabel}>{t("teaser.paidFeatureLabel")}</Text>
              <Text style={styles.upgradePitch}>{t("moving.vehicleCheckUpgradePitch")}</Text>
              <TouchableOpacity
                style={styles.unlockBtn}
                onPress={() => {
                  hapticLight();
                  router.push("/settings/subscription");
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t("teaser.unlockCta")}
              >
                <Lock size={13} color="#fff" />
                <Text style={styles.unlockBtnText}>{t("teaser.unlockCta")}</Text>
                <ArrowRight size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {view?.kind === "vehicle" && (
            <View style={styles.result}>
              <Text style={styles.headline}>
                {view.headline}
                {view.recallCount !== null && (
                  <Text
                    style={view.recallCount > 0 ? styles.recallCountWarn : styles.recallCountOk}
                  >
                    {" — "}
                    {view.recallCount === 0
                      ? t("moving.vehicleCheckRecallsNone")
                      : t("moving.vehicleCheckRecallCount", { count: view.recallCount })}
                  </Text>
                )}
              </Text>
              {view.recallCount === null && (
                <Text style={styles.mutedLine}>{t("moving.vehicleCheckRecallsUnavailable")}</Text>
              )}
              {view.recallItems.map((item, i) => (
                <Text key={item.campaignNumber || `recall-${i}`} style={styles.recallItem}>
                  <Text style={styles.recallComponent}>{item.component || item.campaignNumber}</Text>
                  {item.summary ? ` — ${item.summary}` : ""}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => void openWebUrl(NHTSA_RECALLS_URL)}
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>{t("moving.vehicleCheckRecallsLink")}</Text>
                <ExternalLink size={11} color={theme.colors.primary} />
              </TouchableOpacity>
              {dmv && state && (
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => void openWebUrl(dmv.website)}
                  accessibilityRole="link"
                >
                  <Text style={styles.linkText}>
                    {t("moving.vehicleCheckDmvLink", { state, name: dmv.name })}
                  </Text>
                  <ExternalLink size={11} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* MANDATORY fine print — NHTSA data, the DMV owns the requirements */}
          <Text style={styles.finePrint}>{t("moving.vehicleCheckFinePrint")}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { marginTop: 10 },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    triggerText: { fontSize: 11, fontWeight: "700", color: theme.colors.textSecondary },
    panel: {
      marginTop: 8,
      padding: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: "rgba(255,255,255,0.02)",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    intro: { fontSize: 11, color: theme.colors.textTertiary, lineHeight: 16 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    vinInput: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 13,
      letterSpacing: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    checkBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 64,
    },
    checkBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    errorText: { fontSize: 11, color: theme.colors.error, marginTop: 8, lineHeight: 16 },
    mutedLine: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 16 },
    result: { marginTop: 10 },
    headline: { fontSize: 13, fontWeight: "700", color: theme.colors.text, lineHeight: 19 },
    recallCountWarn: { color: theme.colors.amber.text, fontWeight: "700" },
    recallCountOk: { color: theme.colors.emerald.text, fontWeight: "700" },
    recallItem: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 6, lineHeight: 16 },
    recallComponent: { fontWeight: "700", color: theme.colors.textSecondary },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, alignSelf: "flex-start" },
    linkText: { fontSize: 11, fontWeight: "600", color: theme.colors.primary },
    finePrint: { fontSize: 10, color: theme.colors.textMuted, lineHeight: 15, marginTop: 10 },
    // Paid-gate teaser — same CTA idiom as MoveBriefingCard / FreeMoveUpsellCard.
    upgrade: { marginTop: 10 },
    upgradeLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: theme.colors.textTertiary,
    },
    upgradePitch: {
      fontSize: 11,
      color: theme.colors.textTertiary,
      lineHeight: 16,
      marginTop: 4,
    },
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 9,
      marginTop: 10,
    },
    unlockBtnText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
  });
