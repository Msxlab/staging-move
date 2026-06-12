import { describe, expect, it, vi } from "vitest";

// Mock @/lib/db so importing the helper (which pulls in the runtime-config
// loader) doesn't require a real Prisma client instance.
vi.mock("@/lib/db", () => ({
  prisma: { runtimeConfigEntry: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/shared-encryption", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ""),
}));

import {
  buildGooglePlayBillingStatus,
  buildIntegrationStatus,
  buildIntegrations,
} from "@/lib/integration-status";
import type { RuntimeConfigCatalogItem } from "@/lib/runtime-config";

function catalogMap(configuredKeys: string[]): Map<string, RuntimeConfigCatalogItem> {
  return new Map(
    configuredKeys.map((key) => [
      key,
      { key, configured: true } as RuntimeConfigCatalogItem,
    ]),
  );
}

describe("buildIntegrationStatus", () => {
  it("is configured when every key is present", () => {
    const status = buildIntegrationStatus(
      catalogMap(["A", "B"]),
      "test",
      "Test",
      ["A", "B"],
    );
    expect(status).toEqual({
      id: "test",
      label: "Test",
      configured: true,
      missingKeys: [],
    });
  });

  it("lists missing key names (never values) when unconfigured", () => {
    const status = buildIntegrationStatus(catalogMap(["A"]), "test", "Test", [
      "A",
      "B",
      "C",
    ]);
    expect(status.configured).toBe(false);
    expect(status.missingKeys).toEqual(["B", "C"]);
  });
});

describe("buildGooglePlayBillingStatus", () => {
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

  it("accepts service-account auth without OAuth", () => {
    const status = buildGooglePlayBillingStatus(
      catalogMap([
        ...baseKeys,
        "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
      ]),
    );
    expect(status.configured).toBe(true);
  });

  it("accepts OAuth auth without a service account", () => {
    const status = buildGooglePlayBillingStatus(
      catalogMap([
        ...baseKeys,
        "GOOGLE_PLAY_OAUTH_CLIENT_ID",
        "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
      ]),
    );
    expect(status.configured).toBe(true);
  });

  it("reports both auth paths missing when neither is complete", () => {
    const status = buildGooglePlayBillingStatus(catalogMap(baseKeys));
    expect(status.configured).toBe(false);
    expect(status.missingKeys).toEqual([
      "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_PLAY_OAUTH_CLIENT_ID",
      "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
    ]);
  });
});

describe("buildIntegrations", () => {
  it("returns the full settings-route integration list in stable order", () => {
    const integrations = buildIntegrations(catalogMap([]));
    expect(integrations.map((item) => item.id)).toEqual([
      "google_oauth",
      "apple_oauth",
      "stripe",
      "resend",
      "google_maps",
      "mobile_app_store",
      "mobile_play",
      "backup_storage",
      "redis",
      "fcc_broadband",
      "electric_utility",
      "census_acs",
      "airnow",
      "anthropic_ai",
      "fmcsa",
      "address_connectors",
      "mover_registration",
    ]);
    // Nothing in the payload beyond id/label/configured/missingKeys — no
    // uptime, latency, or key values.
    for (const item of integrations) {
      expect(Object.keys(item).sort()).toEqual([
        "configured",
        "id",
        "label",
        "missingKeys",
      ]);
    }
  });

  it("requires the FCC username with the FCC BDC key for configured serviceability", () => {
    const integrations = buildIntegrations(catalogMap(["FCC_BDC_ENABLED", "FCC_BDC_API_KEY"]));
    const fcc = integrations.find((item) => item.id === "fcc_broadband");
    expect(fcc?.configured).toBe(false);
    expect(fcc?.missingKeys).toEqual(["FCC_BDC_USERNAME"]);
  });
});
