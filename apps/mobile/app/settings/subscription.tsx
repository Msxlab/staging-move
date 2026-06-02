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
  ExternalLink,
  Zap,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import {
  isMobileStorePurchasesEnabledForPlatform,
  mobileStoreCommerceAdvertisableForPlatform,
} from "@/lib/billing-flags";
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
  billingInterval?: string | null;
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

const MANAGED_SUBSCRIPTION_BLOCKING_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "CANCEL_AT_PERIOD_END",
  "GRACE_PERIOD",
  "PAST_DUE",
  "PENDING_VALIDATION",
]);

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

function stripBillingPeriod(label: string) {
  return label.replace(/\s*\/\s*(month|mo|year|yr)\b/gi, "").trim();
}

function formatAmountLike(label: string | null | undefined, amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const plain = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  const fallback = `$${plain}`;
  if (!label) return fallback;

  const match = label.match(/([0-9]+(?:[.,][0-9]{1,2})?)/);
  if (!match) return fallback;
  const rawNumber = match[1];
  const index = match.index ?? label.indexOf(rawNumber);
  const prefix = label.slice(0, index);
  const suffix = stripBillingPeriod(label.slice(index + rawNumber.length));
  const localizedNumber = plain.replace(".", rawNumber.includes(",") ? "," : ".");

  return `${prefix}${localizedNumber}${suffix}`.trim();
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
  return `Save ${formatAmountLike(yearlyLabel || monthlyLabel, saved)}/year vs monthly · ${percent}% off`;
}

function computeAnnualMonthlyEquivalentText(yearlyLabel: string | null | undefined): string | null {
  const yearly = parseAmount(yearlyLabel);
  if (!yearly) return null;
  return `${formatAmountLike(yearlyLabel, yearly / 12)}/month`;
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
  const [storeProductsLoading, setStoreProductsLoading] = useState(false);
  const [storeProductsLoaded, setStoreProductsLoaded] = useState(false);
  const [storeMonthlyProductAvailable, setStoreMonthlyProductAvailable] = useState(false);
  const [storeYearlyProductAvailable, setStoreYearlyProductAvailable] = useState(false);
  const [annualOffer, setAnnualOffer] = useState<PublicCampaignSummary | null>(null);
  const [monthlyOffer, setMonthlyOffer] = useState<PublicCampaignSummary | null>(null);

  const fetchSubscription = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      setSubscription(res.data.subscription || null);
    }
  }, []);

  const fetchIapProducts = useCallback(async () => {
    if (!isMobileStorePurchasesEnabledForPlatform() || (Platform.OS !== "ios" && Platform.OS !== "android")) {
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
  const mobileStorePurchasesEnabled = isMobileStorePurchasesEnabledForPlatform();
  const mobileStoreCommerceAdvertisable = mobileStoreCommerceAdvertisableForPlatform();
  const canFetchNativeStoreProducts = isNativeStorePlatform && mobileStorePurchasesEnabled && iapAvailable;
  const canUseNativePurchases =
    canFetchNativeStoreProducts &&
    storeProductsLoaded &&
    (storeMonthlyProductAvailable || storeYearlyProductAvailable);
  const nativePurchaseUnavailableMessage = !mobileStorePurchasesEnabled
    ? t("settings.subscription_mobilePurchasesDisabledForBuild", {
        defaultValue: "Mobile purchases are not enabled in this build.",
      })
    : !iapAvailable
      ? t("settings.subscription_mobileProductsNotConfigured", {
          defaultValue: "App Store or Google Play products are not configured yet.",
        })
      : storeProductsLoading || !storeProductsLoaded
        ? t("settings.subscription_mobileProductsLoading", {
            defaultValue: "Loading App Store or Google Play products...",
          })
        : !canUseNativePurchases
          ? t("settings.subscription_mobileProductsNotAvailable", {
              defaultValue: "App Store or Google Play products are not available on this device yet.",
            })
          : t("settings.subscription_mobilePurchasesUnavailable");
  const canAdvertiseMobilePaidPlan =
    !isNativeStorePlatform || (mobileStoreCommerceAdvertisable && canUseNativePurchases);

  // Pull localized prices for both SKUs in a single fetchProducts call so
  // StoreKit/Play return one batch instead of two round-trips.
  useEffect(() => {
    const skus = [monthlySku, yearlySku].filter((sku): sku is string => Boolean(sku));
    if (!canFetchNativeStoreProducts || skus.length === 0) {
      setLocalizedMonthlyPrice(null);
      setLocalizedYearlyPrice(null);
      setMonthlyOfferToken(null);
      setYearlyOfferToken(null);
      setStoreProductsLoading(false);
      setStoreProductsLoaded(false);
      setStoreMonthlyProductAvailable(false);
      setStoreYearlyProductAvailable(false);
      return;
    }
    let cancelled = false;
    setStoreProductsLoading(true);
    setStoreProductsLoaded(false);
    (async () => {
      const products = await fetchSubscriptionProducts(skus);
      if (cancelled) return;
      const monthly = products.find((p) => p.id === monthlySku);
      const yearly = products.find((p) => p.id === yearlySku);
      const monthlyAndroidOffer = monthly ? selectAndroidSubscriptionOffer(monthly, "monthly") : null;
      const yearlyAndroidOffer = yearly ? selectAndroidSubscriptionOffer(yearly, "yearly") : null;
      const monthlyAvailable = Boolean(monthly && (Platform.OS !== "android" || monthlyAndroidOffer?.offerToken));
      const yearlyAvailable = Boolean(yearly && (Platform.OS !== "android" || yearlyAndroidOffer?.offerToken));
      setLocalizedMonthlyPrice(monthly?.displayPrice || null);
      setLocalizedYearlyPrice(yearly?.displayPrice || null);
      setMonthlyOfferToken(monthlyAndroidOffer?.offerToken || null);
      setYearlyOfferToken(yearlyAndroidOffer?.offerToken || null);
      setStoreMonthlyProductAvailable(monthlyAvailable);
      setStoreYearlyProductAvailable(yearlyAvailable);
      setStoreProductsLoaded(true);
      setStoreProductsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetchNativeStoreProducts, monthlySku, yearlySku]);

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
  const currentBillingCycle: Cycle | null =
    subscription?.billingInterval === "YEAR"
      ? "yearly"
      : subscription?.billingInterval === "MONTH"
        ? "monthly"
        : null;
  const currentPlan = useMemo(
    () => currentPlanKey ? PLANS.find((plan) => plan.key === currentPlanKey) || null : null,
    [currentPlanKey]
  );
  const periodEndLabel = formatDateLabel(
    subscription?.currentPeriodEndsAt || subscription?.stripeCurrentPeriodEnd || subscription?.premiumUntil
  );
  const trialEndLabel = formatDateLabel(subscription?.trialEndsAt);
  const isStoreManaged = currentProvider === "APP_STORE" || currentProvider === "PLAY_STORE";
  const isActiveIndividualPlan =
    currentPlanKey === "INDIVIDUAL" &&
    MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(currentStatus);
  const hasActiveStripeSubscription =
    isActiveIndividualPlan &&
    (currentProvider === "STRIPE" || Boolean(subscription?.stripeCustomerId));
  const isStripeManaged = hasActiveStripeSubscription;
  const currentPlatformStoreProvider =
    Platform.OS === "ios" ? "APP_STORE" : Platform.OS === "android" ? "PLAY_STORE" : null;
  const isCurrentPlatformStoreManaged =
    Boolean(currentPlatformStoreProvider) && currentProvider === currentPlatformStoreProvider;
  const isOtherPlatformStoreManaged = isStoreManaged && !isCurrentPlatformStoreManaged;
  const managedSubscriptionBlocksPurchase =
    isActiveIndividualPlan &&
    (isStripeManaged || isOtherPlatformStoreManaged);
  const isUnmanagedNativeEligiblePlan =
    isActiveIndividualPlan &&
    !isStoreManaged &&
    !isStripeManaged;
  const canStartNativePurchase = canUseNativePurchases && !managedSubscriptionBlocksPurchase;
  const canManageBilling =
    (isCurrentPlatformStoreManaged && canUseNativePurchases) ||
    (!isNativeStorePlatform && Boolean(subscription?.stripeCustomerId) && !isStoreManaged);

  const managedElsewhereMessage = isStripeManaged
    ? t("settings.subscription_webManagedReadOnly")
    : currentProvider === "APP_STORE"
      ? t("settings.subscription_appStoreManagedReadOnly", {
          defaultValue: "Your subscription is managed in the App Store. You can continue using your account here.",
        })
      : currentProvider === "PLAY_STORE"
        ? t("settings.subscription_playStoreManagedReadOnly", {
            defaultValue: "Your subscription is managed in Google Play. You can continue using your account here.",
          })
        : nativePurchaseUnavailableMessage;

  const getLocalizedIapError = useCallback((message?: string) => {
    if (message === IAP_PURCHASE_FAILED_MESSAGE) return t("settings.subscription_purchaseFailed");
    if (message === IAP_VERIFICATION_ERROR_MESSAGE) return t("settings.subscription_verificationError");
    if (message === IAP_STORE_UNAVAILABLE_MESSAGE) return t("settings.subscription_storeUnavailable");
    if (message === IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE) {
      return t("settings.subscription_androidOfferMissing", {
        defaultValue: "Google Play subscription offer is not configured. Please try again later.",
      });
    }
    if (message === "ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE") {
      return t("settings.subscription_activeManagedElsewhere", {
        defaultValue: "This account already has an active subscription managed elsewhere. You can continue using LocateFlow here.",
      });
    }
    return message || t("toast.networkError");
  }, [t]);

  const handleUpgrade = useCallback(async (planKey: "INDIVIDUAL", requestedCycle?: Cycle) => {
    // Resolve the effective cycle. When the caller doesn't specify, fall
    // back to whatever campaign is live (annual trial wins over monthly
    // paid). This keeps the legacy single-CTA call site working unchanged.
    const fallbackCycle: Cycle = storeYearlyProductAvailable
      ? "yearly"
      : storeMonthlyProductAvailable
        ? "monthly"
        : annualOffer
          ? "yearly"
          : monthlyOffer
            ? "monthly"
            : "yearly";
    const cycle: Cycle = requestedCycle || fallbackCycle;
    const processingKey = `${planKey}_${cycle}`;
    setProcessingPlan(processingKey);

    if (!canStartNativePurchase) {
      setProcessingPlan(null);
      hapticError();
      Alert.alert(
        t("settings.subscription_billingUnavailable"),
        managedSubscriptionBlocksPurchase
          ? managedElsewhereMessage
          : nativePurchaseUnavailableMessage,
      );
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

    // Native IAP path - preferred on iOS/Android (required by store policy).
    // Buy exactly the cycle the user selected; don't silently downgrade annual
    // to monthly if the annual StoreKit/Play product is unavailable.
    const targetSku =
      cycle === "yearly"
        ? storeYearlyProductAvailable
          ? yearlySku
          : null
        : storeMonthlyProductAvailable
          ? monthlySku
          : null;
    const targetOfferToken = Platform.OS === "android"
      ? cycle === "yearly"
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
    canStartNativePurchase,
    managedSubscriptionBlocksPurchase,
    managedElsewhereMessage,
    nativePurchaseUnavailableMessage,
    monthlySku,
    yearlySku,
    monthlyOfferToken,
    yearlyOfferToken,
    storeMonthlyProductAvailable,
    storeYearlyProductAvailable,
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
    if (isCurrentPlatformStoreManaged && canUseNativePurchases) {
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
      isStripeManaged || isOtherPlatformStoreManaged
        ? managedElsewhereMessage
        : t("settings.subscription_mobilePurchasesUnavailable"),
    );
  }, [
    canUseNativePurchases,
    isCurrentPlatformStoreManaged,
    isOtherPlatformStoreManaged,
    isStripeManaged,
    managedElsewhereMessage,
    subscription?.billingProductId,
    monthlySku,
    yearlySku,
    t,
  ]);

  // Stripe-managed subscriptions can't be cancelled or modified from inside
  // the iOS/Android app (Apple guideline 3.1.3 + Play policy forbid linking
  // a paid IAP-eligible flow out to a non-IAP billing portal). Opening the
  // user's existing web account in the browser is fine — that's account
  // management, not external purchase. The URL goes to the web subscription
  // page where Cancel/Resume/Switch-cycle live behind the user's session.
  const handleOpenWebBilling = useCallback(async () => {
    const url = `${APP_WEB_URL}/settings/subscription`;
    const opened = await openWebUrl(url);
    if (!opened) {
      hapticError();
      Alert.alert(
        t("settings.subscription_billingUnavailable"),
        t("settings.subscription_openWebBillingFailed"),
      );
    }
  }, [t]);

  const handleRestore = useCallback(async () => {
    if (!canUseNativePurchases || managedSubscriptionBlocksPurchase) return;
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
  }, [canUseNativePurchases, managedSubscriptionBlocksPurchase, fetchSubscription, t]);

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
                {currentPlan?.name
                  ? currentPlan.name +
                    (currentPlanKey === "INDIVIDUAL" && subscription?.billingInterval === "YEAR"
                      ? ` · ${t("settings.subscription_billingIntervalAnnual", { defaultValue: "Annual" })}`
                      : currentPlanKey === "INDIVIDUAL" && subscription?.billingInterval === "MONTH"
                        ? ` · ${t("settings.subscription_billingIntervalMonthly", { defaultValue: "Monthly" })}`
                        : "")
                  : t("settings.subscription_noActivePlan", { defaultValue: "No active subscription" })}
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

        {isNativeStorePlatform && (isStripeManaged || isOtherPlatformStoreManaged || !canUseNativePurchases) && (
          <View style={styles.mobileBillingNotice}>
            <Text style={styles.mobileBillingNoticeText}>
              {isStripeManaged || isOtherPlatformStoreManaged
                ? managedElsewhereMessage
                : nativePurchaseUnavailableMessage}
            </Text>
            {hasActiveStripeSubscription && (
              <TouchableOpacity
                style={styles.openWebBillingBtn}
                activeOpacity={0.7}
                onPress={handleOpenWebBilling}
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_openWebBilling")}
                accessibilityHint={t("settings.subscription_openWebBillingHint")}
              >
                <ExternalLink size={14} color={theme.colors.primary} />
                <Text style={styles.openWebBillingBtnText}>
                  {t("settings.subscription_openWebBilling")}
                </Text>
              </TouchableOpacity>
            )}
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
          const isIndividualPlan = plan.key === "INDIVIDUAL";
          const isCurrentPlan = plan.key === currentPlanKey;
          const isCurrentIndividualPlan = isIndividualPlan && isCurrentPlan;
          // The INDIVIDUAL card supports whichever cycles the native store
          // currently returns. Backend SKU config alone is not enough here:
          // StoreKit/Play may still be propagating or missing a base plan.
          const showNativeCycleActions =
            isIndividualPlan &&
            canStartNativePurchase &&
            (storeYearlyProductAvailable || storeMonthlyProductAvailable) &&
            (
              !isCurrentPlan ||
              isUnmanagedNativeEligiblePlan ||
              isCurrentPlatformStoreManaged
            );
          const showAnnualAction =
            showNativeCycleActions &&
            storeYearlyProductAvailable &&
            !(isCurrentPlatformStoreManaged && currentBillingCycle === "yearly");
          const showMonthlyAction =
            showNativeCycleActions &&
            storeMonthlyProductAvailable &&
            !(isCurrentPlatformStoreManaged && currentBillingCycle === "monthly");
          const monthlyDisplayPrice =
            localizedMonthlyPrice ||
            monthlyOffer?.displayPriceLabel ||
            plan.price + plan.period;
          const yearlyDisplayPrice =
            localizedYearlyPrice ||
            annualOffer?.displayPriceLabel ||
            plan.yearlyPrice ||
            "";
          const hideUnavailableMobileCommerce =
            isIndividualPlan &&
            isNativeStorePlatform &&
            !canAdvertiseMobilePaidPlan &&
            !isCurrentPlan;
          const savingsText = showAnnualAction
            ? computeAnnualSavingsText(yearlyDisplayPrice, monthlyDisplayPrice)
            : null;
          const currentAnnualSavingsText = computeAnnualSavingsText(yearlyDisplayPrice, monthlyDisplayPrice);
          const currentAnnualMonthlyEquivalentText = computeAnnualMonthlyEquivalentText(yearlyDisplayPrice);
          const isCurrentAnnualIndividual =
            isCurrentIndividualPlan && currentBillingCycle === "yearly";
          const planDisplayName = isCurrentAnnualIndividual
            ? `${plan.name} Annual`
            : isCurrentIndividualPlan && currentBillingCycle === "monthly"
              ? `${plan.name} Monthly`
              : plan.name;
          const planPriceLabel = isCurrentAnnualIndividual && yearlyDisplayPrice
            ? stripBillingPeriod(yearlyDisplayPrice)
            : plan.key === "INDIVIDUAL" && localizedMonthlyPrice
              ? stripBillingPeriod(localizedMonthlyPrice)
              : stripBillingPeriod(plan.price);
          const planPeriodLabel = isCurrentAnnualIndividual ? "/year" : dynamicPeriod;
          const currentAnnualValueText = isCurrentAnnualIndividual
            ? [
                currentAnnualMonthlyEquivalentText
                  ? `Equivalent to ${currentAnnualMonthlyEquivalentText}`
                  : null,
                currentAnnualSavingsText,
              ].filter(Boolean).join(" · ")
            : null;
          const trialBadge = !isCurrentIndividualPlan && annualOffer?.trialLabel
            ? `First ${annualOffer.trialLabel} free`
            : !isCurrentIndividualPlan && annualOffer?.trialDays
              ? `First ${annualOffer.trialDays} days free`
              : null;
          const annualButtonLabel =
            isCurrentPlatformStoreManaged && currentBillingCycle === "monthly"
              ? `Switch to annual · ${yearlyDisplayPrice}`
              : trialBadge
                ? t("settings.subscription_subscribeAnnualTrial")
                : `Start annual · ${yearlyDisplayPrice}`;
          const monthlyButtonLabel =
            isCurrentPlatformStoreManaged && currentBillingCycle === "yearly"
              ? `Switch to monthly · ${monthlyDisplayPrice}`
              : `${t("settings.subscription_subscribeMonthly")} · ${monthlyDisplayPrice}`;
          return (
          <Card
            key={plan.key}
            variant={plan.key === currentPlanKey ? "glow" : "default"}
            style={{ marginTop: 14 }}
          >
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{planDisplayName}</Text>
                  {plan.key === currentPlanKey && <UiBadge label={t("pricing.cta_current")} variant="success" />}
                </View>
                {!hideUnavailableMobileCommerce ? (
                  <>
                    <Text style={styles.planPrice}>
                      {planPriceLabel}
                      <Text style={styles.planPeriod}> {planPeriodLabel}</Text>
                    </Text>
                    {currentAnnualValueText ? (
                      <Text style={styles.currentAnnualValueText}>{currentAnnualValueText}</Text>
                    ) : null}
                  </>
                ) : null}
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

            {showNativeCycleActions && (showAnnualAction || showMonthlyAction) ? (
              <View style={styles.splitCtaWrap}>
                {showAnnualAction ? (
                  <>
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
                          <Text style={styles.upgradeBtnText}>{annualButtonLabel}</Text>
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
                  </>
                ) : null}
                {showMonthlyAction ? (
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
                      <Text style={styles.secondaryBtnText}>{monthlyButtonLabel}</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {canManageBilling ? (
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
                ) : null}
                <Text style={styles.legalCopy}>
                  {t("settings.subscription_storeLegal", {
                    defaultValue:
                      "Subscription renews automatically through your App Store or Google Play account until canceled. Trial availability is managed by the app store.",
                  })}
                </Text>
              </View>
            ) : plan.key === currentPlanKey ? (
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
            ) : plan.key === "FAMILY" || plan.key === "PRO" ? (
              // Family/Pro are web-only purchases (Apple/Play policy). Never run
              // a native store purchase for them — open the web pricing page so
              // the upgrade happens where billing is managed.
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.7}
                onPress={() => openWebUrl(`${APP_WEB_URL}/pricing#family-pro`)}
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_a11yUpgradeWeb", {
                  plan: plan.name,
                  defaultValue: `Upgrade to ${plan.name} on the web`,
                })}
              >
                <ExternalLink size={16} color="#fff" />
                <Text style={styles.upgradeBtnText}>
                  {t("settings.subscription_upgradeOnWeb", { defaultValue: "Upgrade on the web" })}
                </Text>
              </TouchableOpacity>
            ) : isNativeStorePlatform && !canStartNativePurchase ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>
                  {managedSubscriptionBlocksPurchase
                    ? managedElsewhereMessage
                    : nativePurchaseUnavailableMessage}
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
        {canUseNativePurchases && !managedSubscriptionBlocksPurchase && (
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

        <View style={styles.legalLinksRow}>
          <TouchableOpacity
            style={styles.legalLinkBtn}
            activeOpacity={0.7}
            onPress={() => openWebUrl(`${APP_WEB_URL}/terms`)}
            accessibilityRole="link"
          >
            <ExternalLink size={13} color={theme.colors.primary} />
            <Text style={styles.legalLinkText}>
              {t("settings.termsOfUse", { defaultValue: "Terms of Use" })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalLinkBtn}
            activeOpacity={0.7}
            onPress={() => openWebUrl(`${APP_WEB_URL}/privacy`)}
            accessibilityRole="link"
          >
            <ExternalLink size={13} color={theme.colors.primary} />
            <Text style={styles.legalLinkText}>
              {t("settings.privacyPolicy", { defaultValue: "Privacy Policy" })}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          {isNativeStorePlatform && isUnmanagedNativeEligiblePlan
            ? t("settings.subscription_restoreStoreOnly", {
                defaultValue:
                  "Restore only finds subscriptions purchased with this App Store or Google Play account.",
              })
            : isNativeStorePlatform && managedSubscriptionBlocksPurchase
            ? managedElsewhereMessage
            : isNativeStorePlatform && !canUseNativePurchases
            ? nativePurchaseUnavailableMessage
            : isCurrentPlatformStoreManaged
              ? t("settings.subscription_manage")
              : ""}
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
  openWebBillingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  openWebBillingBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  heroBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  heroDesc: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", maxWidth: 280 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  planPrice: { fontSize: 28, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  planPeriod: { fontSize: 14, fontWeight: "400", color: theme.colors.textTertiary },
  currentAnnualValueText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: theme.colors.emerald.text,
    marginTop: 4,
  },
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
  legalLinksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  legalLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  legalLinkText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  footer: {
    textAlign: "center", fontSize: 12, color: theme.colors.textMuted, marginTop: 24,
  },
});

export default LegacySubscriptionScreen;
