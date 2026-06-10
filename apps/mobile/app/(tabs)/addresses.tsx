import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Plus, Check, AlertTriangle, ArrowRight, List, Map as MapIcon } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { monthlyAmountForCycle, normalizeMovingPlanStatus } from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { GradientProgress } from "@/components/ui/GradientProgress";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { AddressesMap } from "@/components/addresses/AddressesMap";
import type { Address } from "@locateflow/shared";

// ── Addresses "Hub" recreation of the Aurora design (explore/Mobile Addresses) ──

type StatusKind = "active" | "moving" | "seasonal" | "past";

/** True monthly cost for an address — normalizes each service's per-cycle amount
 *  (yearly/12, quarterly/3, one-time → 0) instead of summing raw, matching the
 *  budget engine. */
function addressPerMonth(address: Address): number {
  return (address.services || []).reduce(
    (sum, s: any) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle),
    0,
  );
}

function addressStatus(address: Address): { kind: StatusKind; label: string } {
  if (address.type === "VACATION") return { kind: "seasonal", label: "Seasonal" };
  if (address.endDate && new Date(address.endDate).getTime() < Date.now()) {
    return { kind: "past", label: "Past" };
  }
  return { kind: "active", label: "Active" };
}

/** The single critical signal on each card. Past addresses that still carry
 *  services surface the warn line ("N accounts still point here"); the current
 *  home reassures; everything else is neutral. */
function addressSignal(address: Address): { ok: boolean; text: string } | null {
  const count = address.services?.length || 0;
  const st = addressStatus(address);
  if (st.kind === "past" && count > 0) {
    return { ok: false, text: `${count} ${count === 1 ? "account" : "accounts"} still point here` };
  }
  if (address.isPrimary) {
    return count > 0 ? { ok: true, text: "All accounts point here" } : null;
  }
  if (count > 0) {
    return { ok: true, text: `${count} ${count === 1 ? "account" : "accounts"} tied here` };
  }
  return null;
}

function statusTone(kind: StatusKind, theme: Theme) {
  switch (kind) {
    case "seasonal":
      return theme.colors.rose; // Aurora cool (info)
    case "moving":
    case "past":
      return theme.colors.amber; // honey / foil
    default:
      return theme.colors.emerald; // sage
  }
}

/** Stylized mini-map tile with a teardrop pin colored by status (recreates the
 *  design's .ad-thumb — no real map needed). */
function AddressThumb({ color, size = 60, theme }: { color: string; size?: number; theme: Theme }) {
  const grid = "rgba(236,241,248,0.06)";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#0B121E",
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {[0.32, 0.62].map((t) => (
        <View key={`h${t}`} style={{ position: "absolute", left: 0, right: 0, top: `${t * 100}%`, height: 1, backgroundColor: grid }} />
      ))}
      {[0.4, 0.7].map((t) => (
        <View key={`v${t}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${t * 100}%`, width: 1, backgroundColor: grid }} />
      ))}
      <View style={{ position: "absolute", left: "-10%", right: "-10%", top: "56%", height: 2, backgroundColor: "rgba(236,241,248,0.10)", transform: [{ rotate: "-12deg" }] }} />
      <View
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 16,
          height: 16,
          marginLeft: -8,
          marginTop: -10,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: color + "33",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
          borderBottomLeftRadius: 2,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}

/** Small "linked services" health ring (recreates the design's ADHealth). */
function AddressHealthRing({ count, color, size = 46, theme }: { count: number; color: string; size?: number; theme: Theme }) {
  const stroke = 4;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={cx} cy={cx} r={r} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
        {count > 0 && (
          <Circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} />
        )}
      </Svg>
      <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.text, lineHeight: 14 }}>{count}</Text>
      <Text style={{ fontSize: 7, letterSpacing: 0.5, textTransform: "uppercase", color: theme.colors.textTertiary, marginTop: 1 }}>linked</Text>
    </View>
  );
}

export default function AddressesScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { t, i18n } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seg, setSeg] = useState<"all" | "active" | "past">("all");
  const [viewMode, setViewMode] = useState<"hub" | "map">("hub");
  // Active moving plan (PLANNING / IN_PROGRESS) powering the move-in-transit
  // banner. Best-effort: any error just hides the banner — it never blocks
  // the addresses list.
  const [activeMove, setActiveMove] = useState<any | null>(null);

  const fetchAddresses = useCallback(async () => {
    // limit=200 (the route max): these are small per-user collections shown as
    // one list — the default page size of 50 silently dropped power users' rows.
    // /api/moving is the same light list call Home + Services already make; it
    // only feeds the transit banner, so its failure is swallowed.
    const [res, movingRes] = await Promise.all([
      api.get<any>("/api/addresses", { limit: "200" }),
      api.get<any>("/api/moving").catch(() => ({ data: null, error: true }) as any),
    ]);
    const plans: any[] = movingRes?.data?.plans || [];
    setActiveMove(
      plans.find((p: any) => {
        const s = normalizeMovingPlanStatus(p.status);
        return s === "PLANNING" || s === "IN_PROGRESS";
      }) || null,
    );
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setAddresses(res.data.addresses || []);
      setError(null);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAddresses();
    } finally {
      setLoading(false);
    }
  }, [fetchAddresses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAddresses();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAddresses]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("addresses.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color="#fff" />
          </View>
        </View>
        <View style={[styles.scrollContent, styles.list]}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} showFooter />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const totalMonthly = addresses.reduce((sum, a) => sum + addressPerMonth(a), 0);
  const totalServices = addresses.reduce((sum, a) => sum + (a.services?.length || 0), 0);
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Segmented filter: All / Active (current + seasonal) / Past.
  const visible = addresses.filter((a) => {
    if (seg === "all") return true;
    const k = addressStatus(a).kind;
    return seg === "past" ? k === "past" : k !== "past";
  });
  const current = visible.filter((a) => a.isPrimary);
  const other = visible.filter((a) => !a.isPrimary);

  // ── Move-in-transit banner (recreates the design's .ad-transit) ──
  // Derived entirely from data already on this screen: the active plan from
  // /api/moving plus the per-address service lists. Progress = share of the
  // move's tracked services already at the NEW address — the same old/new
  // split the move screen's "Set up at new / Still at old" panels render.
  const transitFrom = activeMove ? addresses.find((a) => a.id === activeMove.fromAddress?.id) : undefined;
  const transitTo = activeMove ? addresses.find((a) => a.id === activeMove.toAddress?.id) : undefined;
  const transitStillAtOld = transitFrom?.services?.length || 0;
  const transitAtNew = transitTo?.services?.length || 0;
  const transitTotal = transitStillAtOld + transitAtNew;
  const transitPct = transitTotal > 0 ? Math.round((transitAtNew / transitTotal) * 100) : 0;
  const transitFromCity = activeMove?.fromAddress?.city || "—";
  const transitToCity = activeMove?.toAddress?.city || "—";
  // Banner steals entrance slot 0, so the address cards cascade after it.
  const entranceBase = activeMove ? 1 : 0;

  const renderCard = (address: Address, index: number) => {
    const st = addressStatus(address);
    const tone = statusTone(st.kind, theme);
    const signal = addressSignal(address);
    const count = address.services?.length || 0;
    const perMo = addressPerMonth(address);
    const cur = address.isPrimary && st.kind !== "past";
    return (
      <ListEntrance key={address.id} index={index}>
        <PressableScale
          style={[styles.adCard, cur && styles.adCardCur]}
          onPress={() => router.push({ pathname: "/addresses/[id]", params: { id: address.id } })}
          accessibilityLabel={address.nickname || address.street}
        >
          <AddressThumb color={tone.text} size={cur ? 72 : 60} theme={theme} />
          <View style={styles.adBody}>
            <View style={styles.adLblRow}>
              <Text style={[styles.adLbl, cur && styles.adLblBig]} numberOfLines={1}>
                {address.nickname || (address.isPrimary ? "Current home" : address.street)}
              </Text>
              <View style={[styles.adChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <Text style={[styles.adChipText, { color: tone.text }]}>{st.label}</Text>
              </View>
            </View>
            <Text style={styles.adAddr} numberOfLines={1}>
              {address.street}, {address.city}, {address.state}
            </Text>
            {signal && (
              <View style={styles.adSignal}>
                {signal.ok ? (
                  <Check size={14} color={theme.colors.emerald.text} />
                ) : (
                  <AlertTriangle size={14} color={theme.colors.error} />
                )}
                <Text
                  style={[styles.adSignalText, { color: signal.ok ? theme.colors.emerald.text : theme.colors.error }]}
                  numberOfLines={1}
                >
                  {signal.text}
                </Text>
              </View>
            )}
            <View style={styles.adMetrics}>
              <View style={styles.adMetric}>
                <Text style={styles.adMetricV}>{count}</Text>
                <Text style={styles.adMetricK}>services</Text>
              </View>
              {perMo > 0 && (
                <View style={styles.adMetric}>
                  <Text style={styles.adMetricV}>{fmtUsd(perMo)}</Text>
                  <Text style={styles.adMetricK}>per mo</Text>
                </View>
              )}
            </View>
          </View>
          <AddressHealthRing count={count} color={tone.text} size={cur ? 56 : 46} theme={theme} />
        </PressableScale>
      </ListEntrance>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("addresses.title")}</Text>
          <Text style={styles.subtitle}>
            {addresses.length} · {totalServices} {t("services.title").toLowerCase()} · {fmtUsd(totalMonthly)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "hub" && styles.viewToggleBtnOn]}
              onPress={() => setViewMode("hub")}
              accessibilityLabel="List view"
            >
              <List size={18} color={viewMode === "hub" ? theme.colors.primary : theme.colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "map" && styles.viewToggleBtnOn]}
              onPress={() => setViewMode("map")}
              accessibilityLabel="Map view"
            >
              <MapIcon size={18} color={viewMode === "map" ? theme.colors.primary : theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <PressableScale
            style={styles.addButton}
            onPress={() => router.push("/addresses/new")}
            accessibilityLabel={t("addresses.newTitle")}
          >
            <Plus size={20} color="#fff" />
          </PressableScale>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {error && addresses.length > 0 ? (
          <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && addresses.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : addresses.length === 0 ? (
          <EmptyState
            mascot="dad"
            icon={<MapPin size={32} color={theme.colors.primary} />}
            title={t("addresses.empty")}
            description={t("addresses.emptyDescription")}
            actionLabel={t("addresses.newTitle")}
            onAction={() => router.push("/addresses/new")}
          />
        ) : viewMode === "map" ? (
          <AddressesMap
            addresses={addresses}
            onOpen={(id) => router.push({ pathname: "/addresses/[id]", params: { id } })}
          />
        ) : (
          <>
            {/* Segmented filter */}
            <View style={styles.seg}>
              {(["all", "active", "past"] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.segBtn, seg === k && styles.segBtnOn]}
                  onPress={() => setSeg(k)}
                >
                  <Text style={[styles.segText, seg === k && styles.segTextOn]}>
                    {k === "all" ? "All" : k === "active" ? "Active" : "Past"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Move-in-transit banner — origin → destination route + progress */}
            {activeMove && (
              <ListEntrance index={0}>
                <PressableScale
                  style={styles.transit}
                  onPress={() => router.push({ pathname: "/moving/[id]", params: { id: activeMove.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("addresses.transit.title", { pct: transitPct })}. ${transitFromCity} ${t(
                    "addresses.transit.fromRole",
                  )}. ${transitToCity} ${t("addresses.transit.toRole")}.`}
                >
                  <Text style={styles.transitKicker}>{t("addresses.transit.title", { pct: transitPct })}</Text>
                  <View style={styles.transitRoute}>
                    <View style={styles.transitNode}>
                      <Text style={styles.transitCity} numberOfLines={1}>
                        {transitFromCity}
                        {activeMove.fromAddress?.state ? `, ${activeMove.fromAddress.state}` : ""}
                      </Text>
                      <Text style={styles.transitSub}>{t("addresses.transit.fromRole")}</Text>
                    </View>
                    <View style={styles.transitDash}>
                      {[0, 1, 2].map((d) => (
                        <View key={d} style={styles.transitDashSeg} />
                      ))}
                    </View>
                    <View style={styles.transitArrow}>
                      <ArrowRight size={15} color={theme.colors.primary} />
                    </View>
                    <View style={styles.transitDash}>
                      {[0, 1, 2].map((d) => (
                        <View key={d} style={styles.transitDashSeg} />
                      ))}
                    </View>
                    <View style={styles.transitNode}>
                      <Text style={styles.transitCity} numberOfLines={1}>
                        {transitToCity}
                        {activeMove.toAddress?.state ? `, ${activeMove.toAddress.state}` : ""}
                      </Text>
                      <Text style={styles.transitSub}>{t("addresses.transit.toRole")}</Text>
                    </View>
                  </View>
                  <GradientProgress
                    progress={transitPct}
                    height={5}
                    animated={!reduceMotion}
                    colors={[theme.colors.success, theme.colors.primary]}
                    trackColor={theme.colors.glass.highlight}
                    style={styles.transitBar}
                  />
                  {transitStillAtOld > 0 && (
                    <View style={styles.transitWarn}>
                      <AlertTriangle size={13} color={theme.colors.error} />
                      <Text style={styles.transitWarnText} numberOfLines={1}>
                        {t("addresses.transit.stillAtOld", { count: transitStillAtOld })}
                      </Text>
                    </View>
                  )}
                </PressableScale>
              </ListEntrance>
            )}

            {current.length > 0 && (
              <>
                <Text style={styles.adSectionLbl}>Current</Text>
                <View style={styles.list}>{current.map((a, i) => renderCard(a, i + entranceBase))}</View>
              </>
            )}
            {other.length > 0 && (
              <>
                <Text style={styles.adSectionLbl}>{current.length > 0 ? "Past & other" : "Addresses"}</Text>
                <View style={styles.list}>{other.map((a, i) => renderCard(a, i + current.length + entranceBase))}</View>
              </>
            )}
            {visible.length === 0 && (
              <Text style={[styles.adSectionLbl, { textAlign: "center", marginTop: 24 }]}>
                No {seg} addresses
              </Text>
            )}

            <TouchableOpacity style={styles.adAddCard} onPress={() => router.push("/addresses/new")}>
              <Plus size={16} color={theme.colors.textTertiary} />
              <Text style={styles.adAddText}>Add another address</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.glow,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewToggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  viewToggleBtn: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  viewToggleBtnOn: { backgroundColor: theme.colors.primaryFaded },
  // ── Hub (Aurora design recreation) ──
  seg: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  segBtn: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segBtnOn: { backgroundColor: theme.colors.primaryFaded },
  segText: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  segTextOn: { color: theme.colors.primary },
  adSectionLbl: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginTop: 16,
    marginBottom: 9,
    marginLeft: 2,
  },
  adCard: {
    flexDirection: "row",
    gap: 13,
    padding: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "flex-start",
  },
  adCardCur: {
    borderColor: "rgba(127, 182, 232, 0.32)",
    ...theme.shadow.glow,
  },
  adBody: { flex: 1, minWidth: 0, alignSelf: "center" },
  adLblRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adLbl: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  adLblBig: { fontSize: 17 },
  adChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  adChipText: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "800" },
  adAddr: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  adSignal: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  adSignalText: { flex: 1, fontSize: 12, fontWeight: "600" },
  adMetrics: { flexDirection: "row", gap: 16, marginTop: 9 },
  adMetric: {},
  adMetricV: { fontSize: 13, fontWeight: "800", color: theme.colors.text },
  adMetricK: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  adAddCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    marginTop: 14,
  },
  adAddText: { fontSize: 13, color: theme.colors.textTertiary, fontWeight: "600" },
  // ── Move-in-transit banner (recreates the design's .ad-transit) ──
  transit: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 2,
    ...theme.shadow.glow,
  },
  transitKicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "700",
    color: theme.colors.accent,
  },
  transitRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  transitNode: { flexShrink: 1 },
  transitCity: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  transitSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  transitDash: {
    flex: 1,
    minWidth: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  transitDashSeg: {
    width: 5,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.borderFocus,
  },
  transitArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  transitBar: { marginTop: 10 },
  transitWarn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
  transitWarnText: { flex: 1, fontSize: 12, fontWeight: "600", color: theme.colors.error },
});
