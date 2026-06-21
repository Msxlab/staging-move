import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MapPin,
  Plus,
  AlertTriangle,
  ArrowRight,
  List,
  Map as MapIcon,
  ChevronRight,
  Navigation,
  Pencil,
  Home,
} from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { monthlyAmountForCycle, normalizeMovingPlanStatus } from "@locateflow/shared";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { GradientProgress } from "@/components/ui/GradientProgress";
import { PressableScale } from "@/components/ui/PressableScale";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import { AddressesMap } from "@/components/addresses/AddressesMap";
import { TransitRouteMap } from "@/components/addresses/TransitRouteMap";
import { HeroCard, MoveCard, SectionHeader, Pill, type PillTone } from "@/components/move";
import { useAuthStore } from "@/lib/auth-store";
import { addressLimitForPlan } from "@/lib/plan-comparison";
import type { Address } from "@locateflow/shared";

// ── Addresses tab — reskinned to the Move design's ADDRESSES layout ──

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

/** Map an address's status to a Move-kit Pill tone + an accent color used for
 *  the map pin / detail kicker. */
function statusTone(kind: StatusKind, theme: Theme): { pill: PillTone; color: string } {
  switch (kind) {
    case "seasonal":
      return { pill: "info", color: theme.colors.teal };
    case "moving":
    case "past":
      return { pill: "warning", color: theme.colors.amberSolid };
    default:
      return { pill: "success", color: theme.colors.green };
  }
}

export default function AddressesScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const planTier = useAuthStore((s) => s.planTier);
  const reduceMotion = useReducedMotion();
  const { t, i18n } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seg, setSeg] = useState<"all" | "active" | "past">("all");
  const [viewMode, setViewMode] = useState<"hub" | "map">("hub");
  // Selected address index powering the design's chip row → map → detail card →
  // "services at this address" rows. Presentation-only; clamps in render.
  const [addrSel, setAddrSel] = useState(0);
  // Active moving plan (PLANNING / IN_PROGRESS) powering the move-in-transit
  // banner. Best-effort: any error just hides the banner — it never blocks
  // the addresses list.
  const [activeMove, setActiveMove] = useState<any | null>(null);
  const loadedOnceRef = React.useRef(false);
  const fetchAddressesRef = React.useRef<() => Promise<boolean>>(async () => false);

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
      loadedOnceRef.current = true;
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

  useEffect(() => {
    fetchAddressesRef.current = fetchAddresses;
  }, [fetchAddresses]);

  useFocusEffect(
    useCallback(() => {
      if (!loadedOnceRef.current) return undefined;
      void fetchAddressesRef.current();
      return undefined;
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("addresses.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color={theme.colors.onAccent} />
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
  const addressLimit = addressLimitForPlan(planTier);
  const addressLimitReached = addresses.length >= addressLimit;
  const openNewAddress = () => {
    if (addressLimitReached) {
      Alert.alert(
        t("addresses.limitReachedTitle", { defaultValue: "Address limit reached" }),
        t("addresses.limitReachedWithCount", {
          current: addresses.length,
          limit: addressLimit,
          defaultValue: `Your plan includes ${addressLimit} addresses. Upgrade to add more.`,
        }),
        [
          { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
          { text: t("subscription.upgrade", { defaultValue: "Upgrade" }), onPress: () => router.push("/settings/subscription") },
        ],
      );
      return;
    }
    router.push("/addresses/new");
  };
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Segmented filter: All / Active (current + seasonal) / Past.
  const visible = addresses.filter((a) => {
    if (seg === "all") return true;
    const k = addressStatus(a).kind;
    return seg === "past" ? k === "past" : k !== "past";
  });

  // Selected address for the chip row / map / detail card / services rows.
  const selIdx = visible.length > 0 ? Math.min(addrSel, visible.length - 1) : 0;
  const selected: Address | undefined = visible[selIdx];
  const selStatus = selected ? addressStatus(selected) : null;
  const selTone = selStatus ? statusTone(selStatus.kind, theme) : null;
  const selServices: any[] = (selected?.services as any[]) || [];

  // ── Move-in-transit banner (the design's "Your move" route HeroCard) ──
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

  const openMaps = (a: Address) => {
    router.push({ pathname: "/addresses/[id]", params: { id: a.id } });
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
              <List size={18} color={viewMode === "hub" ? theme.colors.primary : theme.colors.faint} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === "map" && styles.viewToggleBtnOn]}
              onPress={() => setViewMode("map")}
              accessibilityLabel="Map view"
            >
              <MapIcon size={18} color={viewMode === "map" ? theme.colors.primary : theme.colors.faint} />
            </TouchableOpacity>
          </View>
          <PressableScale
            style={styles.addButton}
            onPress={openNewAddress}
            accessibilityLabel={t("addresses.newTitle")}
          >
            <Plus size={20} color={theme.colors.onAccent} />
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
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
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
            onAction={openNewAddress}
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
                  onPress={() => {
                    setSeg(k);
                    setAddrSel(0);
                  }}
                >
                  <Text style={[styles.segText, seg === k && styles.segTextOn]}>
                    {k === "all" ? "All" : k === "active" ? "Active" : "Past"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* "Your move" — animated origin → destination route HeroCard */}
            {activeMove && (
              <PressableScale
                onPress={() => router.push({ pathname: "/moving/[id]", params: { id: activeMove.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${t("addresses.transit.title", { pct: transitPct })}. ${transitFromCity} ${t(
                  "addresses.transit.fromRole",
                )}. ${transitToCity} ${t("addresses.transit.toRole")}.`}
                style={styles.heroWrap}
              >
                <HeroCard padding={16} radius={20}>
                  <View style={styles.heroHead}>
                    <Text style={styles.heroKicker}>{t("addresses.transit.title", { pct: transitPct })}</Text>
                    <Pill label={`${transitPct}%`} tone="accent" />
                  </View>
                  {/* Real route map (Google/Geoapify static via the authed
                      proxy). Renders null on any failure — the stylized dashed
                      route below remains the graceful fallback. */}
                  <TransitRouteMap
                    activeMove={activeMove}
                    addresses={addresses}
                    fromCity={transitFromCity}
                    toCity={transitToCity}
                  />
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
                    <View style={[styles.transitNode, { alignItems: "flex-end" }]}>
                      <Text style={[styles.transitCity, { textAlign: "right" }]} numberOfLines={1}>
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
                    trackColor={theme.colors.track}
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
                </HeroCard>
              </PressableScale>
            )}

            {visible.length === 0 ? (
              <Text style={styles.emptySeg}>No {seg} addresses</Text>
            ) : (
              <>
                {/* Horizontally-scrollable address chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                  style={styles.chipsScroll}
                >
                  {visible.map((a, i) => {
                    const st = addressStatus(a);
                    const tone = statusTone(st.kind, theme);
                    const on = i === selIdx;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.chip, on && { borderColor: tone.color, backgroundColor: theme.colors.surface2 }]}
                        onPress={() => setAddrSel(i)}
                        accessibilityRole="button"
                        accessibilityLabel={a.nickname || a.street}
                      >
                        <View style={[styles.chipDot, { backgroundColor: tone.color }]} />
                        <Text style={[styles.chipText, on && { color: theme.colors.text }]} numberOfLines={1}>
                          {a.nickname || (a.isPrimary ? "Current home" : a.city || a.street)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Live map card — reuses the screen's existing map component */}
                <View style={styles.mapCard}>
                  <AddressesMap
                    addresses={visible}
                    onOpen={(id) => router.push({ pathname: "/addresses/[id]", params: { id } })}
                  />
                </View>

                {/* Selected-address detail card */}
                {selected && selStatus && selTone && (
                  <MoveCard style={styles.detailCard} padding={16} radius={18}>
                    <View style={styles.detailHead}>
                      <Text style={[styles.detailKicker, { color: selTone.color }]}>
                        {selStatus.label}
                      </Text>
                      {selected.isPrimary && <Pill label="Primary" tone="accent" />}
                    </View>
                    <Text style={styles.detailStreet} numberOfLines={1}>
                      {selected.nickname || selected.street}
                    </Text>
                    <Text style={styles.detailCity} numberOfLines={1}>
                      {selected.street}, {selected.city}, {selected.state}
                    </Text>
                    {selected.startDate && (
                      <Text style={styles.detailMeta}>
                        Move-in:{" "}
                        {new Date(selected.startDate).toLocaleDateString(i18n.language || "en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    )}
                    <View style={styles.detailActions}>
                      <TouchableOpacity
                        style={[styles.detailAction, styles.detailActionPrimary]}
                        onPress={() => openMaps(selected)}
                      >
                        <Navigation size={13} color={theme.colors.primary} />
                        <Text style={[styles.detailActionText, { color: theme.colors.primary }]}>Directions</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detailAction}
                        onPress={() => router.push({ pathname: "/addresses/[id]", params: { id: selected.id } })}
                      >
                        <Pencil size={13} color={theme.colors.dim} />
                        <Text style={styles.detailActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detailAction}
                        onPress={() => router.push({ pathname: "/addresses/[id]", params: { id: selected.id } })}
                      >
                        <Home size={13} color={theme.colors.dim} />
                        <Text style={styles.detailActionText}>Set primary</Text>
                      </TouchableOpacity>
                    </View>
                  </MoveCard>
                )}

                {/* Services at this address */}
                <SectionHeader label="Services at this address" style={styles.sectionHeader} />
                {selServices.length === 0 ? (
                  <View style={styles.svcEmpty}>
                    <Text style={styles.svcEmptyText}>No services tracked at this address yet.</Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {selServices.slice(0, 8).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.svcRow}
                        onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
                      >
                        <View style={styles.svcIcon}>
                          <CategoryIcon
                            emoji={getMergedDisplayCategoryIcon(s.category) || ""}
                            size={15}
                            color={theme.colors.primary}
                          />
                        </View>
                        <Text style={styles.svcName} numberOfLines={1}>
                          {s.providerName || s.provider?.name || "Service"}
                        </Text>
                        <ChevronRight size={14} color={theme.colors.faint} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* All addresses */}
                <SectionHeader label="All addresses" style={styles.sectionHeader} />
                <View style={styles.list}>
                  {visible.map((a, i) => {
                    const st = addressStatus(a);
                    const tone = statusTone(st.kind, theme);
                    const on = i === selIdx;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.allRow, on && { borderColor: tone.color, backgroundColor: theme.colors.surface2 }]}
                        onPress={() => router.push({ pathname: "/addresses/[id]", params: { id: a.id } })}
                        onLongPress={() => setAddrSel(i)}
                        accessibilityLabel={a.nickname || a.street}
                      >
                        <View style={[styles.allDot, { backgroundColor: tone.color }]} />
                        <View style={styles.allBody}>
                          <Text style={styles.allLabel} numberOfLines={1}>
                            {a.nickname || (a.isPrimary ? "Current home" : a.street)}
                          </Text>
                          <Text style={styles.allCity} numberOfLines={1}>
                            {a.city}, {a.state}
                          </Text>
                        </View>
                        <Text style={[styles.allStatus, { color: tone.color }]}>{st.label}</Text>
                        <ChevronRight size={16} color={theme.colors.faint} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Add address */}
                <TouchableOpacity
                  style={[styles.addCard, addressLimitReached && styles.addCardLimit]}
                  onPress={addressLimitReached ? () => router.push("/settings/subscription") : openNewAddress}
                >
                  <Plus size={16} color={theme.colors.primary} />
                  <Text style={[styles.addText, addressLimitReached && styles.addTextLimit]}>
                    {addressLimitReached
                      ? t("addresses.limitReachedWithCount", {
                          current: addresses.length,
                          limit: addressLimit,
                          defaultValue: `Your plan includes ${addressLimit} addresses. Upgrade to add more.`,
                        })
                      : "Add address"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    fontSize: 26,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
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
  list: { gap: 8 },
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
  errorBanner: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.redLine,
    backgroundColor: theme.colors.redSoft,
  },
  errorBannerText: { color: theme.colors.error, fontSize: 12, fontFamily: fonts.sansMedium, textAlign: "center" },
  // ── Segmented filter ──
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
    fontFamily: fonts.sansBold,
    color: theme.colors.faint,
  },
  segTextOn: { color: theme.colors.primary },
  emptySeg: {
    fontSize: 12,
    fontFamily: fonts.sansMedium,
    color: theme.colors.faint,
    textAlign: "center",
    marginTop: 24,
  },
  // ── "Your move" route HeroCard ──
  heroWrap: { marginBottom: 16 },
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: fonts.sansBold,
    color: theme.colors.primary,
  },
  transitRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  transitNode: { flexShrink: 1, maxWidth: "38%" },
  transitCity: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  transitSub: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 1 },
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
    backgroundColor: theme.colors.accentBorder,
  },
  transitArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  transitBar: { marginTop: 12 },
  transitWarn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  transitWarnText: { flex: 1, fontSize: 12, fontFamily: fonts.sansSemibold, color: theme.colors.error },
  // ── Address chips ──
  chipsScroll: { marginHorizontal: -20, marginBottom: 14 },
  chipsRow: { gap: 8, paddingHorizontal: 20 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 99,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    maxWidth: 180,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontFamily: fonts.sansBold, color: theme.colors.dim, flexShrink: 1 },
  // ── Live map card ──
  mapCard: { marginBottom: 4 },
  // ── Detail card ──
  detailCard: { marginBottom: 4 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  detailKicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: fonts.sansBold,
  },
  detailStreet: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.text },
  detailCity: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 2 },
  detailMeta: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 4 },
  detailActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  detailAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailActionPrimary: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accentBorder,
  },
  detailActionText: { fontSize: 11, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  // ── Section header spacing ──
  sectionHeader: { marginTop: 22, marginBottom: 10, marginLeft: 2 },
  // ── Services at this address ──
  svcEmpty: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
  },
  svcEmptyText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, textAlign: "center" },
  svcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  svcIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  svcName: { flex: 1, fontSize: 12.5, fontFamily: fonts.sansMedium, color: theme.colors.text },
  // ── All addresses ──
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  allDot: { width: 10, height: 10, borderRadius: 5 },
  allBody: { flex: 1, minWidth: 0 },
  allLabel: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  allCity: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 1 },
  allStatus: { fontSize: 9, fontFamily: fonts.sansBold, letterSpacing: 0.4 },
  // ── Add address ──
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSoft,
    marginTop: 16,
  },
  addCardLimit: {
    borderStyle: "solid",
    borderColor: theme.colors.borderFocus,
  },
  addText: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
  addTextLimit: { textAlign: "center", flex: 1 },
});
