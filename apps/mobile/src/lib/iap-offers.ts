export type BillingCycle = "monthly" | "yearly";

export type AndroidSubscriptionOffer = {
  basePlanId: string | null;
  offerId: string | null;
  offerToken: string;
  billingPeriods: string[];
  formattedPrice: string | null;
};

export type SubscriptionProduct = {
  id: string;
  title: string;
  description: string;
  displayPrice: string;
  price?: number;
  currency?: string;
  androidOffers: AndroidSubscriptionOffer[];
  offerToken?: string;
  basePlanId?: string | null;
  offerId?: string | null;
};

export const IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE =
  "IAP_ANDROID_OFFER_TOKEN_MISSING";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getPricingPhaseList(offer: any): any[] {
  const list = offer?.pricingPhases?.pricingPhaseList;
  return Array.isArray(list) ? list : [];
}

function normalizeAndroidOffers(product: any): AndroidSubscriptionOffer[] {
  const rawOffers = product?.subscriptionOfferDetailsAndroid || product?.subscriptionOfferDetails;
  if (!Array.isArray(rawOffers)) return [];

  return rawOffers
    .map((offer: any): AndroidSubscriptionOffer | null => {
      const offerToken = asString(offer?.offerToken);
      if (!offerToken) return null;

      const phases = getPricingPhaseList(offer);
      const billingPeriods = phases
        .map((phase) => asString(phase?.billingPeriod))
        .filter((period): period is string => Boolean(period));
      const formattedPrice =
        phases
          .map((phase) => asString(phase?.formattedPrice))
          .find((price): price is string => Boolean(price)) || null;

      return {
        basePlanId: asString(offer?.basePlanId),
        offerId: asString(offer?.offerId),
        offerToken,
        billingPeriods,
        formattedPrice,
      };
    })
    .filter((offer): offer is AndroidSubscriptionOffer => Boolean(offer));
}

export function selectAndroidSubscriptionOffer(
  product: Pick<SubscriptionProduct, "androidOffers"> | null | undefined,
  cycle: BillingCycle,
): AndroidSubscriptionOffer | null {
  const offers = product?.androidOffers || [];
  if (offers.length === 0) return null;

  const targetPeriod = cycle === "yearly" ? "P1Y" : "P1M";
  return offers.find((offer) => offer.billingPeriods.includes(targetPeriod)) || offers[0] || null;
}

export function normalizeSubscriptionProduct(product: any): SubscriptionProduct {
  const androidOffers = normalizeAndroidOffers(product);
  const defaultOffer = androidOffers[0] || null;
  const displayPrice =
    asString(product?.displayPrice) ||
    asString(product?.localizedPrice) ||
    defaultOffer?.formattedPrice ||
    (product?.price != null ? String(product.price) : "");

  return {
    id: String(product?.id ?? product?.productId ?? ""),
    title: String(product?.title ?? product?.name ?? ""),
    description: String(product?.description ?? ""),
    displayPrice,
    price: typeof product?.price === "number" ? product.price : undefined,
    currency:
      typeof product?.currency === "string"
        ? product.currency
        : typeof product?.currencyCode === "string"
          ? product.currencyCode
          : undefined,
    androidOffers,
    offerToken: defaultOffer?.offerToken,
    basePlanId: defaultOffer?.basePlanId,
    offerId: defaultOffer?.offerId,
  };
}

export function buildSubscriptionPurchaseRequest(opts: {
  platform: "ios" | "android";
  productId: string;
  offerToken?: string | null;
  /**
   * Per-user IAP account token (audit fix 1.1 — receipt↔account binding).
   * Derived deterministically from the authed userId via
   * `deriveIapAccountToken` (iOS, a UUID) / `deriveObfuscatedAccountId`
   * (Android). ADDITIVE: when absent the request is byte-for-byte the same as
   * before, so older flows and any unauthenticated edge case are unaffected.
   * The store echoes this back inside the verified receipt and the server
   * recomputes + matches it.
   */
  accountToken?: string | null;
}) {
  if (opts.platform === "ios") {
    // StoreKit2 requires appAccountToken to be a UUID; deriveIapAccountToken
    // already returns one. Only attach when present.
    const ios: Record<string, unknown> = { sku: opts.productId };
    if (opts.accountToken) ios.appAccountToken = opts.accountToken;
    return {
      request: { ios },
      type: "subs" as const,
    };
  }

  if (!opts.offerToken) {
    throw new Error(IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE);
  }

  const android: Record<string, unknown> = {
    skus: [opts.productId],
    subscriptionOffers: [{ sku: opts.productId, offerToken: opts.offerToken }],
  };
  if (opts.accountToken) android.obfuscatedAccountIdAndroid = opts.accountToken;

  return {
    request: { android },
    type: "subs" as const,
  };
}

