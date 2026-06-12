import { describe, expect, it } from "vitest";
import { buildReadinessReport, summarizeReadinessForResponse } from "./production-readiness";

const validProdEnv = {
  NODE_ENV: "production",
  USER_JWT_SECRET: "X".repeat(48),
  ADMIN_JWT_SECRET: "Y".repeat(48),
  FIELD_ENCRYPTION_KEY: "f".repeat(64),
  CRON_SECRET: "c".repeat(40),
  INTERNAL_WEBHOOK_SECRET: "w".repeat(40),
  IMPERSONATION_HANDOFF_SECRET: "i".repeat(40),
  DATABASE_URL: "mysql://user:pass@db.example.com/locateflow",
  UPSTASH_REDIS_REST_URL: "https://example-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  APP_URL: "https://app.example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_PUBLIC_ADMIN_URL: "https://admin.example.com",
  RESEND_API_KEY: "re_abcdefghijklmnopqrstuvwxyz",
  EMAIL_FROM: "LocateFlow <noreply@example.com>",
  SUPPORT_EMAIL: "support@example.com",
  STRIPE_SECRET_KEY: "sk_live_abcdefghijklmnopqrstuvwxyz",
  STRIPE_WEBHOOK_SECRET: "whsec_abcdefghijklmnopqrstuvwxyz",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abcdefghijklmnopqrstuvwxyz",
  STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_individualmonthly123",
  STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_individualyearly123",
  STRIPE_PRICE_FAMILY_MONTHLY: "price_familymonthly123",
  STRIPE_PRICE_FAMILY_YEARLY: "price_familyyearly123",
  STRIPE_PRICE_PRO_MONTHLY: "price_promonthly123",
  STRIPE_PRICE_PRO_YEARLY: "price_proyearly123",
  STRIPE_ANNUAL_TRIAL_DAYS: "90",
  GOOGLE_MAPS_API_KEY: "AIzaSyProductionMapsKey",
  TRUSTED_PROXY_HEADERS: "cloudflare",
  FCC_BDC_ENABLED: "true",
  FCC_BDC_API_KEY: "fcc-production-token",
  FCC_BDC_USERNAME: "ops@example.com",
  ELECTRIC_LOOKUP_ENABLED: "true",
  OPENEI_API_KEY: "openei-production-token",
  AIRNOW_API_KEY: "airnow-production-token",
  CENSUS_API_KEY: "census-production-token",
} as unknown as NodeJS.ProcessEnv;

describe("buildReadinessReport", () => {
  it("returns ready when production-like env is fully configured", () => {
    const report = buildReadinessReport(validProdEnv, true);
    expect(report.ready).toBe(true);
    expect(report.failCount).toBe(0);
    expect(report.warnCount).toBe(0);
  });

  it("flags missing production secrets", () => {
    const env = { ...validProdEnv, USER_JWT_SECRET: undefined };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "USER_JWT_SECRET")?.severity).toBe("fail");
  });

  it("flags weak/short secrets", () => {
    const env = { ...validProdEnv, ADMIN_JWT_SECRET: "short" };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "ADMIN_JWT_SECRET")?.severity).toBe("fail");
  });

  it("flags non-hex FIELD_ENCRYPTION_KEY", () => {
    const env = { ...validProdEnv, FIELD_ENCRYPTION_KEY: "not-hex-but-long-enough-to-pass-length-check-aa".padEnd(64, "z") };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "FIELD_ENCRYPTION_KEY")?.severity).toBe("fail");
  });

  it("flags localhost public URL in production", () => {
    const env = { ...validProdEnv, NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "NEXT_PUBLIC_APP_URL")?.severity).toBe("fail");
  });

  it("downgrades all failures to warn outside production", () => {
    const env = { ...validProdEnv, USER_JWT_SECRET: undefined };
    const report = buildReadinessReport(env, false);
    expect(report.ready).toBe(true);
    expect(report.warnCount).toBeGreaterThan(0);
  });

  it("requires the full Google Play IAP identity set once any key is configured (audit P1-10)", () => {
    const env = { ...validProdEnv, GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile" };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL")?.severity).toBe("fail");
    expect(report.issues.find((i) => i.key === "GOOGLE_PLAY_RTDN_AUDIENCE")?.severity).toBe("fail");
  });

  it("passes when the Google Play IAP identity set is complete", () => {
    const env = {
      ...validProdEnv,
      GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: "play-api@example.iam.gserviceaccount.com",
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      GOOGLE_PLAY_RTDN_AUDIENCE: "https://app.example.com/api/webhooks/playstore",
    } as unknown as NodeJS.ProcessEnv;
    const report = buildReadinessReport(env, true);
    expect(report.issues.some((i) => i.key.startsWith("GOOGLE_PLAY_"))).toBe(false);
  });

  it("warns when APPLE_TEAM_ID is set but APPLE_BUNDLE_ID is missing in production (audit P1-10)", () => {
    const env = { ...validProdEnv, APPLE_TEAM_ID: "TEAM123456" } as unknown as NodeJS.ProcessEnv;
    const report = buildReadinessReport(env, true);
    expect(report.issues.find((i) => i.key === "APPLE_BUNDLE_ID")?.severity).toBe("warn");
  });

  it("flags REPLACE-restore unlock as a warning in production", () => {
    const env = { ...validProdEnv, ALLOW_PRODUCTION_REPLACE_RESTORE: "true" };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(true);
    expect(report.issues.find((i) => i.key === "ALLOW_PRODUCTION_REPLACE_RESTORE")?.severity).toBe("warn");
  });

  it("warns without blocking when production proxy header mode is implicit", () => {
    const env = { ...validProdEnv, TRUSTED_PROXY_HEADERS: undefined };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(true);
    expect(report.issues.find((i) => i.key === "TRUSTED_PROXY_HEADERS")?.severity).toBe("warn");
  });

  it("warns without blocking when FCC serviceability is enabled without the documented credential pair", () => {
    const env = {
      ...validProdEnv,
      FCC_BDC_ENABLED: "true",
      FCC_BDC_API_KEY: "fcc-production-token",
      FCC_BDC_USERNAME: undefined,
    };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(true);
    expect(report.issues.find((i) => i.key === "FCC_BDC_USERNAME")?.severity).toBe("warn");
  });

  it("warns without blocking when dossier data keys are absent", () => {
    const env = { ...validProdEnv, AIRNOW_API_KEY: undefined, CENSUS_API_KEY: undefined };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(true);
    expect(report.issues.find((i) => i.key === "AIRNOW_API_KEY")?.severity).toBe("warn");
    expect(report.issues.find((i) => i.key === "CENSUS_API_KEY")?.severity).toBe("warn");
  });

  it("flags placeholder Redis env in production", () => {
    const env = {
      ...validProdEnv,
      UPSTASH_REDIS_REST_URL: "REPLACE_WITH_URL",
      UPSTASH_REDIS_REST_TOKEN: "REPLACE_WITH_TOKEN",
    };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "UPSTASH_REDIS")?.severity).toBe("fail");
  });

  it("never returns secret values in summary", () => {
    const env = { ...validProdEnv, USER_JWT_SECRET: undefined };
    const summary = summarizeReadinessForResponse(buildReadinessReport(env, true));
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain(validProdEnv.USER_JWT_SECRET);
    expect(blob).not.toContain(validProdEnv.FIELD_ENCRYPTION_KEY);
    expect(blob).not.toContain(validProdEnv.IMPERSONATION_HANDOFF_SECRET);
  });

  it("flags missing IMPERSONATION_HANDOFF_SECRET as fail in production", () => {
    const env = { ...validProdEnv, IMPERSONATION_HANDOFF_SECRET: undefined };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(
      report.issues.find((i) => i.key === "IMPERSONATION_HANDOFF_SECRET")?.severity,
    ).toBe("fail");
  });

  it("flags missing INTERNAL_WEBHOOK_SECRET as fail in production (was warn before hardening)", () => {
    const env = { ...validProdEnv, INTERNAL_WEBHOOK_SECRET: undefined };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(
      report.issues.find((i) => i.key === "INTERNAL_WEBHOOK_SECRET")?.severity,
    ).toBe("fail");
  });

  it("flags localhost APP_URL in production", () => {
    const env = { ...validProdEnv, APP_URL: "http://localhost:3000" };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "APP_URL")?.severity).toBe("fail");
  });

  it("requires Family and Pro Stripe prices before production paid launch", () => {
    const env = {
      ...validProdEnv,
      STRIPE_PRICE_FAMILY_MONTHLY: undefined,
      STRIPE_PRICE_PRO_YEARLY: undefined,
    };
    const report = buildReadinessReport(env, true);
    expect(report.ready).toBe(false);
    expect(report.issues.find((i) => i.key === "STRIPE_PRICE_FAMILY_MONTHLY")?.severity).toBe("fail");
    expect(report.issues.find((i) => i.key === "STRIPE_PRICE_PRO_YEARLY")?.severity).toBe("fail");
  });
});
