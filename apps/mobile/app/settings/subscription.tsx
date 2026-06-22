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
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  Zap,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAppTheme,
  useThemePreference,
  applyPlanPalette,
  fonts,
  theme as baseDarkTheme,
  lightTheme as baseLightTheme,
  type Theme,
} from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { HeroCard, MoveCard, SectionHeader, Pill, MoveRaccoon } from "@/components/move";
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
  getAnnualActionLabels,
  shouldEmphasizeAnnualBilledPrice,
} from "@/lib/subscription-app-review";
import {
  shouldShowMobileConsumerFreePanel,
  shouldRenderMobileSubscriptionPlanCard,
  shouldShowMobileSubscriptionPlan,
} from "@/lib/subscription-visible-plans";
import { buildPlanComparison } from "@/lib/plan-comparison";
import {
  BILLING_PLAN_DEFINITIONS,
  BILLING_PLAN_ORDER,
  TRIAL_DURATION_DAYS,
  billingPriceLabelForInterval,
} from "@locateflow/shared";

// Single source of truth — shared billing module. Prices, features, and
// trial length stay in sync with web automatically.
const PLANS = BILLING_PLAN_ORDER.map((key) => {
  const def = BILLING_PLAN_DEFINITIONS[key];
  return {
    key,
    name: def.displayName,
    price: def.priceLabel,
    monthlyPrice: def.isPaid ? billingPriceLabelForInterval(key, "MONTH") : def.priceLabel,
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
      FAMILY?: string | null;
      FAMILY_MONTHLY?: string | null;
      FAMILY_YEARLY?: string | null;
      PRO?: string | null;
      PRO_MONTHLY?: string | null;
      PRO_YEARLY?: string | null;
    };
  };
  android: {
    available: boolean;
    plans: {
      INDIVIDUAL: string | null;
      INDIVIDUAL_MONTHLY?: string | null;
      INDIVIDUAL_YEARLY?: string | null;
      FAMILY?: string | null;
      FAMILY_MONTHLY?: string | null;
      FAMILY_YEARLY?: string | null;
      PRO?: string | null;
      PRO_MONTHLY?: string | null;
      PRO_YEARLY?: string | null;
    };
  };
};

type Cycle = "monthly" | "yearly";
type PaidNativePlanKey = "INDIVIDUAL" | "FAMILY" | "PRO";
type NativeProductKey = `${PaidNativePlanKey}_${Cycle}`;

const PAID_NATIVE_PLAN_KEYS: PaidNativePlanKey[] = ["INDIVIDUAL", "FAMILY", "PRO"];
const NATIVE_CYCLES: Cycle[] = ["monthly", "yearly"];

function isPaidNativePlanKey(value: string | null | undefined): value is PaidNativePlanKey {
  return value === "INDIVIDUAL" || value === "FAMILY" || value === "PRO";
}

function nativeProductKey(planKey: PaidNativePlanKey, cycle: Cycle): NativeProductKey {
  return `${planKey}_${cycle}`;
}

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
  planKey: PaidNativePlanKey,
  cycle: Cycle,
): string | null {
  if (!iapProducts) return null;
  const platform = Platform.OS === "ios" ? iapProducts.ios : iapProducts.android;
  if (!platform) return null;
  const plans = platform.plans;
  if (cycle === "yearly") {
    if (planKey === "INDIVIDUAL") return plans.INDIVIDUAL_YEARLY ?? null;
    if (planKey === "FAMILY") return plans.FAMILY_YEARLY ?? null;
    return plans.PRO_YEARLY ?? null;
  }
  if (planKey === "INDIVIDUAL") return plans.INDIVIDUAL_MONTHLY ?? plans.INDIVIDUAL ?? null;
  if (planKey === "FAMILY") return plans.FAMILY_MONTHLY ?? plans.FAMILY ?? null;
  return plans.PRO_MONTHLY ?? plans.PRO ?? null;
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

/**
 * Compare-accordion check mark accent. `applyPlanPalette` is intentionally a
 * pass-through now, so every plan resolves to the canonical brand primary while
 * older call sites keep their helper shape.
 */
function planAccentColor(scheme: "light" | "dark", planKey: string): string {
  const base = scheme === "light" ? baseLightTheme : baseDarkTheme;
  // Every plan resolves to the base brand primary; helper kept for compatibility.
  return applyPlanPalette(base, scheme, planKey).colors.primary;
}

function LegacySubscriptionScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [iapProducts, setIapProducts] = useState<IapProductsResponse | null>(null);
  const [localizedStorePrices, setLocalizedStorePrices] = useState<Partial<Record<NativeProductKey, string>>>({});
  const [androidOfferTokens, setAndroidOfferTokens] = useState<Partial<Record<NativeProductKey, string>>>({});
  const [storeProductsLoading, setStoreProductsLoading] = useState(false);
  const [storeProductsLoaded, setStoreProductsLoaded] = useState(false);
  const [storeProductAvailability, setStoreProductAvailability] = useState<Partial<Record<NativeProductKey, boolean>>>({});
  const [annualOffer, setAnnualOffer] = useState<PublicCampaignSummary | null>(null);
  const [monthlyOffer, setMonthlyOffer] = useState<PublicCampaignSummary | null>(null);
  const [entitlement, setEntitlement] = useState<any>(null);
  const [workspaceEntitlement, setWorkspaceEntitlement] = useState<{ workspaceId: string; inherited: boolean } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchSubscription = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      setLoadError(false);
      setSubscription(res.data.subscription || null);
      // The EFFECTIVE entitlement (the owner's plan for an inherited Family/Pro
      // member) and whether it's inherited — without these the member's own row
      // is null/FREE_TRIAL and the screen wrongly shows "No active subscription".
      setEntitlement(res.data.entitlement || null);
      setWorkspaceEntitlement(res.data.workspaceEntitlement || null);
    } else if (res.error) {
      // Don't let a transient network/500 masquerade as "No active subscription".
      setLoadError(true);
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

  const nativeSkus = useMemo(() => {
    const entries: Partial<Record<NativeProductKey, string>> = {};
    for (const planKey of PAID_NATIVE_PLAN_KEYS) {
      for (const cycle of NATIVE_CYCLES) {
        const sku = resolveSkuFromResponse(iapProducts, planKey, cycle);
        if (sku) entries[nativeProductKey(planKey, cycle)] = sku;
      }
    }
    return entries;
  }, [iapProducts]);
  const monthlySku = nativeSkus.INDIVIDUAL_monthly || null;
  const yearlySku = nativeSkus.INDIVIDUAL_yearly || null;
  const iapAvailable = Object.keys(nativeSkus).length > 0;
  const isNativeStorePlatform = Platform.OS === "ios" || Platform.OS === "android";
  const mobileStorePurchasesEnabled = isMobileStorePurchasesEnabledForPlatform();
  const mobileStoreCommerceAdvertisable = mobileStoreCommerceAdvertisableForPlatform();
  const canFetchNativeStoreProducts = isNativeStorePlatform && mobileStorePurchasesEnabled && iapAvailable;
  const canUseNativePurchases =
    canFetchNativeStoreProducts &&
    storeProductsLoaded &&
    Object.values(storeProductAvailability).some(Boolean);
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
  // Pull localized prices for every configured SKU in a single fetchProducts
  // call so StoreKit/Play return one batch instead of per-plan round-trips.
  useEffect(() => {
    const skuEntries = Object.entries(nativeSkus) as Array<[NativeProductKey, string]>;
    const skus = [...new Set(skuEntries.map(([, sku]) => sku).filter(Boolean))];
    if (!canFetchNativeStoreProducts || skus.length === 0) {
      setLocalizedStorePrices({});
      setAndroidOfferTokens({});
      setStoreProductsLoading(false);
      setStoreProductsLoaded(false);
      setStoreProductAvailability({});
      return;
    }
    let cancelled = false;
    setStoreProductsLoading(true);
    setStoreProductsLoaded(false);
    (async () => {
      const products = await fetchSubscriptionProducts(skus);
      if (cancelled) return;
      const nextPrices: Partial<Record<NativeProductKey, string>> = {};
      const nextOfferTokens: Partial<Record<NativeProductKey, string>> = {};
      const nextAvailability: Partial<Record<NativeProductKey, boolean>> = {};
      for (const [key, sku] of skuEntries) {
        const cycle = key.endsWith("_yearly") ? "yearly" : "monthly";
        const product = products.find((p) => p.id === sku);
        const androidOffer = product ? selectAndroidSubscriptionOffer(product, cycle) : null;
        nextPrices[key] = product?.displayPrice || undefined;
        nextOfferTokens[key] = androidOffer?.offerToken || undefined;
        nextAvailability[key] = Boolean(product && (Platform.OS !== "android" || androidOffer?.offerToken));
      }
      setLocalizedStorePrices(nextPrices);
      setAndroidOfferTokens(nextOfferTokens);
      setStoreProductAvailability(nextAvailability);
      setStoreProductsLoaded(true);
      setStoreProductsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetchNativeStoreProducts, nativeSkus]);

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
  // Effective entitlement: an inherited Family/Pro member has no own paid row,
  // so the EFFECTIVE plan (the owner's) drives what we show. The own
  // currentPlanKey is kept only for store purchase/manage gating below.
  const inheritedEntitlement = workspaceEntitlement?.inherited === true;
  const effectivePlanKey: string | null = entitlement?.plan || currentPlanKey;
  const effectiveStatus: string = entitlement?.status || currentStatus;
  const effectiveActive: boolean = entitlement?.isActive ?? hasServerSubscription;
  const isPaidEffectivePlan = effectivePlanKey === "INDIVIDUAL" || effectivePlanKey === "FAMILY" || effectivePlanKey === "PRO";
  const effectivePlan = useMemo(
    () => effectivePlanKey ? PLANS.find((plan) => plan.key === effectivePlanKey) || null : null,
    [effectivePlanKey]
  );
  const showConsumerFreePanel = shouldShowMobileConsumerFreePanel({
    loading,
    managementKind: entitlement?.managementKind,
    effectivePlanKey,
    effectiveActive,
  });
  const periodEndLabel = formatDateLabel(
    subscription?.currentPeriodEndsAt || subscription?.stripeCurrentPeriodEnd || subscription?.premiumUntil
  );
  const trialEndLabel = formatDateLabel(subscription?.trialEndsAt);
  const isStoreManaged = currentProvider === "APP_STORE" || currentProvider === "PLAY_STORE";
  const currentPaidPlanKey = isPaidNativePlanKey(currentPlanKey) ? currentPlanKey : null;
  const isActivePaidPlan =
    Boolean(currentPaidPlanKey) &&
    MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(currentStatus);
  const hasActiveStripeSubscription =
    isActivePaidPlan &&
    (currentProvider === "STRIPE" || Boolean(subscription?.stripeCustomerId));
  const isStripeManaged = hasActiveStripeSubscription;
  const currentPlatformStoreProvider =
    Platform.OS === "ios" ? "APP_STORE" : Platform.OS === "android" ? "PLAY_STORE" : null;
  const isCurrentPlatformStoreManaged =
    Boolean(currentPlatformStoreProvider) && currentProvider === currentPlatformStoreProvider;
  const isOtherPlatformStoreManaged = isStoreManaged && !isCurrentPlatformStoreManaged;
  const managedSubscriptionBlocksPurchase =
    isActivePaidPlan &&
    (isStripeManaged || isOtherPlatformStoreManaged);
  const isUnmanagedNativeEligiblePlan =
    isActivePaidPlan &&
    !isStoreManaged &&
    !isStripeManaged;
  // An inherited Family/Pro member already has access via the workspace owner's
  // plan — let them start a native purchase and they'd be double-charged for a
  // redundant Individual sub. Block it; the inherited notice explains why.
  const canStartNativePurchase =
    canUseNativePurchases && !managedSubscriptionBlocksPurchase && !inheritedEntitlement;
  const canManageBilling =
    (isCurrentPlatformStoreManaged && canUseNativePurchases) ||
    (!isNativeStorePlatform && Boolean(subscription?.stripeCustomerId) && !isStoreManaged);
  const getNativeSku = useCallback(
    (planKey: PaidNativePlanKey, cycle: Cycle) => nativeSkus[nativeProductKey(planKey, cycle)] || null,
    [nativeSkus],
  );
  const hasConfiguredNativeSku = useCallback(
    (planKey: PaidNativePlanKey) => Boolean(getNativeSku(planKey, "monthly") || getNativeSku(planKey, "yearly")),
    [getNativeSku],
  );
  const hasAvailableNativeSku = useCallback(
    (planKey: PaidNativePlanKey, cycle?: Cycle) => {
      if (cycle) return Boolean(storeProductAvailability[nativeProductKey(planKey, cycle)]);
      return Boolean(
        storeProductAvailability[nativeProductKey(planKey, "monthly")] ||
        storeProductAvailability[nativeProductKey(planKey, "yearly")]
      );
    },
    [storeProductAvailability],
  );
  const getStorePrice = useCallback(
    (planKey: PaidNativePlanKey, cycle: Cycle) => localizedStorePrices[nativeProductKey(planKey, cycle)] || null,
    [localizedStorePrices],
  );
  const getAndroidOfferToken = useCallback(
    (planKey: PaidNativePlanKey, cycle: Cycle) => androidOfferTokens[nativeProductKey(planKey, cycle)] || null,
    [androidOfferTokens],
  );
  const currentPlanStoreSku =
    currentPaidPlanKey && currentBillingCycle
      ? getNativeSku(currentPaidPlanKey, currentBillingCycle)
      : null;
  const visiblePlans = useMemo(
    () =>
      // Inherited Family/Pro members already have access — don't offer them
      // plans to buy (would double-charge); the inherited notice covers it.
      inheritedEntitlement || showConsumerFreePanel
        ? []
        : PLANS.filter((plan) =>
        shouldShowMobileSubscriptionPlan({
          planKey: plan.key,
          currentPlanKey,
          isNativeStorePlatform,
          mobileStorePurchasesEnabled,
          hasConfiguredNativeSku: isPaidNativePlanKey(plan.key) ? hasConfiguredNativeSku(plan.key) : false,
        }) &&
        shouldRenderMobileSubscriptionPlanCard({
          planKey: plan.key,
          currentPlanKey,
        }),
      ),
    [
      inheritedEntitlement,
      showConsumerFreePanel,
      currentPlanKey,
      hasConfiguredNativeSku,
      isNativeStorePlatform,
      mobileStorePurchasesEnabled,
    ],
  );

  // Informational side-by-side matrix: every tier from the shared definitions,
  // even when its purchase card is hidden on this platform (no SKU, inherited
  // member, free user). Prices follow the same store-advertisability rule as
  // the purchase cards; features are the shared single source of truth.
  const planComparison = useMemo(
    () =>
      buildPlanComparison({
        currentPlanKey: effectivePlanKey,
        isNativeStorePlatform,
        mobileStoreCommerceAdvertisable,
        hasAvailableNativeSku: (planKey) =>
          isPaidNativePlanKey(planKey) ? hasAvailableNativeSku(planKey) : false,
        getStorePriceLabel: (planKey, cycle) =>
          isPaidNativePlanKey(planKey) ? getStorePrice(planKey, cycle) : null,
      }),
    [effectivePlanKey, isNativeStorePlatform, mobileStoreCommerceAdvertisable, hasAvailableNativeSku, getStorePrice],
  );
  // null = default (current plan expanded); "" = all collapsed.
  const [expandedComparePlan, setExpandedComparePlan] = useState<string | null>(null);

  const currentPlanDisplayName = showConsumerFreePanel
    ? t("settings.subscription_consumerFreePlanName", { defaultValue: "Free" })
    : effectivePlan?.name
      ? effectivePlan.name +
        (currentPlanKey === "INDIVIDUAL" && subscription?.billingInterval === "YEAR"
          ? ` · ${t("settings.subscription_billingIntervalAnnual", { defaultValue: "Annual" })}`
          : currentPlanKey === "INDIVIDUAL" && subscription?.billingInterval === "MONTH"
            ? ` · ${t("settings.subscription_billingIntervalMonthly", { defaultValue: "Monthly" })}`
            : "")
      : t("settings.subscription_noActivePlan", { defaultValue: "No active subscription" });
  const currentPlanMetaText = inheritedEntitlement
    ? t("settings.subscription_inheritedNotice", { defaultValue: "Included with your family/workspace plan" })
    : showConsumerFreePanel
      ? t("settings.subscription_consumerFreeMeta", {
          defaultValue: "No subscription, no renewal, no credit card.",
        })
      : periodEndLabel && effectiveStatus === "CANCEL_AT_PERIOD_END"
        ? t("settings.subscription_ends", { date: periodEndLabel, defaultValue: "Ends {{date}}" })
        : periodEndLabel
          ? t("settings.subscription_renews", { date: periodEndLabel })
          : trialEndLabel
            ? t("settings.subscription_renews", { date: trialEndLabel })
            : t("settings.subscription_choosePlan", { defaultValue: "Choose a plan to start." });
  const currentPlanStatusLabel = showConsumerFreePanel
    ? t("settings.subscription_includedStatus", { defaultValue: "Included" })
    : effectiveStatus;
  const currentPlanStatusTone =
    showConsumerFreePanel ||
    effectiveStatus === "ACTIVE" ||
    effectiveStatus === "TRIALING" ||
    (effectiveActive && isPaidEffectivePlan)
      ? "success"
      : "muted";

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

  const managedElsewherePlanCardMessage = isStripeManaged
    ? t("settings.subscription_webManagedPlanCardReadOnly", {
        defaultValue: "Managed on web. Use web billing to change plans.",
      })
    : currentProvider === "APP_STORE"
      ? t("settings.subscription_appStoreManagedPlanCardReadOnly", {
          defaultValue: "Managed in the App Store. Use that store to change plans.",
        })
      : currentProvider === "PLAY_STORE"
        ? t("settings.subscription_playStoreManagedPlanCardReadOnly", {
            defaultValue: "Managed in Google Play. Use that store to change plans.",
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

  const handleUpgrade = useCallback(async (planKey: PaidNativePlanKey, requestedCycle?: Cycle) => {
    const plan = PLANS.find((item) => item.key === planKey);
    const yearlyAvailable = hasAvailableNativeSku(planKey, "yearly");
    const monthlyAvailable = hasAvailableNativeSku(planKey, "monthly");
    const fallbackCycle: Cycle = yearlyAvailable ? "yearly" : monthlyAvailable ? "monthly" : "yearly";
    const cycle: Cycle = requestedCycle || fallbackCycle;
    const processingKey = nativeProductKey(planKey, cycle);
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
    const targetCampaign = planKey === "INDIVIDUAL"
      ? cycle === "yearly" ? annualOffer : monthlyOffer
      : null;
    const localizedPrice = getStorePrice(planKey, cycle);
    const disclosureBody =
      targetCampaign?.checkoutDisclosureCopy ||
      (planKey === "INDIVIDUAL"
        ? cycle === "monthly"
          ? t("settings.subscription_disclosureMonthly", {
              price: localizedPrice || targetCampaign?.displayPriceLabel || "the displayed price",
            })
          : t("settings.subscription_disclosureAnnual", {
              price: localizedPrice || targetCampaign?.displayPriceLabel || "the displayed price",
            })
        : t("settings.subscription_disclosurePaidPlan", {
            plan: plan?.name || planKey,
            cycle: cycle === "yearly" ? "annual" : "monthly",
            price: localizedPrice || "the displayed price",
            defaultValue:
              "{{plan}} {{cycle}} subscription at {{price}} renews automatically through your App Store or Google Play account until canceled.",
          }));
    const annualHeadlinePrice = localizedPrice || targetCampaign?.displayPriceLabel || null;
    const annualHeadline = annualHeadlinePrice
      ? getAnnualActionLabels({
          yearlyDisplayPrice: annualHeadlinePrice,
          isSwitching: false,
          trialBadge: annualOffer?.trialLabel
            ? `First ${annualOffer.trialLabel} free`
            : annualOffer?.trialDays
              ? `First ${annualOffer.trialDays} days free`
              : null,
          startLabel: t("settings.subscription_startAnnual", { defaultValue: "Start annual" }),
        }).buttonLabel
      : t("settings.subscription_subscribeAnnualTrial");
    const headline = targetCampaign?.publicHeadline ||
      (planKey === "INDIVIDUAL"
        ? cycle === "monthly"
          ? t("settings.subscription_subscribeMonthly")
          : annualHeadline
        : t("settings.subscription_subscribePlan", {
            plan: plan?.name || planKey,
            defaultValue: "Subscribe to {{plan}}",
          }));

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
    const targetSku = hasAvailableNativeSku(planKey, cycle) ? getNativeSku(planKey, cycle) : null;
    const targetOfferToken = Platform.OS === "android"
      ? getAndroidOfferToken(planKey, cycle) || undefined
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
    hasAvailableNativeSku,
    getNativeSku,
    getAndroidOfferToken,
    getStorePrice,
    fetchSubscription,
    t,
    annualOffer,
    monthlyOffer,
    getLocalizedIapError,
  ]);

  const handleManageBilling = useCallback(async () => {
    setProcessingPlan("MANAGE");

    // Store-managed subscriptions: send the user to the native management page.
    // Seed only with THIS subscription's product / the current plan's SKU — never
    // the Individual monthly/yearly fallback, which would open the wrong product's
    // management page for a Family/Pro store subscriber. undefined opens the
    // account's general subscriptions list, which is the correct fallback.
    if (isCurrentPlatformStoreManaged && canUseNativePurchases) {
      setProcessingPlan(null);
      await openNativeSubscriptionSettings(
        subscription?.billingProductId || currentPlanStoreSku || undefined,
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
    currentPlanStoreSku,
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
            <ArrowLeft size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("settings.subscription")}</Text>
          <View style={{ width: 40 }} />
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
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.subscription")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loadError && !subscription && !entitlement ? (
          <TouchableOpacity
            onPress={() => { void fetchSubscription(); }}
            accessibilityRole="button"
            style={styles.loadErrorCard}
          >
            <Text style={styles.loadErrorText}>
              {t("settings.subscription_loadError", { defaultValue: "Couldn't load your subscription. Tap to retry." })}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Current plan — Move hero gradient with the raccoon mark, plan name,
            billing cadence and a tonal status pill. */}
        <HeroCard style={styles.currentPlanCard} padding={18} radius={22}>
          <View style={styles.currentPlanTop}>
            <View style={styles.currentPlanLeft}>
              <View style={styles.currentPlanIcon}>
                <MoveRaccoon size={26} mood={isPaidEffectivePlan ? "happy" : "calm"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.currentPlanTitleRow}>
                  <Text style={styles.currentPlanTitle}>
                    {currentPlanDisplayName}
                  </Text>
                  {showConsumerFreePanel ? (
                    <Pill
                      label={t("settings.subscription_everythingIncluded", { defaultValue: "Everything included" })}
                      tone="success"
                    />
                  ) : isPaidEffectivePlan ? (
                    <Pill label={effectivePlanKey as string} tone="accent" />
                  ) : null}
                </View>
                <Text style={styles.currentPlanMeta}>
                  {currentPlanMetaText}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.currentPlanStatusRow}>
            <Pill
              label={currentPlanStatusLabel}
              tone={currentPlanStatusTone}
            />
          </View>
        </HeroCard>

        {effectivePlan && isPaidEffectivePlan && Array.isArray(effectivePlan.features) && effectivePlan.features.length > 0 ? (
          <MoveCard style={styles.planFeaturesCard} padding={16} radius={18}>
            <Text style={styles.planFeaturesTitle}>
              {t("settings.subscription_includedFeatures", { defaultValue: "What's included" })}
            </Text>
            {effectivePlan.features.map((f: string) => (
              <View key={f} style={styles.planFeatureRow}>
                <Check size={14} color={theme.colors.success} />
                <Text style={styles.planFeatureText}>{f}</Text>
              </View>
            ))}
          </MoveCard>
        ) : null}

        {isNativeStorePlatform && !showConsumerFreePanel && (isStripeManaged || isOtherPlatformStoreManaged || !canUseNativePurchases) && (
          <MoveCard style={styles.mobileBillingNotice} padding={14} radius={16}>
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
          </MoveCard>
        )}

        {showConsumerFreePanel ? (
          <MoveCard style={styles.includedAccessCard} padding={16} radius={18}>
            <Text style={styles.includedAccessEyebrow}>
              {t("settings.subscription_currentPlan", { defaultValue: "Current plan" })}
            </Text>
            <Text style={styles.includedAccessTitle}>
              {t("settings.subscription_freeIncludedTitle", {
                defaultValue: "Everything LocateFlow does, included",
              })}
            </Text>
            <Text style={styles.includedAccessCopy}>
              {t("settings.subscription_freeIncludedCopy", {
                defaultValue:
                  "You have full access to every LocateFlow feature. There is no subscription, no credit card, and nothing to renew or cancel.",
              })}
            </Text>
          </MoveCard>
        ) : (
          <View style={styles.heroBox}>
            <Crown size={28} color={theme.colors.primary} />
            <Text style={styles.heroTitle}>{t("pricing.title")}</Text>
            <Text style={styles.heroDesc}>
              {t("pricing.subtitle")}
            </Text>
          </View>
        )}

        {visiblePlans.map((plan) => {
          const dynamicPeriod = plan.period;
          const paidPlanKey = isPaidNativePlanKey(plan.key) ? plan.key : null;
          const isCurrentPlan = plan.key === currentPlanKey;
          const isCurrentPaidPlan = Boolean(paidPlanKey) && isCurrentPlan;
          const planHasConfiguredNativeSku = paidPlanKey ? hasConfiguredNativeSku(paidPlanKey) : false;
          const planMonthlySkuAvailable = paidPlanKey ? hasAvailableNativeSku(paidPlanKey, "monthly") : false;
          const planYearlySkuAvailable = paidPlanKey ? hasAvailableNativeSku(paidPlanKey, "yearly") : false;
          const planHasAnyAvailableNativeSku = planMonthlySkuAvailable || planYearlySkuAvailable;
          const planLocalizedMonthlyPrice = paidPlanKey ? getStorePrice(paidPlanKey, "monthly") : null;
          const planLocalizedYearlyPrice = paidPlanKey ? getStorePrice(paidPlanKey, "yearly") : null;
          const annualProcessingKey = paidPlanKey ? nativeProductKey(paidPlanKey, "yearly") : null;
          const monthlyProcessingKey = paidPlanKey ? nativeProductKey(paidPlanKey, "monthly") : null;
          const isProcessingNativePlan = Boolean(
            (annualProcessingKey && processingPlan === annualProcessingKey) ||
            (monthlyProcessingKey && processingPlan === monthlyProcessingKey),
          );
          const canAdvertiseThisMobilePlan =
            !isNativeStorePlatform ||
            !plan.isPaid ||
            (mobileStoreCommerceAdvertisable && planHasAnyAvailableNativeSku);
          // A native paid card supports whichever cycles the store returns.
          // Backend SKU config alone is not enough here: StoreKit/Play may
          // still be propagating or missing a base plan/offer.
          const showNativeCycleActions =
            Boolean(paidPlanKey) &&
            canStartNativePurchase &&
            planHasAnyAvailableNativeSku &&
            (
              !isCurrentPlan ||
              isUnmanagedNativeEligiblePlan ||
              isCurrentPlatformStoreManaged
            );
          const showAnnualAction =
            showNativeCycleActions &&
            planYearlySkuAvailable &&
            !(isCurrentPlatformStoreManaged && currentBillingCycle === "yearly");
          const showMonthlyAction =
            showNativeCycleActions &&
            planMonthlySkuAvailable &&
            !(isCurrentPlatformStoreManaged && currentBillingCycle === "monthly");
          const monthlyDisplayPrice =
            planLocalizedMonthlyPrice ||
            (plan.key === "INDIVIDUAL" ? monthlyOffer?.displayPriceLabel : null) ||
            plan.monthlyPrice;
          const yearlyDisplayPrice =
            planLocalizedYearlyPrice ||
            (plan.key === "INDIVIDUAL" ? annualOffer?.displayPriceLabel : null) ||
            plan.yearlyPrice ||
            "";
          const hideUnavailableMobileCommerce =
            plan.isPaid &&
            isNativeStorePlatform &&
            !canAdvertiseThisMobilePlan &&
            !isCurrentPlan;
          const savingsText = showAnnualAction
            ? computeAnnualSavingsText(yearlyDisplayPrice, monthlyDisplayPrice)
            : null;
          const currentAnnualSavingsText = computeAnnualSavingsText(yearlyDisplayPrice, monthlyDisplayPrice);
          const currentAnnualMonthlyEquivalentText = computeAnnualMonthlyEquivalentText(yearlyDisplayPrice);
          const isCurrentAnnualPaidPlan =
            isCurrentPaidPlan && currentBillingCycle === "yearly";
          const planDisplayName = isCurrentAnnualPaidPlan
            ? `${plan.name} Annual`
            : isCurrentPaidPlan && currentBillingCycle === "monthly"
              ? `${plan.name} Monthly`
              : plan.name;
          const planPriceLabel = isCurrentAnnualPaidPlan && yearlyDisplayPrice
            ? stripBillingPeriod(yearlyDisplayPrice)
            : paidPlanKey && planLocalizedMonthlyPrice
              ? stripBillingPeriod(planLocalizedMonthlyPrice)
              : stripBillingPeriod(plan.price);
          const planPeriodLabel = isCurrentAnnualPaidPlan ? "/year" : dynamicPeriod;
          const currentAnnualValueText = isCurrentAnnualPaidPlan
            ? [
                currentAnnualMonthlyEquivalentText
                  ? `Equivalent to ${currentAnnualMonthlyEquivalentText}`
                  : null,
                currentAnnualSavingsText,
              ].filter(Boolean).join(" · ")
            : null;
          const trialBadge = plan.key === "INDIVIDUAL" && !isCurrentPaidPlan && annualOffer?.trialLabel
            ? `First ${annualOffer.trialLabel} free`
            : plan.key === "INDIVIDUAL" && !isCurrentPaidPlan && annualOffer?.trialDays
              ? `First ${annualOffer.trialDays} days free`
              : null;
          const emphasizeAnnualBilledPrice = shouldEmphasizeAnnualBilledPrice({
            showAnnualAction,
            yearlyDisplayPrice,
            trialBadge,
            savingsText,
          });
          const annualActionLabels = getAnnualActionLabels({
            yearlyDisplayPrice,
            isSwitching: isCurrentPlatformStoreManaged && currentBillingCycle === "monthly",
            trialBadge,
            startLabel: t("settings.subscription_startAnnual", { defaultValue: "Start annual" }),
            switchLabel: t("settings.subscription_switchAnnual", { defaultValue: "Switch to annual" }),
          });
          const annualButtonLabel = annualActionLabels.buttonLabel;
          const annualMetaText = annualActionLabels.metaText;
          const monthlyButtonLabel =
            isCurrentPlatformStoreManaged && currentBillingCycle === "yearly"
              ? `Switch to monthly · ${monthlyDisplayPrice}`
              : `${t("settings.subscription_subscribeMonthly")} · ${monthlyDisplayPrice}`;
          const displayedPlanPriceLabel = emphasizeAnnualBilledPrice && yearlyDisplayPrice
            ? stripBillingPeriod(yearlyDisplayPrice)
            : planPriceLabel;
          const displayedPlanPeriodLabel = emphasizeAnnualBilledPrice ? "/year" : planPeriodLabel;
          return (
          <MoveCard
            key={plan.key}
            accent={plan.key === currentPlanKey}
            style={{ marginTop: 14 }}
            padding={18}
            radius={20}
          >
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{planDisplayName}</Text>
                  {plan.key === currentPlanKey && <Pill label={t("pricing.cta_current")} tone="success" />}
                </View>
                {!hideUnavailableMobileCommerce ? (
                  <>
                    <Text style={styles.planPrice}>
                      {displayedPlanPriceLabel}
                      <Text style={styles.planPeriod}> {displayedPlanPeriodLabel}</Text>
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
                  <Check size={14} color={theme.colors.success} />
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
                      activeOpacity={0.85}
                      onPress={() => paidPlanKey && handleUpgrade(paidPlanKey, "yearly")}
                      disabled={processingPlan === annualProcessingKey}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.subscription_a11yUpgradeAnnualPlan", {
                        plan: plan.name,
                        defaultValue: "Start annual {{plan}} plan",
                      })}
                      accessibilityState={{ disabled: processingPlan === annualProcessingKey }}
                    >
                      <LinearGradient
                        colors={theme.colors.gradient.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                      {processingPlan === annualProcessingKey ? (
                        <ActivityIndicator color={theme.colors.onAccent} />
                      ) : (
                        <>
                          <Zap size={16} color={theme.colors.onAccent} />
                          <Text style={styles.upgradeBtnText}>{annualButtonLabel}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <View style={styles.annualMetaRow}>
                      {annualMetaText ? (
                        <Text style={styles.annualMetaText}>{annualMetaText}</Text>
                      ) : null}
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
                    onPress={() => paidPlanKey && handleUpgrade(paidPlanKey, "monthly")}
                    disabled={processingPlan === monthlyProcessingKey}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.subscription_a11yUpgradeMonthlyPlan", {
                      plan: plan.name,
                      defaultValue: "Start monthly {{plan}} plan",
                    })}
                    accessibilityState={{ disabled: processingPlan === monthlyProcessingKey }}
                  >
                    {processingPlan === monthlyProcessingKey ? (
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
            ) : (plan.key === "FAMILY" || plan.key === "PRO") && !isNativeStorePlatform ? (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.85}
                onPress={() => openWebUrl(`${APP_WEB_URL}/pricing#family-pro`)}
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_a11yUpgradeWeb", {
                  plan: plan.name,
                  defaultValue: `Upgrade to ${plan.name} on the web`,
                })}
              >
                <LinearGradient
                  colors={theme.colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <ExternalLink size={16} color={theme.colors.onAccent} />
                <Text style={styles.upgradeBtnText}>
                  {t("settings.subscription_upgradeOnWeb", { defaultValue: "Upgrade on the web" })}
                </Text>
              </TouchableOpacity>
            ) : paidPlanKey && isNativeStorePlatform && managedSubscriptionBlocksPurchase ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>{managedElsewherePlanCardMessage}</Text>
              </View>
            ) : paidPlanKey && isNativeStorePlatform && !planHasConfiguredNativeSku ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>
                  {plan.key === "FAMILY" || plan.key === "PRO"
                    ? t("settings.subscription_familyProNativeReadOnly", {
                        defaultValue:
                          "Family and Pro access appears here automatically when it is active on your account. Mobile purchases currently use the Individual plan through the app store.",
                      })
                    : nativePurchaseUnavailableMessage}
                </Text>
              </View>
            ) : paidPlanKey && isNativeStorePlatform && !planHasAnyAvailableNativeSku ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>{nativePurchaseUnavailableMessage}</Text>
              </View>
            ) : isNativeStorePlatform && !canStartNativePurchase ? (
              <View style={styles.disabledPurchaseNotice}>
                <Text style={styles.disabledPurchaseText}>{nativePurchaseUnavailableMessage}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.85}
                onPress={() => paidPlanKey && handleUpgrade(paidPlanKey)}
                disabled={!paidPlanKey || isProcessingNativePlan}
                accessibilityRole="button"
                accessibilityLabel={t("settings.subscription_a11yUpgrade", { plan: plan.name })}
                accessibilityHint={t("settings.subscription_a11yUpgradeHint")}
                accessibilityState={{
                  disabled: !paidPlanKey || isProcessingNativePlan,
                }}
              >
                <LinearGradient
                  colors={theme.colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {isProcessingNativePlan ? (
                  <ActivityIndicator color={theme.colors.onAccent} />
                ) : (
                  <>
                    <Zap size={16} color={theme.colors.onAccent} />
                    <Text style={styles.upgradeBtnText}>{t("pricing.cta_upgrade")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </MoveCard>
          );
        })}
        {canUseNativePurchases && !managedSubscriptionBlocksPurchase && !showConsumerFreePanel && (
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

        {!showConsumerFreePanel ? (
          <>
        <SectionHeader
          label={t("settings.subscription_compareTitle", { defaultValue: "What you get with each plan" })}
          style={styles.compareSectionHeader}
        />
        <MoveCard style={styles.compareCard} padding={16} radius={18}>
          <Text style={styles.compareSubtitle}>
            {t("settings.subscription_compareSubtitle", { defaultValue: "Tap a plan to see everything it includes." })}
          </Text>
          {planComparison.map((entry) => {
            const expanded = expandedComparePlan === null
              ? entry.isCurrent
              : expandedComparePlan === entry.key;
            return (
              <View key={entry.key} style={styles.compareSection}>
                <TouchableOpacity
                  style={styles.compareHeader}
                  activeOpacity={0.7}
                  onPress={() => setExpandedComparePlan(expanded ? "" : entry.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.subscription_a11yComparePlan", {
                    plan: entry.name,
                    defaultValue: "{{plan}} plan features",
                  })}
                  accessibilityHint={t("settings.subscription_a11yComparePlanHint", {
                    defaultValue: "Expands or collapses this plan's feature list",
                  })}
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.compareHeaderLeft}>
                    <Text style={styles.comparePlanName}>{entry.name}</Text>
                    {entry.isCurrent ? (
                      <Pill label={t("pricing.cta_current")} tone="success" />
                    ) : null}
                  </View>
                  <View style={styles.compareHeaderRight}>
                    {entry.priceLabel ? (
                      <Text style={styles.comparePlanPrice}>{entry.priceLabel}</Text>
                    ) : null}
                    {expanded ? (
                      <ChevronUp size={16} color={theme.colors.textTertiary} />
                    ) : (
                      <ChevronDown size={16} color={theme.colors.textTertiary} />
                    )}
                  </View>
                </TouchableOpacity>
                {expanded ? (
                  <View style={styles.compareFeatureList}>
                    <Text style={styles.compareDescription}>{entry.shortDescription}</Text>
                    {entry.features.map((f) => (
                      <View key={f.key} style={styles.planFeatureRow}>
                        <Check size={14} color={planAccentColor(resolvedScheme, entry.key)} />
                        <Text style={styles.planFeatureText}>
                          {t(`settings.${f.key}`, { value: f.value })}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </MoveCard>
          </>
        ) : null}

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
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: fonts.sans, color: theme.colors.faint },
  loadErrorCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorFaded,
    padding: 12,
    marginBottom: 12,
  },
  loadErrorText: { color: theme.colors.error, fontFamily: fonts.sansBold, fontSize: 13 },
  currentPlanCard: { marginBottom: 2 },
  currentPlanTop: { flexDirection: "row", alignItems: "center" },
  currentPlanLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  currentPlanIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  currentPlanTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  currentPlanTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.text },
  currentPlanMeta: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3 },
  currentPlanStatusRow: { flexDirection: "row", marginTop: 12 },
  planFeaturesCard: {
    marginTop: 12,
    gap: 8,
  },
  planFeaturesTitle: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text, marginBottom: 2 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, flex: 1 },
  mobileBillingNotice: {
    marginTop: 12,
  },
  mobileBillingNoticeText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
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
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSoft,
  },
  openWebBillingBtnText: {
    fontSize: 13,
    fontFamily: fonts.sansSemibold,
    color: theme.colors.primary,
  },
  includedAccessCard: {
    marginTop: 16,
    gap: 8,
  },
  includedAccessEyebrow: {
    fontSize: 11,
    fontFamily: fonts.sansBold,
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  includedAccessTitle: { fontSize: 18, fontFamily: fonts.serifBold, color: theme.colors.text },
  includedAccessCopy: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: theme.colors.dim },
  heroBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text },
  heroDesc: { fontSize: 14, fontFamily: fonts.sans, color: theme.colors.dim, textAlign: "center", maxWidth: 280 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 18, fontFamily: fonts.serifBold, color: theme.colors.text },
  planPrice: { fontSize: 28, fontFamily: fonts.serifBlack, color: theme.colors.text, marginTop: 4 },
  planPeriod: { fontSize: 14, fontFamily: fonts.sans, color: theme.colors.faint },
  currentAnnualValueText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.sansSemibold,
    color: theme.colors.success,
    marginTop: 4,
  },
  featureList: { marginTop: 16, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim },
  disabledPurchaseNotice: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  disabledPurchaseText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.sansMedium,
    color: theme.colors.dim,
    textAlign: "center",
  },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: theme.radius.lg, overflow: "hidden",
    paddingVertical: 14, marginTop: 16,
  },
  manageBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSoft,
    paddingVertical: 14,
    marginTop: 16,
  },
  manageBtnText: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
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
  currentBtnText: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.faint },
  upgradeBtnText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
  splitCtaWrap: { marginTop: 16, gap: 10 },
  annualMetaRow: { gap: 2 },
  annualMetaText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, textAlign: "center" },
  savingsText: { fontSize: 12, fontFamily: fonts.sansSemibold, color: theme.colors.success, textAlign: "center" },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
  legalCopy: {
    fontSize: 11,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 4,
  },
  compareSectionHeader: { marginTop: 26, marginBottom: 9, marginLeft: 2 },
  compareCard: {},
  compareSubtitle: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginBottom: 4 },
  compareSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12,
    paddingTop: 12,
  },
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  compareHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  compareHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  comparePlanName: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  comparePlanPrice: {
    fontSize: 12,
    fontFamily: fonts.monoMedium,
    color: theme.colors.dim,
    flexShrink: 1,
    textAlign: "right",
  },
  compareFeatureList: { marginTop: 10, gap: 8 },
  compareDescription: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, lineHeight: 17 },
  restoreBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    marginTop: 16,
  },
  restoreBtnText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
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
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  legalLinkText: { fontSize: 12, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
  footer: {
    textAlign: "center", fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 24,
  },
});

export default LegacySubscriptionScreen;
