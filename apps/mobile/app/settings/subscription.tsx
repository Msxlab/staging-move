import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { MOBILE_STORE_PURCHASES_ENABLED } from "@/lib/billing-flags";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import {
  closeConnection,
  fetchSubscriptionProducts,
  IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE,
  IAP_PURCHASE_FAILED_MESSAGE,
  IAP_STORE_UNAVAILABLE_MESSAGE,
  IAP_VERIFICATION_ERROR_MESSAGE,
  openNativeSubscriptionSettings,
  purchaseSubscription,
  restorePurchases,
} from "@/lib/iap";
import { selectAndroidSubscriptionOffer } from "@/lib/iap-offers";
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
  ios: {
    available: boolean;
    plans: {
      INDIVIDUAL: string | null;
      // Newer fields (additive — older mobile builds keep working).
      INDIVIDUAL_MONTHLY?: string | null;
      INDIVIDUAL_YEARLY?: string | null;
    };
  };
  android: {
    available: boolean;
    plans: {
      INDIVIDUAL: string | null;
      INDIVIDUAL_MONTHLY?: string | null;
      INDIVIDUAL_YEARLY?: string | null;
    };
  };
};

type Cycle = "monthly" | "yearly";

function resolveSkuFromResponse(
  iapProducts: IapProductsResponse | null,
  cycle: Cycle,
): string | null {
  if (!iapProducts) return null;
  const platform = Platform.OS === "ios" ? iapProducts.ios : iapProducts.android;
  if (!platform) return null;
  if (cycle === "yearly") {
    return platform.plans.INDIVIDUAL_YEARLY ?? null;
  }
  return platform.plans.INDIVIDUAL_MONTHLY ?? platform.plans.INDIVIDUAL ?? null;
}

function parseAmount(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/([0-9]+(?:[.,][0-9]{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function computeAnnualSavingsText(
  yearlyLabel: string | null | undefined,
  monthlyLabel: string | null | undefined,
): string | null {
  const yearly = parseAmount(yearlyLabel);
  const monthly = parseAmount(monthlyLabel);
  if (!yearly || !monthly) return null;
  const yearOfMonthly = monthly * 12;
  if (yearOfMonthly <= yearly) return null;
  const saved = yearOfMonthly - yearly;
  const percent = Math.round((saved / yearOfMonthly) * 100);
  return `Save $${saved.toFixed(saved % 1 === 0 ? 0 : 2)}/year vs monthly · ${percent}% off`;
}

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

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [iapProducts, setIapProducts] = useState<IapProductsResponse | null>(null);
  const [localizedMonthlyPrice, setLocalizedMonthlyPrice] = useState<string | null>(null);
  const [localizedYearlyPrice, setLocalizedYearlyPrice] = useState<string | null>(null);
  const [monthlyOfferToken, setMonthlyOfferToken] = useState<string | null>(null);
  const [yearlyOfferToken, setYearlyOfferToken] = useState<string | null>(null);
  const [annualOffer, setAnnualOffer] = useState<PublicCampaignSummary | null>(null);
  const [monthlyOffer, setMonthlyOffer] = useState<PublicCampaignSummary | null>(null);

  const fetchSubscription = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      setSubscription(res.data.subscription || null);
    }
  }, []);

  const fetchIapProducts = useCallback(async () => {
    if (!MOBILE_STORE_PURCHASES_ENABLED || (Platform.OS !== "ios" && Platform.OS !== "android")) {
      setIapProducts(null);
      return;
    }
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

  const monthlySku = useMemo(() => resolveSkuFromResponse(iapProducts, "monthly"), [iapProducts]);
  const yearlySku = useMemo(() => resolveSkuFromResponse(iapProducts, "yearly"), [iapProducts]);
  const iapAvailable = Boolean(monthlySku || yearlySku);
  const isNativeStorePlatform = Platform.OS === "ios" || Platform.OS === "android";
  const mobileStorePurchasesEnabled = MOBILE_STORE_PURCHASES_ENABLED;
  const canUseNativePurchases = isNativeStorePlatform && mobileStorePurchasesEnabled && iapAvailable;

  // Pull localized prices for both SKUs in a single fetchProducts call so
  // StoreKit/Play return one batch instead of two round-trips.
  useEffect(() => {
    const skus = [monthlySku, yearlySku].filter((sku): sku is string => Boolean(sku));
    if (!canUseNativePurchases || skus.length === 0) {
      setLocalizedMonthlyPrice(null);
      setLocalizedYearlyPrice(null);
      setMonthlyOfferToken(null);
      setYearlyOfferToken(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const products = await fetchSubscriptionProducts(skus);
      if (cancelled) return;
      const monthly = products.find((p) => p.id === monthlySku);
      const yearly = products.find((p) => p.id === yearlySku);
      const monthlyAndroidOffer = monthly ? selectAndroidSubscriptionOffer(monthly, "monthly") : null;
      const yearlyAndroidOffer = yearly ? selectAndroidSubscriptionOffer(yearly, "yearly") : null;
      setLocalizedMonthlyPrice(monthly?.displayPrice || null);
      setLocalizedYearlyPrice(yearly?.displayPrice || null);
      setMonthlyOfferToken(monthlyAndroidOffer?.offerToken || null);
      setYearlyOfferToken(yearlyAndroidOffer?.offerToken || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [canUseNativePurchases, monthlySku, yearlySku]);

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
  const isStripeManaged = currentProvider === "STRIPE" || Boolean(subscription?.stripeCustomerId);
  const canManageBilling =
    (isStoreManaged && canUseNativePurchases) ||
    (!isNativeStorePlatform && Boolean(subscription?.stripeCustomerId) && !isStoreManaged);

  const getLocalizedIapError = useCallback((message?: string) => {
    if (message === IAP_PURCHASE_FAILED_MESSAGE) return t("settings.subscription_purchaseFailed");
    if (message === IAP_VERIFICATION_ERROR_MESSAGE) return t("settings.subscription_verificationError");
    if (message === IAP_STORE_UNAVAILABLE_MESSAGE) return t("settings.subscription_storeUnavailable");
    if (message === IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE) {
      return t("settings.subscription_androidOfferMissing", {
        defaultValue: "Google Play subscription offer is not configured. Please try again later.",
      });
    }
    return message || t("toast.networkError");
  }, [t]);

  const handleUpgrade = useCallback(async (planKey: "INDIVIDUAL", requestedCycle?: Cycle) => {
    // Resolve the effective cycle. When the caller doesn't specify, fall
    // back to whatever campaign is live (annual trial wins over monthly
    // paid). This keeps the legacy single-CTA call site working unchanged.
    const fallbackCycle: Cycle = annualOffer ? "yearly" : monthlyOffer ? "monthly" : "yearly";
    const cycle: Cycle = requestedCycle || fallbackCycle;
    const processingKey = `${planKey}_${cycle}`;
    setProcessingPlan(processingKey);

    if (!canUseNativePurchases) {
      setProcessingPlan(null);
      hapticError();
      Alert.alert(t("settings.subscription_billingUnavailable"), t("settings.subscription_mobilePurchasesUnavailable"));
      return;
    }

    // Disclosure gate runs before the native store purchase path. Apple's
    // in-app paywall and Google Play's billing UI cover their own
    // legal copy, but they do not surface the campaign-specific trial
    // terms (length, first-charge date, cancel-by date) the admin
    // configured. Showing the campaign disclosure before native purchase
    // keeps mobile parity with web while the store purchase flag is enabled.
    const targetCampaign = cycle === "yearly" ? annualOffer : monthlyOffer;
    const localizedPrice = cycle === "yearly" ? localizedYearlyPrice : localizedMonthlyPrice;
    const disclosureBody =
      targetCampaign?.checkoutDisclosureCopy ||
      (cycle === "monthly"
        ? t("settings.subscription_disclosureMonthly", {
            price: localizedPrice || targetCampaign?.displayPriceLabel || "the displayed price",
          })
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

    // Native IAP path — preferred on iOS/Android (required by store policy).
    // Pick the SKU matching the user-chosen cycle. Fall back to monthly when
    // the yearly SKU is not configured so a single-SKU build keeps working.
    const targetSku = cycle === "yearly" ? (yearlySku || monthlySku) : monthlySku;
    const targetOfferToken = Platform.OS === "android"
      ? cycle === "yearly" && yearlySku
        ? yearlyOfferToken
        : monthlyOfferToken
      : undefined;
    if (targetSku) {
      const result = await purchaseSubscription({ productId: targetSku, offerToken: targetOfferToken });
      setProcessingPlan(null);

      if (result.status === "cancelled") return;
      if (result.status === "error") {
        hapticError();
        Alert.alert(t("common.retry"), getLocalizedIapError(result.message));
        return;
      }
      hapticSuccess();
      await fetchSubscription();
      return;
    }

    setProcessingPlan(null);
    hapticError();
    Alert.alert(t("settings.subscription_billingUnavailable"), t("settings.subscription_storeUnavailable"));
  }, [
    canUseNativePurchases,
    monthlySku,
    yearlySku,
    monthlyOfferToken,
    yearlyOfferToken,
    fetchSubscription,
    t,
    annualOffer,
    monthlyOffer,
    localizedMonthlyPrice,
    localizedYearlyPrice,
    getLocalizedIapError,
  ]);

  const handleManageBilling = useCallback(async () => {
    setProcessingPlan("MANAGE");

    // Store-managed subscriptions: send the user to the native management page.
    if (isStoreManaged && canUseNativePurchases) {
      setProcessingPlan(null);
      await openNativeSubscriptionSettings(
        subscription?.billingProductId || monthlySku || yearlySku || undefined,
      );
      return;
    }

    setProcessingPlan(null);
    hapticError();
    Alert.alert(
      t("settings.subscription_billingUnavailable"),
      isStripeManaged
        ? t("settings.subscription_webManagedReadOnly")
        : t("settings.subscription_mobilePurchasesUnavailable"),
    );
  }, [
    canUseNativePurchases,
    isStoreManaged,
    isStripeManaged,
    subscription?.billingProductId,
    monthlySku,
    yearlySku,
    t,
  ]);

  const handleRestore = useCallback(async () => {
    if (!canUseNativePurchases) return;
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
  }, [canUseNativePurchases, fetchSubscription, t]);

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

        {isNativeStorePlatform && (isStripeManaged || !canUseNativePurchases) && (
          <View style={styles.mobileBillingNotice}>
            <Text style={styles.mobileBillingNoticeText}>
              {isStripeManaged
                ? t("settings.subscription_webManagedReadOnly")
                : t("settings.subscription_mobilePurchasesUnavailable")}
            </Text>
          </View>
        )}

        <View style={styles.heroBox}>
          <Crown size={32} color={theme.colors.amber.text} />
          <Text style={styles.heroTitle}>{t("pricing.title")}</Text>
          <Text style={styles.heroDesc}>
            {t("pricing.subtitle")}
          </Text>
        </View>

        {PLANS.map((plan) => {
          const dynamicPeriod = plan.period;
          // The INDIVIDUAL card supports two CTAs (monthly + annual) once both
          // store SKUs are configured. Until then we fall back to the legacy
          // single-CTA layout that ships in earlier mobile builds.
          const showSplitCtas =
            plan.key === "INDIVIDUAL" &&
            plan.key !== currentPlanKey &&
            canUseNativePurchases &&
            Boolean(yearlySku) &&
            Boolean(monthlySku);
          const monthlyDisplayPrice =
            localizedMonthlyPrice ||
            monthlyOffer?.displayPriceLabel ||
            plan.price + plan.period;
          const yearlyDisplayPrice =
            localizedYearlyPrice ||
            annualOffer?.displayPriceLabel ||
            plan.yearlyPrice ||
            "";
          const savingsText = showSplitCtas
            ? computeAnnualSavingsText(yearlyDisplayPrice, monthlyDisplayPrice)
            : null;
          const trialBadge = annualOffer?.trialLabel
            ? `First ${annualOffer.trialLabel} free`
            : annualOffer?.trialDays
              ? `First ${annualOffer.trialDays} days free`
              : null;
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
                  {plan.key === "INDIVIDUAL" && localizedMonthlyPrice ? localizedMonthlyPrice : plan.price}
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
            ) : isNativeStorePlatform && !canUseNativePurchases ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>
                  {t("settings.subscription_mobilePurchasesUnavailable")}
                </Text>
              </View>
            ) : showSplitCtas ? (
              <View style={styles.splitCtaWrap}>
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  activeOpacity={0.7}
                  onPress={() => handleUpgrade("INDIVIDUAL", "yearly")}
                  disabled={processingPlan === "INDIVIDUAL_yearly"}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.subscription_a11yUpgradeAnnual", {
                    defaultValue: "Start annual plan with 3-month free trial",
                  })}
                  accessibilityState={{ disabled: processingPlan === "INDIVIDUAL_yearly" }}
                >
                  {processingPlan === "INDIVIDUAL_yearly" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Zap size={16} color="#fff" />
                      <Text style={styles.upgradeBtnText}>
                        {trialBadge
                          ? t("settings.subscription_subscribeAnnualTrial")
                          : `Start annual · ${yearlyDisplayPrice}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={styles.annualMetaRow}>
                  <Text style={styles.annualMetaText}>
                    {yearlyDisplayPrice}
                    {trialBadge ? ` · ${trialBadge}` : ""}
                  </Text>
                  {savingsText ? (
                    <Text style={styles.savingsText}>{savingsText}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.7}
                  onPress={() => handleUpgrade("INDIVIDUAL", "monthly")}
                  disabled={processingPlan === "INDIVIDUAL_monthly"}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.subscription_a11yUpgradeMonthly", {
                    defaultValue: "Start monthly plan",
                  })}
                  accessibilityState={{ disabled: processingPlan === "INDIVIDUAL_monthly" }}
                >
                  {processingPlan === "INDIVIDUAL_monthly" ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>
                      {t("settings.subscription_subscribeMonthly")} · {monthlyDisplayPrice}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.legalCopy}>
                  {t("settings.subscription_storeLegal", {
                    defaultValue:
                      "Subscription renews automatically through your App Store or Google Play account until canceled. Trial availability is managed by the app store.",
                  })}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.7}
                onPress={() => handleUpgrade("INDIVIDUAL")}
                disabled={
                  processingPlan === "INDIVIDUAL_yearly" ||
                  processingPlan === "INDIVIDUAL_monthly"
                }
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_a11yUpgrade", { plan: plan.name })}
                accessibilityHint={t("settings.subscription_a11yUpgradeHint")}
                accessibilityState={{
                  disabled:
                    processingPlan === "INDIVIDUAL_yearly" ||
                    processingPlan === "INDIVIDUAL_monthly",
                }}
              >
                {processingPlan === "INDIVIDUAL_yearly" || processingPlan === "INDIVIDUAL_monthly" ? (
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
        {canUseNativePurchases && (
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
          {isNativeStorePlatform && !canUseNativePurchases
            ? t("settings.subscription_mobilePurchasesUnavailable")
            : t("settings.subscription_manage")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    borderColor: "rgba(127, 182, 232,0.3)",
    backgroundColor: "rgba(127, 182, 232,0.08)",
    padding: 16,
  },
  currentPlanLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 12 },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127, 182, 232,0.14)",
  },
  currentPlanTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  currentPlanMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  mobileBillingNotice: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
    marginTop: 12,
  },
  mobileBillingNoticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
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
  disabledPurchaseNotice: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  disabledPurchaseText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },
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
  splitCtaWrap: { marginTop: 16, gap: 10 },
  annualMetaRow: { gap: 2 },
  annualMetaText: { fontSize: 12, color: theme.colors.textTertiary, textAlign: "center" },
  savingsText: { fontSize: 12, fontWeight: "600", color: theme.colors.emerald.text, textAlign: "center" },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
  legalCopy: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 4,
  },
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
