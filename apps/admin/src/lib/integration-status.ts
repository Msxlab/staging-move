/**
 * Integration configuration status — shared server helper.
 *
 * Single source of truth for the "which external integrations are
 * configured" list. Extracted from /api/settings (GET) so the dashboard's
 * "External integrations" card and the settings route render the exact same
 * statuses without an HTTP self-call.
 *
 * HONESTY CONTRACT: `configured` means "every required key/flag is present
 * in the runtime-config catalog" — nothing more. We do not measure uptime
 * or latency anywhere, so no consumer may present these statuses as health
 * or availability metrics. Key NAMES are listed for operators; key VALUES
 * never leave the runtime-config layer.
 */

import {
  listRuntimeConfigCatalog,
  type RuntimeConfigCatalogItem,
} from "@/lib/runtime-config";

export interface IntegrationStatus {
  id: string;
  label: string;
  /** True when every required key/flag for this integration is set. */
  configured: boolean;
  /** Names (never values) of the keys still missing. */
  missingKeys: string[];
}

export function buildIntegrationStatus(
  catalogMap: Map<string, RuntimeConfigCatalogItem>,
  id: string,
  label: string,
  keys: string[],
): IntegrationStatus {
  const missingKeys = keys.filter((key) => !catalogMap.get(key)?.configured);
  return {
    id,
    label,
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

export function buildGooglePlayBillingStatus(
  catalogMap: Map<string, RuntimeConfigCatalogItem>,
): IntegrationStatus {
  const baseKeys = [
    "GOOGLE_PLAY_PACKAGE_NAME",
    "GOOGLE_PLAY_RTDN_AUDIENCE",
    "MOBILE_ANDROID_PRODUCT_INDIVIDUAL",
    "MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY",
    "MOBILE_ANDROID_PRODUCT_FAMILY",
    "MOBILE_ANDROID_PRODUCT_FAMILY_YEARLY",
    "MOBILE_ANDROID_PRODUCT_PRO",
    "MOBILE_ANDROID_PRODUCT_PRO_YEARLY",
  ];
  const serviceAccountKeys = [
    "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
  ];
  const oauthKeys = [
    "GOOGLE_PLAY_OAUTH_CLIENT_ID",
    "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
  ];

  const missingBaseKeys = baseKeys.filter((key) => !catalogMap.get(key)?.configured);
  const missingServiceAccountKeys = serviceAccountKeys.filter((key) => !catalogMap.get(key)?.configured);
  const missingOAuthKeys = oauthKeys.filter((key) => !catalogMap.get(key)?.configured);
  const hasApiAuth = missingServiceAccountKeys.length === 0 || missingOAuthKeys.length === 0;
  const missingKeys = [
    ...missingBaseKeys,
    ...(hasApiAuth ? [] : [...missingServiceAccountKeys, ...missingOAuthKeys]),
  ];

  return {
    id: "mobile_play",
    label: "Google Play Billing",
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

/**
 * Full integration list in display order — identical to what the settings
 * route has always returned. Pure function of the catalog map so callers
 * that already loaded the catalog (the settings route) reuse it for free.
 */
export function buildIntegrations(
  catalogMap: Map<string, RuntimeConfigCatalogItem>,
): IntegrationStatus[] {
  return [
    buildIntegrationStatus(catalogMap, "google_oauth", "Google OAuth", [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
    ]),
    buildIntegrationStatus(catalogMap, "apple_oauth", "Apple OAuth", [
      "APPLE_OAUTH_CLIENT_ID",
      "APPLE_OAUTH_TEAM_ID",
      "APPLE_OAUTH_KEY_ID",
      "APPLE_OAUTH_PRIVATE_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "stripe", "Stripe Billing", [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
      "STRIPE_PRICE_INDIVIDUAL_YEARLY",
      "STRIPE_PRICE_FAMILY_MONTHLY",
      "STRIPE_PRICE_FAMILY_YEARLY",
      "STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PRO_YEARLY",
    ]),
    buildIntegrationStatus(catalogMap, "resend", "Transactional Email", [
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ]),
    buildIntegrationStatus(catalogMap, "google_maps", "Google Maps", [
      "GOOGLE_MAPS_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "mobile_app_store", "Apple Mobile Billing", [
      "APPLE_BUNDLE_ID",
      "APPLE_APP_STORE_ISSUER_ID",
      "APPLE_APP_STORE_KEY_ID",
      "APPLE_APP_STORE_PRIVATE_KEY",
      "MOBILE_IOS_PRODUCT_INDIVIDUAL",
      "MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY",
      "MOBILE_IOS_PRODUCT_FAMILY",
      "MOBILE_IOS_PRODUCT_FAMILY_YEARLY",
      "MOBILE_IOS_PRODUCT_PRO",
      "MOBILE_IOS_PRODUCT_PRO_YEARLY",
    ]),
    buildGooglePlayBillingStatus(catalogMap),
    buildIntegrationStatus(catalogMap, "backup_storage", "Encrypted Backup Storage", [
      "BACKUP_STORAGE_PROVIDER",
      "BACKUP_STORAGE_BUCKET",
      "BACKUP_STORAGE_REGION",
      "BACKUP_STORAGE_ACCESS_KEY_ID",
      "BACKUP_STORAGE_SECRET_ACCESS_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "redis", "Rate Limit Redis", [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]),
    // ── Data integrations (address coverage · neighborhood · AI · movers) ──
    // Each degrades gracefully when its key/flag is unset; surfacing them here
    // means the owner can see which are actually live instead of guessing why
    // a dossier section is empty. "configured" = the listed key(s)/flag(s) are
    // present (a flag explicitly set to "false" still reads as present).
    buildIntegrationStatus(catalogMap, "fcc_broadband", "FCC Broadband — ISP availability", [
      "FCC_BDC_ENABLED",
      "FCC_BDC_API_KEY",
      "FCC_BDC_USERNAME",
    ]),
    buildIntegrationStatus(catalogMap, "electric_utility", "Electric Utility — OpenEI URDB", [
      "ELECTRIC_LOOKUP_ENABLED",
      "OPENEI_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "census_acs", "Neighborhood economics — Census ACS", [
      "CENSUS_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "airnow", "Air quality — AirNow", [
      "AIRNOW_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "hud_housing", "Housing context - HUD User", [
      "HUD_HOUSING_DATA_ENABLED",
      "HUD_USER_API_TOKEN",
    ]),
    buildIntegrationStatus(catalogMap, "ev_charging", "EV charging - NLR Alternative Fuel Stations", [
      "NLR_ALT_FUEL_STATIONS_ENABLED",
      "NLR_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "anthropic_ai", "AI move briefing — Anthropic", [
      "ANTHROPIC_API_KEY",
    ]),
    buildIntegrationStatus(catalogMap, "fmcsa", "Mover verification — FMCSA QCMobile", [
      "FMCSA_WEBKEY",
    ]),
    buildIntegrationStatus(catalogMap, "address_connectors", "Address-change connectors", [
      "FEATURE_API_CONNECTORS",
    ]),
    buildIntegrationStatus(catalogMap, "mover_registration", "Public mover registration", [
      "MOVER_REGISTRATION_ENABLED",
    ]),
  ];
}

/**
 * Convenience loader for callers that don't already hold the runtime-config
 * catalog (the dashboard page). One bounded DB read via the catalog list.
 */
export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const catalog = await listRuntimeConfigCatalog();
  const catalogMap = new Map<string, RuntimeConfigCatalogItem>(
    catalog.map((item: RuntimeConfigCatalogItem) => [item.key, item]),
  );
  return buildIntegrations(catalogMap);
}
