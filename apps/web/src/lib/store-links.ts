/**
 * Canonical LocateFlow native app-store URLs.
 *
 * LocateFlow is LIVE on both stores (iOS: id6771878736, Android:
 * com.locateflow.mobile). These are the single source of truth for the
 * marketing CTA, the smart install banner, and any structured data — so they
 * never drift. An env override lets ops swap a listing (e.g. a regional store
 * or a redirect) without a code change.
 */
export const IOS_APP_STORE_URL =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ||
  "https://apps.apple.com/us/app/locateflow/id6771878736";

export const ANDROID_PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ||
  "https://play.google.com/store/apps/details?id=com.locateflow.mobile";
