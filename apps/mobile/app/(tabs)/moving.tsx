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
import Svg, { Path, Circle, G } from "react-native-svg";
import {
  Truck,
  Plus,
  Calendar,
  ArrowRight,
  ChevronRight,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { OfflineChip } from "@/components/ui/OfflineChip";
import {
  MoveRaccoon,
  HeroCard,
  MoveCard,
  SectionHeader,
  MoveProgressBar,
  Pill,
} from "@/components/move";
import { peekOfflineCache, readOfflineCache, writeOfflineCache, asArray } from "@/lib/offline-cache";
import {
  normalizeMovingPlanStatus,
  formatRelativeTime,
  formatDateOnlyUtc,
  getMoveCountdown,
} from "@locateflow/shared";

/** Offline-cache key for the Moving screen's last-known plan list. */
const MOVING_CACHE = "moving";

// ── Moving "Move command" — Move.dc.html MOVING tab reskin. The screen's REAL
// data is a list of moving-plan summaries (no per-task data on the list
// endpoint), so the design's single-move command center is driven by a
// featured live plan plus honest, list-derived signals; the plan list itself
// flows through the "Mission timeline" and "Admin sprint" sections. ──

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
  const initialMovingCache = useMemo(() => peekOfflineCache(MOVING_CACHE, asArray), []);
  const [plans, setPlans] = useState<any[]>(() => (initialMovingCache?.data as any[] | undefined) ?? []);
  const [loading, setLoading] = useState(() => !initialMovingCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offline fallback: true when the live fetch failed but we still have plans on
  // screen (from cache or a prior load). Mirrors the dashboard's offline chip.
  const [offline, setOffline] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(() => initialMovingCache?.updatedAt ?? null);
  // "Category progress" accordion (design's toggleCats / showCats).
  const [showCats, setShowCats] = useState(false);
  const hasDataRef = useRef(Boolean(initialMovingCache));
  const loadedOnceRef = useRef(Boolean(initialMovingCache));
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
    if (!hasDataRef.current) setLoading(true);
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
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{t("moving.title")}</Text>
            <Text style={styles.title}>{t("moving.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color={theme.colors.onAccent} />
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
  const archivedCount = plans.length - completedCount - activeCount;

  // Featured move — the live move we should focus on (the design's hero/route/
  // countdown subject), falling back to the most recent plan when none are live.
  const featured =
    plans.find((p: any) => isLiveStatus(normalizeMovingPlanStatus(p.status))) || plans[0] || null;
  const featuredStatus = featured ? normalizeMovingPlanStatus(featured.status) : "";
  const featuredLive = featured ? isLiveStatus(featuredStatus) : false;
  const featuredCountdown = featured
    ? getMoveCountdown(featured.moveDate, {
        state: featured.toAddress?.state || featured.fromAddress?.state || null,
      })
    : { days: null };
  const featuredDays = featuredCountdown.days;
  const featuredFromCity = featured?.fromAddress?.city || "—";
  const featuredToCity = featured?.toAddress?.city || "—";
  const featuredFromState = featured?.fromAddress?.state || "";
  const featuredToState = featured?.toAddress?.state || "";
  const featuredDateLabel = featured
    ? formatDateOnlyUtc(
        featured.moveDate,
        { month: "short", day: "numeric", year: "numeric" },
        i18n.language || "en-US",
      )
    : "";
  const featuredProgress = featured ? timeProgress(featured) : null;
  const routeSubline =
    featured && featuredDateLabel
      ? `${featuredDateLabel} · ${featuredFromCity} → ${featuredToCity}`
      : t("moving.subtitle");

  // Overall completion across the portfolio (honest list-derived signal).
  const overallPct = plans.length > 0 ? Math.round((completedCount / plans.length) * 100) : 0;

  // Risk gauge — share of active (unsettled) moves drives the needle 0..1.
  const riskRatio = plans.length > 0 ? activeCount / plans.length : 0;

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

  // Ops signals (design's opsSignals) — derived from real portfolio counts.
  const opsSignals = [
    {
      key: "active",
      value: `${activeCount} ${t("moving.statusActive").toLowerCase()}`,
      label: t("moving.statMoves"),
      dot: activeCount > 0 ? theme.colors.primary : theme.colors.faint,
    },
    {
      key: "done",
      value: `${completedCount}`,
      label: t("moving.status_COMPLETED"),
      dot: theme.colors.success,
    },
    {
      key: "eta",
      value: featuredDays != null && featuredDays > 0 ? `${featuredDays}d` : "—",
      label: t("moving.moveDate"),
      dot: theme.colors.info,
    },
  ];

  // Category-progress accordion rows (design's moveCats) — real status mix.
  const catRows = [
    { key: "active", label: t("moving.statusActive"), count: activeCount, color: theme.colors.primary },
    { key: "done", label: t("moving.status_COMPLETED"), count: completedCount, color: theme.colors.success },
    { key: "archived", label: t("moving.status_CANCELED"), count: archivedCount, color: theme.colors.faint },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header — eyebrow + Playfair title + route/date subline */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t("moving.title")}</Text>
          <Text style={styles.title}>{t("moving.title")}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{routeSubline}</Text>
        </View>
        <PressableScale
          style={styles.addButton}
          onPress={() => router.push("/moving/new")}
          accessibilityLabel={t("moving.newPlan")}
        >
          <Plus size={20} color={theme.colors.onAccent} />
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
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
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
            {/* Next best action — the featured live move to focus on */}
            {featured && (
              <ListEntrance index={0}>
                <PressableScale
                  style={styles.nextAction}
                  onPress={() => router.push({ pathname: "/moving/[id]", params: { id: featured.id } })}
                  accessibilityLabel={`${featuredFromCity} ${t("moving.to")} ${featuredToCity}`}
                >
                  <Text style={styles.nextActionEyebrow}>{t("moving.statusActive")}</Text>
                  <Text style={styles.nextActionTitle} numberOfLines={1}>
                    {featuredFromCity} → {featuredToCity}
                  </Text>
                  <View style={styles.nextActionFoot}>
                    <View style={styles.nextActionTags}>
                      <Pill
                        label={`${t("moving.moveDate")} ${featuredDateLabel}`}
                        tone="muted"
                      />
                      {featuredDays != null && featuredDays > 0 ? (
                        <Pill label={t("moving.daysLeft", { count: featuredDays })} tone="warning" />
                      ) : null}
                    </View>
                    <View style={styles.nextActionBtn}>
                      <Text style={styles.nextActionBtnText}>{t("moving.detailTitle")}</Text>
                      <ArrowRight size={13} color={theme.colors.onAccent} />
                    </View>
                  </View>
                </PressableScale>
              </ListEntrance>
            )}

            {/* Live route / ops HeroCard — map + 3 ops signals */}
            {featured && (
              <ListEntrance index={1}>
                <HeroCard style={styles.heroCard} radius={24} padding={16}>
                  <View style={styles.heroHead}>
                    <View style={styles.heroHeadText}>
                      <Text style={styles.heroEyebrow}>{t("moving.route")}</Text>
                      <Text style={styles.heroSub} numberOfLines={1}>{t("moving.migration")}</Text>
                    </View>
                    <MoveRaccoon size={34} mood={featuredLive ? "alert" : "calm"} />
                  </View>

                  {/* Route map */}
                  <View style={styles.map}>
                    <Svg
                      viewBox="0 0 300 158"
                      preserveAspectRatio="none"
                      style={StyleSheet.absoluteFill}
                      width="100%"
                      height="100%"
                    >
                      <G stroke={theme.colors.mapGrid} strokeWidth={1}>
                        <Path d="M-10 40 C60 28 110 56 180 40 C240 26 280 44 320 32" fill="none" />
                        <Path d="M-10 96 C60 80 120 104 190 88 C250 74 290 96 320 78" fill="none" />
                        <Path d="M40 -10 C52 50 36 110 50 168" fill="none" />
                        <Path d="M150 -10 C140 50 160 110 150 168" fill="none" />
                        <Path d="M250 -10 C258 50 244 110 256 168" fill="none" />
                      </G>
                      <Path
                        d="M44 124 C92 92 120 108 156 78 C196 46 226 60 262 36"
                        stroke={theme.colors.mapRouteBase}
                        strokeWidth={11}
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d="M44 124 C92 92 120 108 156 78 C196 46 226 60 262 36"
                        stroke={theme.colors.primary}
                        strokeWidth={3.2}
                        strokeLinecap="round"
                        strokeDasharray="9 9"
                        fill="none"
                      />
                      <Circle cx={44} cy={124} r={5} fill={theme.colors.background} stroke={theme.colors.info} strokeWidth={2.4} />
                      <Circle cx={262} cy={36} r={5} fill={theme.colors.background} stroke={theme.colors.primary} strokeWidth={2.4} />
                    </Svg>
                    <View style={[styles.mapTag, styles.mapTagFrom]}>
                      <Text style={styles.mapTagTitleInfo} numberOfLines={1}>
                        {featuredFromCity}{featuredFromState ? `, ${featuredFromState}` : ""}
                      </Text>
                      <Text style={styles.mapTagSub}>{t("moving.from")}</Text>
                    </View>
                    <View style={[styles.mapTag, styles.mapTagTo]}>
                      <Text style={styles.mapTagTitleAccent} numberOfLines={1}>
                        {featuredToCity}{featuredToState ? `, ${featuredToState}` : ""}
                      </Text>
                      <Text style={styles.mapTagSub}>{t("moving.to")}</Text>
                    </View>
                    <View style={styles.mapFoot}>
                      <Text style={styles.mapFootTitle} numberOfLines={1}>{featuredDateLabel}</Text>
                      {featuredDays != null && featuredDays > 0 ? (
                        <Text style={styles.mapFootSub}>{t("moving.daysLeft", { count: featuredDays })}</Text>
                      ) : (
                        <Text style={styles.mapFootSub}>
                          {t(`moving.status_${featuredStatus}`, { defaultValue: featuredStatus.replace("_", " ") })}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Ops signals */}
                  <View style={styles.opsRow}>
                    {opsSignals.map((s) => (
                      <View key={s.key} style={styles.opsTile}>
                        <View style={[styles.opsDot, { backgroundColor: s.dot }]} />
                        <Text style={styles.opsValue} numberOfLines={1}>{s.value}</Text>
                        <Text style={styles.opsLabel} numberOfLines={1}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                </HeroCard>
              </ListEntrance>
            )}

            {/* Risk panel — gauge + chips */}
            {featured && (
              <ListEntrance index={2}>
                <MoveCard style={styles.riskCard} radius={24} padding={16}>
                  <View style={styles.riskRow}>
                    <Svg width={120} height={70} viewBox="0 0 140 80" style={styles.riskGauge}>
                      <Path d="M14,72 A58,58 0 0 1 31,31" fill="none" stroke={theme.colors.success} strokeWidth={9} strokeLinecap="round" opacity={0.4} />
                      <Path d="M44,21 A58,58 0 0 1 96,21" fill="none" stroke={theme.colors.warning} strokeWidth={9} strokeLinecap="round" opacity={0.4} />
                      <Path d="M109,31 A58,58 0 0 1 126,72" fill="none" stroke={theme.colors.error} strokeWidth={9} strokeLinecap="round" opacity={0.95} />
                      <G transform={`rotate(${Math.round(-90 + riskRatio * 180)} 70 72)`}>
                        <Path d="M70 72 L70 26" stroke={theme.colors.text} strokeWidth={3} strokeLinecap="round" />
                      </G>
                      <Circle cx={70} cy={72} r={6} fill={theme.colors.surface3} stroke={theme.colors.text} strokeWidth={2} />
                    </Svg>
                    <View style={styles.riskText}>
                      <Text style={styles.riskLevel}>{t("moving.statMoves").toUpperCase()}</Text>
                      <View style={styles.riskChips}>
                        {activeCount > 0 ? (
                          <Pill label={`${activeCount} ${t("moving.statusActive")}`} tone="accent" />
                        ) : null}
                        {archivedCount > 0 ? (
                          <Pill label={`${archivedCount} ${t("moving.status_CANCELED")}`} tone="warning" />
                        ) : null}
                        <Pill label={`${completedCount} ${t("moving.status_COMPLETED")}`} tone="success" />
                      </View>
                    </View>
                  </View>
                </MoveCard>
              </ListEntrance>
            )}

            {/* Countdown HeroCard */}
            {featured && (
              <ListEntrance index={3}>
                <HeroCard style={styles.countdownCard} radius={24} padding={20}>
                  <View style={styles.countdownRow}>
                    <Text style={styles.countdownNum}>
                      {featuredDays != null && featuredDays > 0 ? featuredDays : 0}
                    </Text>
                    <Text style={styles.countdownLabel}>{t("moving.daysLeft", { count: featuredDays ?? 0 })}</Text>
                  </View>
                  <View style={styles.countdownMeta}>
                    <Text style={styles.countdownMetaDim}>{t("moving.percentComplete", { pct: overallPct })}</Text>
                    <Text style={styles.countdownMetaAccent}>{completedCount}/{plans.length}</Text>
                  </View>
                  <MoveProgressBar value={featuredProgress ?? overallPct / 100} />
                </HeroCard>
              </ListEntrance>
            )}

            {/* Mission timeline — the real plan list as a vertical timeline */}
            <SectionHeader label={t("moving.statMoves")} style={styles.sectionHeader} />
            <View style={styles.timeline}>
              <View style={styles.timelineSpine} />
              <View style={styles.timelineList}>
                {plans.map((plan: any, index: number) => {
                  const normalizedStatus = normalizeMovingPlanStatus(plan.status);
                  const live = isLiveStatus(normalizedStatus);
                  const done = normalizedStatus === "COMPLETED";
                  const accent = accentFor(normalizedStatus);
                  const countdown = getMoveCountdown(plan.moveDate, {
                    state: plan.toAddress?.state || plan.fromAddress?.state || null,
                  });
                  const daysUntil = countdown.days;
                  const moveDateLabel = formatDateOnlyUtc(
                    plan.moveDate,
                    { month: "short", day: "numeric", year: "numeric" },
                    i18n.language || "en-US",
                  );
                  const progress = live ? timeProgress(plan) : null;
                  const fromCity = plan.fromAddress?.city || "—";
                  const toCity = plan.toAddress?.city || "—";
                  const statusLabel = t(`moving.status_${normalizedStatus}`, {
                    defaultValue: normalizedStatus.replace("_", " "),
                  });

                  return (
                    <ListEntrance key={plan.id} index={index}>
                      <View style={styles.timelineItem}>
                        <View
                          style={[
                            styles.timelineNode,
                            { backgroundColor: accent, borderColor: theme.colors.background },
                          ]}
                        >
                          {done ? (
                            <Svg width={8} height={8} viewBox="0 0 24 24">
                              <Path d="M20 6L9 17l-5-5" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                          ) : null}
                        </View>
                        <PressableScale
                          style={[
                            styles.timelineCard,
                            live && styles.timelineCardLive,
                            { borderLeftColor: accent },
                          ]}
                          onPress={() => router.push({ pathname: "/moving/[id]", params: { id: plan.id } })}
                          accessibilityLabel={`${fromCity} ${t("moving.to")} ${toCity}, ${statusLabel}`}
                        >
                          <View style={styles.timelineCardHd}>
                            <Text style={styles.routeCity} numberOfLines={1}>
                              {fromCity} → {toCity}
                            </Text>
                            <Pill
                              label={statusLabel}
                              tone={live ? "accent" : done ? "success" : "muted"}
                            />
                          </View>
                          <View style={styles.meta}>
                            <Calendar size={12} color={theme.colors.faint} />
                            <Text style={styles.metaText}>{moveDateLabel}</Text>
                            {daysUntil !== null && daysUntil > 0 && (
                              <Text style={styles.daysLeft}>{daysUntil}d</Text>
                            )}
                            <Text style={styles.metaDot}>·</Text>
                            <Text style={[styles.metaStatus, { color: statusColorFor(normalizedStatus) }]}>
                              {statusLabel}
                            </Text>
                          </View>
                          {progress != null && (
                            <MoveProgressBar value={progress} height={4} style={styles.timelineProgress} />
                          )}
                        </PressableScale>
                      </View>
                    </ListEntrance>
                  );
                })}
              </View>
            </View>

            {/* Admin sprint — the live moves needing attention now */}
            <SectionHeader label={t("moving.taskTracking")} style={styles.sectionHeader} />
            <View style={styles.sprintList}>
              {plans.filter((p: any) => isLiveStatus(normalizeMovingPlanStatus(p.status))).length === 0 ? (
                <MoveCard style={styles.sprintEmpty}>
                  <Text style={styles.sprintEmptyText}>{t("moving.celebrateBody")}</Text>
                </MoveCard>
              ) : (
                plans
                  .filter((p: any) => isLiveStatus(normalizeMovingPlanStatus(p.status)))
                  .map((plan: any) => {
                    const fromCity = plan.fromAddress?.city || "—";
                    const toCity = plan.toAddress?.city || "—";
                    const countdown = getMoveCountdown(plan.moveDate, {
                      state: plan.toAddress?.state || plan.fromAddress?.state || null,
                    });
                    const moveDateLabel = formatDateOnlyUtc(
                      plan.moveDate,
                      { month: "short", day: "numeric", year: "numeric" },
                      i18n.language || "en-US",
                    );
                    return (
                      <PressableScale
                        key={plan.id}
                        style={styles.sprintRow}
                        onPress={() => router.push({ pathname: "/moving/[id]", params: { id: plan.id } })}
                        accessibilityLabel={`${fromCity} ${t("moving.to")} ${toCity}`}
                      >
                        <View style={styles.sprintAccent} />
                        <View style={styles.sprintIcon}>
                          <Truck size={16} color={theme.colors.primary} />
                        </View>
                        <View style={styles.sprintBody}>
                          <Text style={styles.sprintTitle} numberOfLines={1}>
                            {fromCity} → {toCity}
                          </Text>
                          <Text style={styles.sprintMeta} numberOfLines={1}>
                            {t("moving.moveDate")} {moveDateLabel}
                            {countdown.days != null && countdown.days > 0 ? ` · ${countdown.days}d` : ""}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={theme.colors.faint} />
                      </PressableScale>
                    );
                  })
              )}
            </View>

            {/* Category progress — collapsible status breakdown */}
            <View style={styles.catsWrap}>
              <TouchableOpacity
                style={styles.catsToggle}
                onPress={() => setShowCats((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={t("moving.statMoves")}
              >
                <Text style={styles.catsToggleText}>{t("moving.statMoves")}</Text>
                <ChevronRight
                  size={16}
                  color={theme.colors.faint}
                  style={{ transform: [{ rotate: showCats ? "90deg" : "0deg" }] }}
                />
              </TouchableOpacity>
              {showCats && (
                <View style={styles.catsList}>
                  {catRows.map((c) => {
                    const pct = plans.length > 0 ? c.count / plans.length : 0;
                    return (
                      <View key={c.key} style={styles.catRow}>
                        <View style={styles.catRowHd}>
                          <Text style={styles.catLabel}>{c.label}</Text>
                          <Text style={[styles.catPct, { color: c.color }]}>{Math.round(pct * 100)}%</Text>
                        </View>
                        <View style={styles.catTrack}>
                          <View style={[styles.catFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: c.color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Create a new move */}
            <TouchableOpacity
              style={styles.newMoveCard}
              onPress={() => router.push("/moving/new")}
              accessibilityRole="button"
              accessibilityLabel={t("moving.newPlan")}
            >
              <Plus size={16} color={theme.colors.faint} />
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
  // ── Header (design: eyebrow + Playfair title + route/date) ──
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  headerText: { flex: 1, paddingRight: 12 },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  title: { fontSize: 26, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 2, lineHeight: 30 },
  subtitle: { fontSize: 11, color: theme.colors.faint, marginTop: 3 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.glow,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8 },
  list: { gap: 10 },
  errorBanner: { marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.redLine, backgroundColor: theme.colors.redSoft },
  errorBannerText: { color: theme.colors.error, fontSize: 12, textAlign: "center", fontFamily: fonts.sansMedium },

  // ── Next best action callout ──
  nextAction: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  nextActionEyebrow: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  nextActionTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.text, marginTop: 5 },
  nextActionFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13, gap: 8 },
  nextActionTags: { flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap" },
  nextActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
  },
  nextActionBtnText: { fontSize: 11, fontFamily: fonts.sansBold, color: theme.colors.onAccent },

  // ── Live route / ops HeroCard ──
  heroCard: { marginBottom: 14 },
  heroHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  heroHeadText: { flex: 1, paddingRight: 10 },
  heroEyebrow: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroSub: { fontSize: 10, color: theme.colors.dim, marginTop: 3 },
  map: {
    position: "relative",
    height: 158,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.colors.mapBg[1],
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapTag: {
    position: "absolute",
    top: 10,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: theme.colors.glassPane,
    borderWidth: 1,
  },
  mapTagFrom: { left: 10, borderColor: theme.colors.border },
  mapTagTo: { right: 10, borderColor: theme.colors.accentBorder, alignItems: "flex-end" },
  mapTagTitleInfo: { color: theme.colors.info, fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 0.6, textTransform: "uppercase" },
  mapTagTitleAccent: { color: theme.colors.primary, fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 0.6, textTransform: "uppercase" },
  mapTagSub: { color: theme.colors.faint, fontSize: 8, marginTop: 1 },
  mapFoot: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.glassPane,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapFootTitle: { color: theme.colors.text, fontSize: 10, fontFamily: fonts.sansBold, flexShrink: 1 },
  mapFootSub: { color: theme.colors.faint, fontSize: 8, marginLeft: 8 },
  opsRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  opsTile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  opsDot: { width: 6, height: 6, borderRadius: 99, marginBottom: 6 },
  opsValue: { color: theme.colors.text, fontSize: 10, fontFamily: fonts.sansBold },
  opsLabel: { color: theme.colors.faint, fontSize: 8.5, marginTop: 1 },

  // ── Risk panel ──
  riskCard: { marginBottom: 14, borderColor: theme.colors.redLine },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  riskGauge: { flexShrink: 0 },
  riskText: { flex: 1, minWidth: 0 },
  riskLevel: { color: theme.colors.text, fontSize: 12, fontFamily: fonts.sansBold, letterSpacing: 0.6 },
  riskChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },

  // ── Countdown HeroCard ──
  countdownCard: { marginBottom: 4 },
  countdownRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  countdownNum: { color: theme.colors.text, fontFamily: fonts.serifBlack, fontSize: 60, lineHeight: 60 },
  countdownLabel: { color: theme.colors.dim, fontSize: 13, flexShrink: 1 },
  countdownMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 7 },
  countdownMetaDim: { color: theme.colors.dim, fontSize: 11 },
  countdownMetaAccent: { color: theme.colors.primary, fontSize: 11, fontFamily: fonts.sansBold },

  // ── Section headers ──
  sectionHeader: { marginTop: 24, marginBottom: 12 },

  // ── Mission timeline ──
  timeline: { position: "relative", paddingLeft: 30 },
  timelineSpine: { position: "absolute", left: 9, top: 14, bottom: 14, width: 2, borderRadius: 2, backgroundColor: theme.colors.border },
  timelineList: { gap: 11 },
  timelineItem: { position: "relative" },
  timelineNode: {
    position: "absolute",
    left: -29,
    top: 16,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineCard: {
    borderRadius: 16,
    padding: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
  },
  timelineCardLive: { ...theme.shadow.glow },
  timelineCardHd: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  routeCity: { flexShrink: 1, fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, flexWrap: "wrap" },
  metaText: { fontSize: 11, color: theme.colors.faint },
  daysLeft: { fontSize: 11, color: theme.colors.warning, fontFamily: fonts.sansSemibold, marginLeft: 4 },
  metaDot: { fontSize: 11, color: theme.colors.textMuted },
  metaStatus: { fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: fonts.sansBold },
  timelineProgress: { marginTop: 10 },

  // ── Admin sprint task rows ──
  sprintList: { gap: 9 },
  sprintEmpty: { padding: 14 },
  sprintEmptyText: { color: theme.colors.dim, fontSize: 12, textAlign: "center", fontFamily: fonts.sansMedium },
  sprintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: "relative",
    overflow: "hidden",
  },
  sprintAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.colors.primary },
  sprintIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
    marginLeft: 3,
  },
  sprintBody: { flex: 1, minWidth: 0 },
  sprintTitle: { color: theme.colors.text, fontSize: 12.5, fontFamily: fonts.sansSemibold },
  sprintMeta: { color: theme.colors.faint, fontSize: 10, marginTop: 2 },

  // ── Category progress collapsible ──
  catsWrap: { marginTop: 18 },
  catsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catsToggleText: { color: theme.colors.text, fontSize: 12, fontFamily: fonts.sansSemibold },
  catsList: { gap: 11, paddingHorizontal: 4, paddingTop: 14 },
  catRow: {},
  catRowHd: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  catLabel: { color: theme.colors.text, fontSize: 11 },
  catPct: { fontFamily: fonts.monoMedium, fontSize: 11 },
  catTrack: { height: 4, borderRadius: 99, backgroundColor: theme.colors.track, overflow: "hidden" },
  catFill: { height: "100%", borderRadius: 99 },

  // ── Dashed create-new-move card ──
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
    marginTop: 18,
  },
  newMoveText: { fontSize: 13, color: theme.colors.faint, fontFamily: fonts.sansSemibold },
});
