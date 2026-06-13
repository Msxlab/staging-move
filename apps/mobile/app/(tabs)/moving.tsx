import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Truck,
  Plus,
  Calendar,
  ArrowRight,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { OfflineChip } from "@/components/ui/OfflineChip";
import { readOfflineCache, writeOfflineCache, asArray } from "@/lib/offline-cache";
import { normalizeMovingPlanStatus, formatRelativeTime } from "@locateflow/shared";

/** Offline-cache key for the Moving screen's last-known plan list. */
const MOVING_CACHE = "moving";

// ── Moving "Move history" recreation of the Aurora design (services-more /
// MoveHistoryView): lifetime stat summary + left-accent route cards. ──

/** Live = a move that is still underway (the design's "Active" moves). */
function isLiveStatus(status: string): boolean {
  return status === "PLANNING" || status === "IN_PROGRESS";
}

/** Honest, derivable progress for a live move: fraction of the runway between
 *  plan creation and the move date already elapsed. Null when not derivable. */
function timeProgress(plan: any): number | null {
  const created = new Date(plan.createdAt).getTime();
  const move = new Date(plan.moveDate).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(move) || move <= created) return null;
  const f = (Date.now() - created) / (move - created);
  return Math.max(0.04, Math.min(1, f));
}

export default function MovingScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offline fallback: true when the live fetch failed but we still have plans on
  // screen (from cache or a prior load). Mirrors the dashboard's offline chip.
  const [offline, setOffline] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const fetchPlansRef = useRef<() => Promise<boolean>>(async () => false);

  // Cold-start hydration: show the last-known plan list instantly (no skeleton/
  // error wall) on a no-signal launch, then reconcile against the live fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readOfflineCache(MOVING_CACHE, asArray);
      if (cancelled || !cached || hasDataRef.current) return;
      setPlans(cached.data as any[]);
      setCacheUpdatedAt(cached.updatedAt);
      hasDataRef.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPlans = useCallback(async () => {
    const res = await api.get<any>("/api/moving");
    if (res.error) {
      // OFFLINE FALLBACK: keep cached/prior plans + show the offline chip rather
      // than the error wall when we have something to show.
      if (hasDataRef.current) {
        setOffline(true);
        setError(null);
      } else {
        setError(res.error);
      }
      return false;
    }
    if (res.data) {
      const nextPlans = res.data.plans || [];
      setPlans(nextPlans);
      setError(null);
      setOffline(false);
      hasDataRef.current = true;
      const now = new Date();
      setCacheUpdatedAt(now.toISOString());
      void writeOfflineCache(MOVING_CACHE, nextPlans, now);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPlans();
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPlans();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPlans]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchPlansRef.current = fetchPlans;
  }, [fetchPlans]);

  useFocusEffect(
    useCallback(() => {
      if (!loadedOnceRef.current) return undefined;
      void fetchPlansRef.current();
      return undefined;
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("moving.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color="#fff" />
          </View>
        </View>
        <View style={[styles.scrollContent, styles.list]}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Lifetime summary, derived from the loaded plan list (design's sv-mhsummary).
  const normalized = plans.map((plan: any) => normalizeMovingPlanStatus(plan.status));
  const completedCount = normalized.filter((s) => s === "COMPLETED").length;
  const activeCount = normalized.filter((s) => isLiveStatus(s)).length;

  /** Left accent + status text tone: active = primary, done = success,
   *  archived (canceled / unknown) = border. Plan accents flow through
   *  theme.colors.primary automatically. */
  const accentFor = (status: string) =>
    isLiveStatus(status)
      ? theme.colors.primary
      : status === "COMPLETED"
        ? theme.colors.success
        : theme.colors.border;

  const statusColorFor = (status: string) =>
    isLiveStatus(status)
      ? theme.colors.primary
      : status === "COMPLETED"
        ? theme.colors.success
        : theme.colors.textMuted;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("moving.title")}</Text>
          <Text style={styles.subtitle}>{plans.length}</Text>
        </View>
        <PressableScale
          style={styles.addButton}
          onPress={() => router.push("/moving/new")}
          accessibilityLabel={t("moving.newPlan")}
        >
          <Plus size={20} color="#fff" />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Offline: live fetch failed but we hydrated the last-known plans. */}
        {offline && (
          <OfflineChip relativeAge={cacheUpdatedAt ? formatRelativeTime(cacheUpdatedAt, i18n.language) : ""} />
        )}
        {error && plans.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && plans.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : plans.length === 0 ? (
          <EmptyState
            mascot="kid"
            icon={<Truck size={32} color={theme.colors.primary} />}
            title={t("moving.checklistEmpty")}
            description={t("moving.subtitle")}
            actionLabel={t("moving.newPlan")}
            onAction={() => router.push("/moving/new")}
          />
        ) : (
          <>
            {/* Lifetime summary — total / completed / active */}
            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statV}>{plans.length}</Text>
                <Text style={styles.statK}>{t("moving.statMoves")}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statV}>{completedCount}</Text>
                <Text style={styles.statK}>{t("moving.status_COMPLETED")}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statV, activeCount > 0 && { color: theme.colors.primary }]}>{activeCount}</Text>
                <Text style={styles.statK}>{t("moving.statusActive")}</Text>
              </View>
            </View>

            <View style={styles.list}>
              {plans.map((plan: any, index: number) => {
                const normalizedStatus = normalizeMovingPlanStatus(plan.status);
                const live = isLiveStatus(normalizedStatus);
                const accent = accentFor(normalizedStatus);
                const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const progress = live ? timeProgress(plan) : null;
                const fromCity = plan.fromAddress?.city || "—";
                const toCity = plan.toAddress?.city || "—";
                const statusLabel = t(`moving.status_${normalizedStatus}`, {
                  defaultValue: normalizedStatus.replace("_", " "),
                });

                return (
                  <ListEntrance key={plan.id} index={index}>
                    <PressableScale
                      style={[
                        styles.routeCard,
                        live && styles.routeCardLive,
                        { borderLeftColor: accent },
                      ]}
                      onPress={() => router.push({ pathname: "/moving/[id]", params: { id: plan.id } })}
                      accessibilityLabel={`${fromCity} ${t("moving.to")} ${toCity}, ${statusLabel}`}
                    >
                      {/* Route line + ACTIVE pill */}
                      <View style={styles.routeHd}>
                        <Text style={styles.routeCity} numberOfLines={1}>
                          {fromCity}{plan.fromAddress?.state ? `, ${plan.fromAddress.state}` : ""}
                        </Text>
                        <ArrowRight size={14} color={live ? theme.colors.primary : theme.colors.textMuted} />
                        <Text style={styles.routeCity} numberOfLines={1}>
                          {toCity}{plan.toAddress?.state ? `, ${plan.toAddress.state}` : ""}
                        </Text>
                        {live && (
                          <View style={styles.livePill}>
                            <Text style={styles.livePillText}>{t("moving.statusActive")}</Text>
                          </View>
                        )}
                      </View>

                      {/* Street-level detail, one compact line */}
                      <Text style={styles.streets} numberOfLines={1}>
                        {plan.fromAddress?.street || t("moving.fromAddress")} → {plan.toAddress?.street || t("moving.toAddress")}
                      </Text>

                      {/* Meta — date · days left · status */}
                      <View style={styles.meta}>
                        <Calendar size={12} color={theme.colors.textMuted} />
                        <Text style={styles.metaText}>
                          {new Date(plan.moveDate).toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric", year: "numeric" })}
                        </Text>
                        {daysUntil > 0 && (
                          <Text style={styles.daysLeft}>{daysUntil}d</Text>
                        )}
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={[styles.metaStatus, { color: statusColorFor(normalizedStatus) }]}>
                          {statusLabel}
                        </Text>
                      </View>

                      {/* Runway progress on live moves (creation → move date) */}
                      {progress != null && (
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                        </View>
                      )}
                    </PressableScale>
                  </ListEntrance>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.newMoveCard}
              onPress={() => router.push("/moving/new")}
              accessibilityRole="button"
              accessibilityLabel={t("moving.newPlan")}
            >
              <Plus size={16} color={theme.colors.textTertiary} />
              <Text style={styles.newMoveText}>{t("moving.newPlan")}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: 0 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 10 },
  // ── Lifetime summary (design sv-mhsummary) ──
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statTile: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statV: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  statK: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginTop: 3,
  },
  // ── Route cards (design sv-move) ──
  routeCard: {
    padding: 15,
    paddingLeft: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
  },
  routeCardLive: {
    ...theme.shadow.glow,
  },
  routeHd: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeCity: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text, letterSpacing: 0 },
  livePill: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: theme.colors.primaryFaded,
    borderColor: theme.colors.borderFocus,
  },
  livePillText: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "800",
    color: theme.colors.primary,
  },
  streets: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" },
  metaText: { fontSize: 11, color: theme.colors.textTertiary },
  daysLeft: { fontSize: 11, color: theme.colors.amber.text, fontWeight: "600", marginLeft: 4 },
  metaDot: { fontSize: 11, color: theme.colors.textMuted },
  metaStatus: { fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surface,
    marginTop: 11,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: theme.colors.primary },
  // ── Dashed create-new-move card (Hub idiom) ──
  newMoveCard: {
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
  newMoveText: { fontSize: 13, color: theme.colors.textTertiary, fontWeight: "600" },
});
