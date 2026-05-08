import { describe, expect, it } from "vitest";
import {
  ENV_FIRST_RUNTIME_CONFIG_KEYS,
  STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG,
  getRuntimeConfigDefinition,
  getRuntimeConfigEnvValue,
  isManagedRuntimeConfigKey,
  isRuntimeConfigDbOverrideEnabled,
  maskRuntimeConfigValue,
  RUNTIME_CONFIG_DEFINITIONS,
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

  it("supports the GOOGLE_MAPS_API_KEY public alias fallback", () => {
    expect(
      getRuntimeConfigEnvValue("GOOGLE_MAPS_API_KEY", {
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaPublic",
      }),
    ).toBe("AIzaPublic");
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
});
