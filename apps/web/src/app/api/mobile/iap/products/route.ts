/**
 * GET /api/mobile/iap/products
 *
 * Tells the mobile client which product IDs to load from StoreKit / Play Billing
 * for each paid plan + cycle, plus whether the IAP integration is wired up.
 *
 * Response shape (additive — `plans.INDIVIDUAL` is preserved for older clients):
 *
 *   {
 *     ios: {
 *       available: boolean,                 // monthly is available
 *       plans: {
 *         INDIVIDUAL: string|null,          // monthly SKU (legacy alias)
 *         INDIVIDUAL_MONTHLY: string|null,
 *         INDIVIDUAL_YEARLY:  string|null,
 *       },
 *     },
 *     android: { ... same shape ... },
 *   }
 *
 * No auth — product IDs are public (they're compiled into the app binary too).
 * The endpoint just centralizes the mapping so ops can rotate SKUs without a
 * mobile rebuild.
 */

import { NextResponse } from "next/server";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [iosMonthly, iosYearly, androidMonthly, androidYearly] = await Promise.all([
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_INDIVIDUAL"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_INDIVIDUAL"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY"),
  ]);

  return NextResponse.json({
    ios: {
      // `available` mirrors the legacy contract: monthly must be configured
      // for the platform to be considered usable. The yearly SKU is purely
      // additive — older mobile builds that ignore INDIVIDUAL_YEARLY keep
      // working unchanged.
      available: Boolean(iosMonthly),
      plans: {
        INDIVIDUAL: iosMonthly || null,
        INDIVIDUAL_MONTHLY: iosMonthly || null,
        INDIVIDUAL_YEARLY: iosYearly || null,
      },
    },
    android: {
      available: Boolean(androidMonthly),
      plans: {
        INDIVIDUAL: androidMonthly || null,
        INDIVIDUAL_MONTHLY: androidMonthly || null,
        INDIVIDUAL_YEARLY: androidYearly || null,
      },
    },
  });
}
