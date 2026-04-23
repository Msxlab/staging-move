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

const PLANS = [
  {
    key: "FREE_TRIAL",
    name: "Free Trial",
    price: "Free",
    period: "7 days",
    features: [
      "Up to 2 addresses",
      "Up to 10 services",
      "Basic moving checklist",
    ],
  },
  {
    key: "INDIVIDUAL",
    name: "Individual",
    price: "$4.99",
    period: "/month",
    features: [
      "Up to 10 addresses",
      "Up to 100 services",
      "Full moving planner",
      "QR box tracking",
    ],
  },
] as const;

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
    await Promise.all([fetchSubscription(), fetchIapProducts()]);
    setLoading(false);
  }, [fetchSubscription, fetchIapProducts]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    void fetchSubscription();
  }, [fetchSubscription]));

  const currentPlanKey = subscription?.plan || "FREE_TRIAL";
  const currentStatus = subscription?.status || "TRIALING";
  const currentProvider = subscription?.provider || null;
  const currentPlan = useMemo(
    () => PLANS.find((plan) => plan.key === currentPlanKey) || PLANS[0],
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
      Alert.alert("Unavailable", "This billing link could not be opened on your device.");
      return;
    }

    await Linking.openURL(url);
  }, []);

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

    // Fallback: open Stripe checkout in the system browser if the operator
    // hasn't wired up IAP yet.
    const res = await api.post<any>("/api/stripe/checkout", { plan: planKey });
    setProcessingPlan(null);

    if (res.error || !res.data?.url) {
      hapticError();
      Alert.alert(t("common.retry"), res.error || t("toast.networkError"));
      return;
    }

    hapticSuccess();
    await openExternalUrl(res.data.url);
  }, [openExternalUrl, iapAvailable, storeSku, fetchSubscription, t]);

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
      Alert.alert("Billing unavailable", res.error || "Failed to open billing portal.");
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
      Alert.alert("Restored", "Your active subscription was restored.");
      await fetchSubscription();
    } else {
      hapticError();
      Alert.alert("Nothing to restore", "No active subscription was found for this store account.");
    }
  }, [iapAvailable, fetchSubscription]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" accessibilityHint="Returns to settings">
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
          accessibilityLabel="Go back"
          accessibilityHint="Returns to settings"
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
              <Text style={styles.currentPlanTitle}>{currentPlan.name}</Text>
              <Text style={styles.currentPlanMeta}>
                {periodEndLabel
                  ? t("settings.subscription_renews", { date: periodEndLabel })
                  : trialEndLabel
                    ? t("settings.subscription_renews", { date: trialEndLabel })
                    : t("settings.subscription_manage")}
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

        {PLANS.map((plan) => (
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
                  <Text style={styles.planPeriod}> {plan.period}</Text>
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
                  accessibilityLabel="Manage billing"
                  accessibilityHint="Opens the billing portal"
                  accessibilityState={{ disabled: processingPlan === "MANAGE" }}
                >
                  {processingPlan === "MANAGE" ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.manageBtnText}>{t("settings.subscription_manage")}</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel="Current plan" accessibilityState={{ disabled: true }}>
                  <Text style={styles.currentBtnText}>{t("pricing.cta_current")}</Text>
                </TouchableOpacity>
              )
            ) : plan.key === "FREE_TRIAL" ? (
              <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel="Free trial plan information" accessibilityState={{ disabled: true }}>
                <Text style={styles.currentBtnText}>{t("pricing.cta_trial")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.7}
                onPress={() => handleUpgrade(plan.key)}
                disabled={processingPlan === plan.key}
                accessibilityRole="button"
                accessibilityLabel={`Upgrade to ${plan.name}`}
                accessibilityHint="Opens secure checkout in your browser"
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
        ))}

        {iapAvailable && (
          <TouchableOpacity
            style={styles.restoreBtn}
            activeOpacity={0.7}
            onPress={handleRestore}
            disabled={processingPlan === "RESTORE"}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityHint="Syncs an existing subscription from your store account"
            accessibilityState={{ disabled: processingPlan === "RESTORE" }}
          >
            {processingPlan === "RESTORE" ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.restoreBtnText}>Restore purchases</Text>
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
    borderColor: "rgba(212, 132, 106,0.3)",
    backgroundColor: "rgba(212, 132, 106,0.08)",
    padding: 16,
  },
  currentPlanLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 12 },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212, 132, 106,0.14)",
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
