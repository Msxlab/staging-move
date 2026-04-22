/**
 * GET /api/mobile/iap/products
 *
 * Tells the mobile client which product IDs to load from StoreKit / Play Billing
 * for each paid plan, plus whether the IAP integration is wired up at all.
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
  const [iosIndividual, androidIndividual] = await Promise.all([
    getRuntimeConfigValue("MOBILE_IOS_PRODUCT_INDIVIDUAL"),
    getRuntimeConfigValue("MOBILE_ANDROID_PRODUCT_INDIVIDUAL"),
  ]);

  return NextResponse.json({
    ios: {
      available: Boolean(iosIndividual),
      plans: {
        INDIVIDUAL: iosIndividual || null,
      },
    },
    android: {
      available: Boolean(androidIndividual),
      plans: {
        INDIVIDUAL: androidIndividual || null,
      },
    },
  });
}
