import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import {
  closeConnection,
  fetchSubscriptionProducts,
  openNativeSubscriptionSettings,
  purchaseSubscription,
  restorePurchases,
} from "@/lib/iap";
import {
  BILLING_PLAN_DEFINITIONS,
  BILLING_PLAN_ORDER,
  TRIAL_DURATION_DAYS,
} from "@locateflow/shared";

// Single source of truth — shared billing module. Prices, features, and
// trial length stay in sync with web automatically.
const PLANS = BILLING_PLAN_ORDER.map((key) => {
  const def = BILLING_PLAN_DEFINITIONS[key];
  return {
    key,
    name: def.displayName,
    price: def.priceLabel,
    period:
      key === "FREE_TRIAL"
        ? `${TRIAL_DURATION_DAYS} days`
        : def.periodLabel,
    yearlyPrice: def.yearlyPriceLabel ?? null,
    features: def.features,
    isPaid: def.isPaid,
    isUpcoming: false as const,
  };
});

type SubscriptionRecord = {
  plan?: string | null;
  status?: string | null;
  provider?: string | null;
  platform?: string | null;
  stripeCustomerId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  currentPeriodEndsAt?: string | null;
  trialEndsAt?: string | null;
  premiumUntil?: string | null;
  billingProductId?: string | null;
};

type IapProductsResponse = {
  ios: { available: boolean; plans: { INDIVIDUAL: string | null } };
  android: { available: boolean; plans: { INDIVIDUAL: string | null } };
};

type PublicCampaignSummary = {
  campaignCode: string;
  accessType: string;
  publicHeadline: string;
  publicSubheadline: string | null;
  checkoutDisclosureCopy: string | null;
  displayPriceLabel: string;
  trialDays: number | null;
  billingInterval: string | null;
  ctaText: string;
  priceCopy: string;
  trialLabel: string | null;
};

type PublicSubscriptionOffersResponse = {
  campaign?: PublicCampaignSummary | null;
  offers?: {
    annualTrial?: PublicCampaignSummary | null;
    monthlyPaid?: PublicCampaignSummary | null;
  } | null;
};

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function LegacySubscriptionScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [iapProducts, setIapProducts] = useState<IapProductsResponse | null>(null);
  const [localizedPrice, setLocalizedPrice] = useState<string | null>(null);
  const [annualOffer, setAnnualOffer] = useState<PublicCampaignSummary | null>(null);
  const [monthlyOffer, setMonthlyOffer] = useState<PublicCampaignSummary | null>(null);

  const fetchSubscription = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      setSubscription(res.data.subscription || null);
    }
  }, []);

  const fetchIapProducts = useCallback(async () => {
    const res = await api.get<IapProductsResponse>("/api/mobile/iap/products");
    if (res.data) setIapProducts(res.data);
  }, []);

  const fetchPublicOffers = useCallback(async () => {
    const res = await api.get<PublicSubscriptionOffersResponse>("/api/acquisition/public-trial-campaign");
    if (res.data) {
      setAnnualOffer(res.data.offers?.annualTrial || res.data.campaign || null);
      setMonthlyOffer(res.data.offers?.monthlyPaid || null);
    }
  }, []);

  const storeSku = useMemo(() => {
    if (!iapProducts) return null;
    return Platform.OS === "ios"
      ? iapProducts.ios.plans.INDIVIDUAL
      : iapProducts.android.plans.INDIVIDUAL;
  }, [iapProducts]);

  const iapAvailable = Boolean(
    storeSku &&
      (Platform.OS === "ios" ? iapProducts?.ios.available : iapProducts?.android.available)
  );

  // Pull the localized price from StoreKit/Play once the SKU is known.
  useEffect(() => {
    if (!iapAvailable || !storeSku) {
      setLocalizedPrice(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const products = await fetchSubscriptionProducts([storeSku]);
      if (cancelled) return;
      const match = products.find((p) => p.id === storeSku) || products[0];
      if (match) setLocalizedPrice(match.displayPrice || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [iapAvailable, storeSku]);

  useEffect(() => () => {
    // Release StoreKit connection on unmount.
    void closeConnection();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSubscription(), fetchIapProducts(), fetchPublicOffers()]);
    setLoading(false);
  }, [fetchSubscription, fetchIapProducts, fetchPublicOffers]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    void fetchSubscription();
  }, [fetchSubscription]));

  const hasServerSubscription = Boolean(subscription?.plan && subscription?.status);
  const currentPlanKey = hasServerSubscription ? subscription?.plan || null : null;
  const currentStatus = hasServerSubscription ? subscription?.status || "UNKNOWN" : "NO_SUBSCRIPTION";
  const currentProvider = subscription?.provider || null;
  const currentPlan = useMemo(
    () => currentPlanKey ? PLANS.find((plan) => plan.key === currentPlanKey) || null : null,
    [currentPlanKey]
  );
  const periodEndLabel = formatDateLabel(
    subscription?.currentPeriodEndsAt || subscription?.stripeCurrentPeriodEnd || subscription?.premiumUntil
  );
  const trialEndLabel = formatDateLabel(subscription?.trialEndsAt);
  const isStoreManaged = currentProvider === "APP_STORE" || currentProvider === "PLAY_STORE";
  const canManageBilling = !!subscription?.stripeCustomerId && !isStoreManaged;

  const openExternalUrl = useCallback(async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      hapticError();
      Alert.alert(t("settings.subscription_unavailable"), t("settings.subscription_linkUnavailable"));
      return;
    }

    await Linking.openURL(url);
  }, [t]);

  const handleUpgrade = useCallback(async (planKey: "INDIVIDUAL") => {
    setProcessingPlan(planKey);

    // Native IAP path — preferred on iOS/Android (required by store policy).
    if (iapAvailable && storeSku) {
      const result = await purchaseSubscription({ productId: storeSku });
      setProcessingPlan(null);

      if (result.status === "cancelled") return;
      if (result.status === "error") {
        hapticError();
        Alert.alert(t("common.retry"), result.message || t("toast.networkError"));
        return;
      }
      hapticSuccess();
      await fetchSubscription();
      return;
    }

    // Stripe browser fallback. Mobile does not show the campaign disclosure
    // panel inline, so surface it as a confirmation Alert and require an
    // explicit "Continue" tap before the API call. The web checkout route
    // requires `acceptedSubscriptionTerms: true`, so we cannot omit it; the
    // confirmation tap is what backs the flag.
    const targetCampaign = annualOffer || monthlyOffer || null;
    const cycle: "yearly" | "monthly" = targetCampaign?.billingInterval === "MONTH" ? "monthly" : "yearly";
    const disclosureBody =
      targetCampaign?.checkoutDisclosureCopy ||
      (cycle === "monthly"
        ? t("settings.subscription_disclosureMonthly", { price: targetCampaign?.displayPriceLabel || "the displayed price" })
        : t("settings.subscription_disclosureAnnual"));
    const headline = targetCampaign?.publicHeadline ||
      (cycle === "monthly"
        ? t("settings.subscription_subscribeMonthly")
        : t("settings.subscription_subscribeAnnualTrial"));

    const userConfirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        headline,
        t("settings.subscription_continueDisclosure", { disclosure: disclosureBody }),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: t("common.continue"), style: "default", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

    if (!userConfirmed) {
      setProcessingPlan(null);
      return;
    }

    const res = await api.post<any>("/api/stripe/checkout", {
      plan: planKey,
      cycle,
      acceptedSubscriptionTerms: true,
      ...(targetCampaign?.campaignCode ? { campaignCode: targetCampaign.campaignCode } : {}),
    });
    setProcessingPlan(null);

    if (res.error || !res.data?.url) {
      hapticError();
      Alert.alert(t("common.retry"), res.error || t("toast.networkError"));
      return;
    }

    hapticSuccess();
    await openExternalUrl(res.data.url);
  }, [openExternalUrl, iapAvailable, storeSku, fetchSubscription, t, annualOffer, monthlyOffer]);

  const handleManageBilling = useCallback(async () => {
    setProcessingPlan("MANAGE");

    // Store-managed subscriptions: send the user to the native management page.
    if (isStoreManaged) {
      setProcessingPlan(null);
      await openNativeSubscriptionSettings(subscription?.billingProductId || storeSku || undefined);
      return;
    }

    const res = await api.post<any>("/api/stripe/portal", {});
    setProcessingPlan(null);

    if (res.error || !res.data?.url) {
      hapticError();
      Alert.alert(t("settings.subscription_billingUnavailable"), res.error || t("settings.subscription_billingPortalFailed"));
      return;
    }

    hapticSuccess();
    await openExternalUrl(res.data.url);
  }, [openExternalUrl, isStoreManaged, subscription?.billingProductId, storeSku]);

  const handleRestore = useCallback(async () => {
    if (!iapAvailable) return;
    setProcessingPlan("RESTORE");
    const results = await restorePurchases();
    setProcessingPlan(null);
    const hit = results.find((r) => r.status === "ok");
    if (hit) {
      hapticSuccess();
      Alert.alert(t("settings.subscription_restored"), t("settings.subscription_restoredDescription"));
      await fetchSubscription();
    } else {
      hapticError();
      Alert.alert(t("settings.subscription_nothingToRestore"), t("settings.subscription_nothingToRestoreDescription"));
    }
  }, [iapAvailable, fetchSubscription, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("settings.subscription_a11yBack")} accessibilityHint={t("settings.subscription_a11yBackHint")}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("settings.subscription")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("settings.subscription_a11yBack")}
          accessibilityHint={t("settings.subscription_a11yBackHint")}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.subscription")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.currentPlanCard}>
          <View style={styles.currentPlanLeft}>
            <View style={styles.currentPlanIcon}>
              <Crown size={18} color={theme.colors.amber.text} />
            </View>
            <View>
              <Text style={styles.currentPlanTitle}>
                {currentPlan?.name || t("settings.subscription_noActivePlan", { defaultValue: "No active subscription" })}
              </Text>
              <Text style={styles.currentPlanMeta}>
                {periodEndLabel
                  ? t("settings.subscription_renews", { date: periodEndLabel })
                  : trialEndLabel
                    ? t("settings.subscription_renews", { date: trialEndLabel })
                    : t("settings.subscription_choosePlan", { defaultValue: "Choose a plan to start." })}
              </Text>
            </View>
          </View>
          <UiBadge
            label={currentStatus}
            variant={currentStatus === "ACTIVE" || currentStatus === "TRIALING" ? "success" : "neutral"}
          />
        </View>

        <View style={styles.heroBox}>
          <Crown size={32} color={theme.colors.amber.text} />
          <Text style={styles.heroTitle}>{t("pricing.title")}</Text>
          <Text style={styles.heroDesc}>
            {t("pricing.subtitle")}
          </Text>
        </View>

        {PLANS.map((plan) => {
          // Drive the FREE_TRIAL period label from the live annual campaign so
          // it stays in sync with the actual trial length (currently 90 days,
          // not the legacy 14). Falls back to the static label if no
          // campaign has loaded yet.
          const dynamicPeriod =
            plan.key === "FREE_TRIAL"
              ? annualOffer?.trialLabel ||
                (annualOffer?.trialDays ? `${annualOffer.trialDays} days` : plan.period)
              : plan.period;
          return (
          <Card
            key={plan.key}
            variant={plan.key === currentPlanKey ? "glow" : "default"}
            style={{ marginTop: 14 }}
          >
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.key === currentPlanKey && <UiBadge label={t("pricing.cta_current")} variant="success" />}
                </View>
                <Text style={styles.planPrice}>
                  {plan.key === "INDIVIDUAL" && localizedPrice ? localizedPrice : plan.price}
                  <Text style={styles.planPeriod}> {dynamicPeriod}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.featureList}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check size={14} color={theme.colors.emerald.text} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {plan.key === currentPlanKey ? (
              canManageBilling ? (
                <TouchableOpacity
                  style={styles.manageBtn}
                  activeOpacity={0.7}
                  onPress={handleManageBilling}
                  disabled={processingPlan === "MANAGE"}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.subscription_a11yManage")}
                  accessibilityHint={t("settings.subscription_a11yManageHint")}
                  accessibilityState={{ disabled: processingPlan === "MANAGE" }}
                >
                  {processingPlan === "MANAGE" ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.manageBtnText}>{t("settings.subscription_manage")}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel={t("settings.subscription_a11yCurrent")} accessibilityState={{ disabled: true }}>
                  <Text style={styles.currentBtnText}>{t("pricing.cta_current")}</Text>
                </TouchableOpacity>
              )
            ) : plan.key === "FREE_TRIAL" ? (
              <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel={t("settings.subscription_a11yTrial")} accessibilityState={{ disabled: true }}>
                <Text style={styles.currentBtnText}>{t("pricing.cta_trial")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.7}
                onPress={() => handleUpgrade("INDIVIDUAL")}
                disabled={processingPlan === plan.key}
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_a11yUpgrade", { plan: plan.name })}
                accessibilityHint={t("settings.subscription_a11yUpgradeHint")}
                accessibilityState={{ disabled: processingPlan === plan.key }}
              >
                {processingPlan === plan.key ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Zap size={16} color="#fff" />
                    <Text style={styles.upgradeBtnText}>{t("pricing.cta_upgrade")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Card>
          );
        })}
        {iapAvailable && (
          <TouchableOpacity
            style={styles.restoreBtn}
            activeOpacity={0.7}
            onPress={handleRestore}
            disabled={processingPlan === "RESTORE"}
            accessibilityRole="button"
            accessibilityLabel={t("settings.subscription_a11yRestore")}
            accessibilityHint={t("settings.subscription_a11yRestoreHint")}
            accessibilityState={{ disabled: processingPlan === "RESTORE" }}
          >
            {processingPlan === "RESTORE" ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.restoreBtnText}>{t("settings.subscription_restoreButton")}</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>
          {t("settings.subscription_manage")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: theme.colors.textTertiary },
  currentPlanCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    backgroundColor: "rgba(249,115,22,0.08)",
    padding: 16,
  },
  currentPlanLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 12 },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.14)",
  },
  currentPlanTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  currentPlanMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  heroBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  heroDesc: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", maxWidth: 280 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  planPrice: { fontSize: 28, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  planPeriod: { fontSize: 14, fontWeight: "400", color: theme.colors.textTertiary },
  featureList: { marginTop: 16, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: theme.colors.textSecondary },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 14, marginTop: 16, ...theme.shadow.glow,
  },
  manageBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: 14,
    marginTop: 16,
  },
  manageBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
  currentBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    marginTop: 16,
    opacity: 0.7,
  },
  currentBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.textMuted },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  restoreBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    marginTop: 16,
  },
  restoreBtnText: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },
  footer: {
    textAlign: "center", fontSize: 12, color: theme.colors.textMuted, marginTop: 24,
  },
});

export default LegacySubscriptionScreen;
