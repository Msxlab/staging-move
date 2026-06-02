/**
 * GET /api/mobile/iap/products
 *
 * Tells the mobile client which product IDs to load from StoreKit / Play Billing
 * for each paid plan + cycle, plus whether the IAP integration is wired up.
 *
 * Product IDs are public. The endpoint centralizes the mapping so ops can add
 * Family/Pro store SKUs without a mobile rebuild. Legacy `plans.INDIVIDUAL`
 * remains the Individual monthly alias for older builds.
 */

import { NextResponse } from "next/server";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [
    iosMonthly,
    iosYearly,
    iosFamilyMonthly,
    iosFamilyYearly,
    iosProMonthly,
    iosProYearly,
    androidMonthly,
    androidYearly,
    androidFamilyMonthly,
    androidFamilyYearly,
    androidProMonthly,
    androidProYearly,
  ] = await Promise.all([
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_INDIVIDUAL"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_FAMILY"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_FAMILY_YEARLY"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_PRO"),
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_PRO_YEARLY"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_INDIVIDUAL"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_FAMILY"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_FAMILY_YEARLY"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_PRO"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_PRO_YEARLY"),
  ]);

  return NextResponse.json({
    ios: {
      available: Boolean(
        iosMonthly || iosYearly || iosFamilyMonthly || iosFamilyYearly || iosProMonthly || iosProYearly,
      ),
      plans: {
        INDIVIDUAL: iosMonthly || null,
        INDIVIDUAL_MONTHLY: iosMonthly || null,
        INDIVIDUAL_YEARLY: iosYearly || null,
        FAMILY: iosFamilyMonthly || null,
        FAMILY_MONTHLY: iosFamilyMonthly || null,
        FAMILY_YEARLY: iosFamilyYearly || null,
        PRO: iosProMonthly || null,
        PRO_MONTHLY: iosProMonthly || null,
        PRO_YEARLY: iosProYearly || null,
      },
    },
    android: {
      available: Boolean(
        androidMonthly || androidYearly || androidFamilyMonthly || androidFamilyYearly || androidProMonthly || androidProYearly,
      ),
      plans: {
        INDIVIDUAL: androidMonthly || null,
        INDIVIDUAL_MONTHLY: androidMonthly || null,
        INDIVIDUAL_YEARLY: androidYearly || null,
        FAMILY: androidFamilyMonthly || null,
        FAMILY_MONTHLY: androidFamilyMonthly || null,
        FAMILY_YEARLY: androidFamilyYearly || null,
        PRO: androidProMonthly || null,
        PRO_MONTHLY: androidProMonthly || null,
        PRO_YEARLY: androidProYearly || null,
      },
    },
  });
}
