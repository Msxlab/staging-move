import { describe, expect, it } from "vitest";
import {
  ENV_FIRST_RUNTIME_CONFIG_KEYS,
  STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG,
  getRuntimeConfigDefinition,
  getRuntimeConfigEnvValue,
  isManagedRuntimeConfigKey,
  isRuntimeConfigDbBackedKeyAllowed,
  isRuntimeConfigDbOverrideEnabled,
  maskRuntimeConfigValue,
  RUNTIME_CONFIG_DEFINITIONS,
  validateRuntimeConfigValueShape,
  resolveRuntimeConfigResolution,
  shouldPreferEnvRuntimeConfigValue,
} from "../runtime-config";

describe("shouldPreferEnvRuntimeConfigValue", () => {
  it("prefers env for the historical Stripe + APP_URL allowlist", () => {
    for (const key of ENV_FIRST_RUNTIME_CONFIG_KEYS) {
      expect(shouldPreferEnvRuntimeConfigValue(key, {})).toBe(true);
    }
  });

  it("prefers env for every other managed key (RESEND_API_KEY, R2_*, BACKUP_*, UPSTASH_*)", () => {
    const sample = [
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "ALERT_EMAIL_TO",
      "GOOGLE_MAPS_API_KEY",
      "R2_BUCKET",
      "R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "BACKUP_STORAGE_BUCKET",
      "BACKUP_STORAGE_SECRET_ACCESS_KEY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "FIELD_ENCRYPTION_KEY",
      "CRON_SECRET",
      "INTERNAL_WEBHOOK_SECRET",
      "IMPERSONATION_HANDOFF_SECRET",
    ];
    for (const key of sample) {
      expect(shouldPreferEnvRuntimeConfigValue(key, {})).toBe(true);
    }
  });

  it("flips DB-first only for the Stripe bundle when the override flag is enabled", () => {
    const env = { [STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]: "true" };
    expect(shouldPreferEnvRuntimeConfigValue("STRIPE_SECRET_KEY", env)).toBe(false);
    expect(shouldPreferEnvRuntimeConfigValue("STRIPE_WEBHOOK_SECRET", env)).toBe(false);
  });

  it("ignores the override flag for non-Stripe managed keys (RESEND_API_KEY stays env-first)", () => {
    const env = { [STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]: "true" };
    // Even with override flag on, runtime-tunable keys outside the
    // Stripe bundle stay env-first by default — flipping precedence
    // for a Stripe rotation must not silently leak DB values onto
    // production secrets like RESEND_API_KEY.
    expect(shouldPreferEnvRuntimeConfigValue("RESEND_API_KEY", env)).toBe(true);
    expect(shouldPreferEnvRuntimeConfigValue("UPSTASH_REDIS_REST_TOKEN", env)).toBe(true);
  });

  it("treats the override flag as off when set to anything but 'true'", () => {
    expect(isRuntimeConfigDbOverrideEnabled({})).toBe(false);
    expect(isRuntimeConfigDbOverrideEnabled({ [STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]: "false" })).toBe(false);
    expect(isRuntimeConfigDbOverrideEnabled({ [STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]: "1" })).toBe(false);
    expect(isRuntimeConfigDbOverrideEnabled({ [STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]: "TRUE" })).toBe(true);
  });
});

describe("getRuntimeConfigEnvValue", () => {
  it("returns null when the env is unset", () => {
    expect(getRuntimeConfigEnvValue("RESEND_API_KEY", {})).toBeNull();
  });

  it("does not use the public browser Maps key as the server-side Maps key", () => {
    expect(
      getRuntimeConfigEnvValue("GOOGLE_MAPS_API_KEY", {
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaPublic",
      }),
    ).toBeNull();
    expect(
      getRuntimeConfigEnvValue("GOOGLE_MAPS_API_KEY", {
        GOOGLE_MAPS_API_KEY: "AIzaPrivate",
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaPublic",
      }),
    ).toBe("AIzaPrivate");
  });
});

describe("maskRuntimeConfigValue", () => {
  it("masks secret values without leaking the raw payload", () => {
    const masked = maskRuntimeConfigValue("re_abcdef0123456789xyz", "secret");
    expect(masked).not.toContain("abcdef");
    expect(masked).not.toContain("0123456789");
  });

  it("returns plain values unchanged for the plain strategy", () => {
    expect(maskRuntimeConfigValue("hello", "plain")).toBe("hello");
  });

  it("preserves email domain while masking the local-part", () => {
    expect(maskRuntimeConfigValue("alerts@example.com", "email")).toBe("al***@example.com");
  });

  it("returns just protocol+host for url strategy", () => {
    expect(maskRuntimeConfigValue("https://api.example.com/path?token=abc", "url")).toBe(
      "https://api.example.com",
    );
  });
});

describe("RUNTIME_CONFIG_DEFINITIONS catalog hygiene", () => {
  it("has a definition for every key present in DigitalOcean env", () => {
    const observed = [
      "DATABASE_URL",
      "USER_JWT_SECRET",
      "ADMIN_JWT_SECRET",
      "FIELD_ENCRYPTION_KEY",
      "CRON_SECRET",
      "INTERNAL_WEBHOOK_SECRET",
      "IMPERSONATION_HANDOFF_SECRET",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "BACKUP_STORAGE_PROVIDER",
      "BACKUP_STORAGE_BUCKET",
      "BACKUP_STORAGE_REGION",
      "BACKUP_STORAGE_ENDPOINT",
      "BACKUP_STORAGE_ACCESS_KEY_ID",
      "BACKUP_STORAGE_SECRET_ACCESS_KEY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "ALERT_EMAIL_FROM",
      "ALERT_EMAIL_TO",
      "NEXT_PUBLIC_SENTRY_DSN",
      "R2_BUCKET",
      "R2_ENDPOINT",
      "R2_REGION",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_PUBLIC_BASE_URL",
      "GOOGLE_MAPS_API_KEY",
      "PLACES_AUTOCOMPLETE_ENABLED",
      "FEATURE_API_CONNECTORS",
      "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
      "STRIPE_PRICE_INDIVIDUAL_YEARLY",
      "STRIPE_ANNUAL_TRIAL_DAYS",
      "APP_URL",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_APP_URL",
    ];
    for (const key of observed) {
      expect(isManagedRuntimeConfigKey(key)).toBe(true);
      expect(getRuntimeConfigDefinition(key)).not.toBeNull();
    }
  });

  it("never marks a NEXT_PUBLIC_* or EXPO_PUBLIC_* key as a secret", () => {
    for (const definition of RUNTIME_CONFIG_DEFINITIONS) {
      if (definition.key.startsWith("NEXT_PUBLIC_") || definition.key.startsWith("EXPO_PUBLIC_")) {
        expect(definition.isSecret).toBe(false);
      }
    }
  });

  it("flags every deployment-only secret as runtimeEditable=false", () => {
    const deploymentOnly = [
      "USER_JWT_SECRET",
      "ADMIN_JWT_SECRET",
      "FIELD_ENCRYPTION_KEY",
      "CRON_SECRET",
      "INTERNAL_WEBHOOK_SECRET",
      "IMPERSONATION_HANDOFF_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "DATABASE_URL",
      "NODE_ENV",
      "APP_ENV",
    ];
    for (const key of deploymentOnly) {
      const def = getRuntimeConfigDefinition(key);
      expect(def, `definition missing for ${key}`).not.toBeNull();
      expect(def?.runtimeEditable, `${key} should be runtimeEditable=false`).toBe(false);
    }
  });

  it("recognizes dynamic partner connector credential keys as DB-backed managed config", () => {
    const agreement = getRuntimeConfigDefinition("CONNECTOR_USPS_AGREEMENT_STATUS");
    const secret = getRuntimeConfigDefinition("CONNECTOR_USPS_OAUTH_CLIENT_SECRET");
    const tokenUrl = getRuntimeConfigDefinition("CONNECTOR_UPS_OAUTH_TOKEN_URL");
    const webhookSecret = getRuntimeConfigDefinition("CONNECTOR_FEDEX_WEBHOOK_SECRET");

    expect(agreement).toMatchObject({ category: "CONNECTORS", runtimeEditable: true });
    expect(secret).toMatchObject({ isSecret: true, category: "OAUTH", runtimeEditable: true });
    expect(tokenUrl).toMatchObject({ maskStrategy: "url", runtimeEditable: true });
    expect(webhookSecret).toMatchObject({ isSecret: true, runtimeEditable: true });
    expect(isManagedRuntimeConfigKey("CONNECTOR_USPS_AGREEMENT_STATUS")).toBe(true);
    expect(isManagedRuntimeConfigKey("CONNECTOR_USPS_OAUTH_CLIENT_SECRET")).toBe(true);
    expect(isRuntimeConfigDbBackedKeyAllowed("CONNECTOR_USPS_AGREEMENT_STATUS")).toBe(true);
    expect(isRuntimeConfigDbBackedKeyAllowed("CONNECTOR_USPS_OAUTH_CLIENT_SECRET")).toBe(true);
  });

  it("recognizes guided partners as a DB-backed connector catalog", () => {
    expect(getRuntimeConfigDefinition("GUIDED_PARTNERS")).toMatchObject({
      category: "CONNECTORS",
      runtimeEditable: true,
      isSecret: false,
    });
    expect(isManagedRuntimeConfigKey("GUIDED_PARTNERS")).toBe(true);
    expect(isRuntimeConfigDbBackedKeyAllowed("GUIDED_PARTNERS")).toBe(true);
  });
});

describe("validateRuntimeConfigValueShape hardening", () => {
  it("rejects Stripe test secret keys in production-like environments", () => {
    expect(
      validateRuntimeConfigValueShape("STRIPE_SECRET_KEY", "sk_test_1234567890", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: false, reason: "stripe_live_secret_required" });
  });

  it("rejects weak placeholder values for prefixed Stripe and email secrets", () => {
    const cases = [
      ["STRIPE_SECRET_KEY", "sk_live_secret"],
      ["STRIPE_SECRET_KEY", "sk_test_secret"],
      ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_secret"],
      ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_secret"],
      ["STRIPE_WEBHOOK_SECRET", "whsec_secret"],
      ["STRIPE_WEBHOOK_SECRET", "whsec_secret_secret_secret"],
      ["RESEND_API_KEY", "re_secret"],
      ["RESEND_API_KEY", "re_test"],
      ["RESEND_WEBHOOK_SECRET", "secret"],
      ["RESEND_WEBHOOK_SECRET", "changeme"],
      ["RESEND_WEBHOOK_SECRET", "password"],
      ["RESEND_WEBHOOK_SECRET", "123456"],
    ] as const;

    for (const [key, value] of cases) {
      expect(
        validateRuntimeConfigValueShape(key, value, { productionLike: false }),
        `${key}=${value} should be rejected`,
      ).toMatchObject({ ok: false });
    }
  });

  it("keeps non-placeholder prefixed values syntactically valid outside production-like environments", () => {
    expect(
      validateRuntimeConfigValueShape("STRIPE_SECRET_KEY", "sk_test_1234567890", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_1234567890", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("STRIPE_WEBHOOK_SECRET", "whsec_abcdefghijklmnopqrstuvwxyz", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("RESEND_API_KEY", "re_abcdef012345", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
  });

  it("validates dynamic connector URLs and secrets", () => {
    expect(
      validateRuntimeConfigValueShape("CONNECTOR_USPS_AGREEMENT_STATUS", "PRODUCTION", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("CONNECTOR_USPS_AGREEMENT_STATUS", "PENDING", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "connector_agreement_status" });
    expect(
      validateRuntimeConfigValueShape("CONNECTOR_USPS_OAUTH_TOKEN_URL", "https://apis.usps.com/oauth/token", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("CONNECTOR_USPS_OAUTH_TOKEN_URL", "http://apis.usps.com/oauth/token", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "requires_https" });
    expect(
      validateRuntimeConfigValueShape("CONNECTOR_USPS_WEBHOOK_SECRET", "short", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "secret_too_short" });
  });

  it("validates guided partner catalog JSON", () => {
    expect(
      validateRuntimeConfigValueShape(
        "GUIDED_PARTNERS",
        JSON.stringify([
          { key: "ups", name: "UPS" },
          { key: "fedex", name: "FedEx", comingSoon: true },
        ]),
        { productionLike: false },
      ),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("GUIDED_PARTNERS", "{\"key\":\"ups\"}", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "guided_partners_array" });
    expect(
      validateRuntimeConfigValueShape("GUIDED_PARTNERS", JSON.stringify([{ key: "UPS", name: "UPS" }]), {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "guided_partner_key" });
  });

  it("rejects Stripe test publishable keys in production-like environments", () => {
    expect(
      validateRuntimeConfigValueShape("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_1234567890", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: false, reason: "stripe_live_publishable_required" });
  });

  it("allows Stripe test keys outside production-like environments", () => {
    expect(
      validateRuntimeConfigValueShape("STRIPE_SECRET_KEY", "sk_test_1234567890", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_1234567890", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
  });

  it("requires Stripe price IDs to use the price_ prefix", () => {
    expect(
      validateRuntimeConfigValueShape("STRIPE_PRICE_INDIVIDUAL_MONTHLY", "prod_123", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: false, reason: "stripe_price_prefix" });
    expect(
      validateRuntimeConfigValueShape("STRIPE_PRICE_INDIVIDUAL_MONTHLY", "price_123", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it("validates the API connector master switch as a strict boolean", () => {
    expect(
      validateRuntimeConfigValueShape("FEATURE_API_CONNECTORS", "true", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateRuntimeConfigValueShape("FEATURE_API_CONNECTORS", "1", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "boolean_required" });
  });

  it("rejects invalid storage providers and unsafe storage endpoints", () => {
    expect(
      validateRuntimeConfigValueShape("BACKUP_STORAGE_PROVIDER", "ftp", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: false, reason: "storage_provider" });
    expect(
      validateRuntimeConfigValueShape("BACKUP_STORAGE_ENDPOINT", "https://localhost", {
        productionLike: true,
      }),
    ).toMatchObject({ ok: false, reason: "internal_or_loopback_host" });
  });

  it("rejects masked display values and malformed private keys", () => {
    expect(
      validateRuntimeConfigValueShape("RESEND_API_KEY", "re***1234", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "masked_value" });
    expect(
      validateRuntimeConfigValueShape("APPLE_OAUTH_PRIVATE_KEY", "not-a-pem-private-key", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "private_key_pem_required" });
  });

  it("requires Google Play service account-like email addresses", () => {
    expect(
      validateRuntimeConfigValueShape("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL", "ops@example.com", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "service_account_email_required" });
    expect(
      validateRuntimeConfigValueShape(
        "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
        "billing-bot@project.iam.gserviceaccount.com",
        { productionLike: false },
      ),
    ).toMatchObject({ ok: true });
  });

  it("validates RECOMMENDATION_SCORING_WEIGHTS as a usable JSON weight object", () => {
    // Valid: at least one finite numeric weight under a recognized group.
    expect(
      validateRuntimeConfigValueShape(
        "RECOMMENDATION_SCORING_WEIGHTS",
        JSON.stringify({ urgencyTier: { CRITICAL: 120 } }),
        { productionLike: false },
      ),
    ).toMatchObject({ ok: true });

    // Malformed JSON.
    expect(
      validateRuntimeConfigValueShape("RECOMMENDATION_SCORING_WEIGHTS", "{not json", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "json_invalid" });

    // Valid JSON but not an object.
    expect(
      validateRuntimeConfigValueShape("RECOMMENDATION_SCORING_WEIGHTS", "[1,2,3]", {
        productionLike: false,
      }),
    ).toMatchObject({ ok: false, reason: "json_object_required" });

    // Object with no recognized numeric weights — saving it would be a
    // silent no-op, so the admin should be told instead.
    expect(
      validateRuntimeConfigValueShape(
        "RECOMMENDATION_SCORING_WEIGHTS",
        JSON.stringify({ urgencyTier: { CRITICAL: "high" }, foo: 1 }),
        { productionLike: false },
      ),
    ).toMatchObject({ ok: false, reason: "scoring_weights_empty" });
  });

  it("marks weakly-validated generic IDs as needs review instead of verified", () => {
    const resolution = resolveRuntimeConfigResolution({
      definition: getRuntimeConfigDefinition("GOOGLE_OAUTH_CLIENT_ID")!,
      dbValue: "google-client-id",
      env: {},
      productionLike: false,
    });

    expect(resolution.configured).toBe(true);
    expect(resolution.status).toBe("Needs review");
    expect(resolution.validation).toBe("present_but_not_fully_verified");
  });
});
