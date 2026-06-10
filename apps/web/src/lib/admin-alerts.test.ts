import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendLoggedEmail: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/email-service", () => ({
  sendLoggedEmail: mocks.sendLoggedEmail,
}));
vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));
// qa-account stays REAL (it drives the suppression behavior under test) but
// its prisma import must not touch a live client.
vi.mock("@/lib/db", () => ({ prisma: {}, rawPrisma: {} }));

import {
  resolveAdminAlertRecipients,
  sendAdminPurchaseAlert,
  sendAdminSignupAlert,
} from "./admin-alerts";

const originalEnv = { ...process.env };

function configureRuntimeConfig(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

describe("admin alert emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    delete process.env.NEXT_PUBLIC_ADMIN_URL;
    configureRuntimeConfig({});
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("resolveAdminAlertRecipients", () => {
    it("prefers ADMIN_ALERT_EMAIL over ALERT_EMAIL_TO", async () => {
      configureRuntimeConfig({
        ADMIN_ALERT_EMAIL: "owner@locateflow.com",
        ALERT_EMAIL_TO: "fallback@locateflow.com",
      });
      await expect(resolveAdminAlertRecipients()).resolves.toEqual(["owner@locateflow.com"]);
    });

    it("falls back to ALERT_EMAIL_TO when ADMIN_ALERT_EMAIL is unset", async () => {
      configureRuntimeConfig({ ALERT_EMAIL_TO: "fallback@locateflow.com" });
      await expect(resolveAdminAlertRecipients()).resolves.toEqual(["fallback@locateflow.com"]);
    });

    it("splits comma lists, trims, lowercases, dedupes, and drops invalid entries", async () => {
      configureRuntimeConfig({
        ADMIN_ALERT_EMAIL: " Owner@LocateFlow.com , ops@locateflow.com,owner@locateflow.com,, not-an-email ",
      });
      await expect(resolveAdminAlertRecipients()).resolves.toEqual([
        "owner@locateflow.com",
        "ops@locateflow.com",
      ]);
    });

    it("returns an empty list when nothing is configured", async () => {
      await expect(resolveAdminAlertRecipients()).resolves.toEqual([]);
    });
  });

  describe("sendAdminSignupAlert", () => {
    it("sends one email per recipient with a per-recipient signup dedupe key", async () => {
      configureRuntimeConfig({
        ADMIN_ALERT_EMAIL: "owner@locateflow.com,ops@locateflow.com",
        NEXT_PUBLIC_ADMIN_URL: "https://admin.example.com/",
      });

      const sent = await sendAdminSignupAlert({
        userId: "user-1",
        email: "new@example.com",
        name: "New User",
        source: "password",
      });

      expect(sent).toBe(true);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "owner@locateflow.com",
        subject: "[LocateFlow] New signup: new@example.com",
        dedupeKey: "admin-alert:signup:user-1:owner@locateflow.com",
        metadata: expect.objectContaining({ kind: "admin-signup-alert", userId: "user-1" }),
      }));
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "ops@locateflow.com",
        dedupeKey: "admin-alert:signup:user-1:ops@locateflow.com",
      }));
      // Deep link to the admin user page (trailing slash on the base stripped).
      const html = mocks.sendLoggedEmail.mock.calls[0][0].html as string;
      expect(html).toContain("https://admin.example.com/users/user-1");
      expect(html).toContain("new@example.com");
      expect(html).toContain("password");
    });

    it("suppresses the allowlisted QA account case-insensitively", async () => {
      process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });

      const sent = await sendAdminSignupAlert({
        userId: "qa-user",
        email: "QA@Example.com",
        source: "password",
      });

      expect(sent).toBe(false);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("skips silently when no recipients are configured", async () => {
      const sent = await sendAdminSignupAlert({
        userId: "user-1",
        email: "new@example.com",
        source: "oauth:google",
      });

      expect(sent).toBe(false);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("never throws when the email layer rejects", async () => {
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });
      mocks.sendLoggedEmail.mockRejectedValue(new Error("resend down"));

      await expect(sendAdminSignupAlert({
        userId: "user-1",
        email: "new@example.com",
        source: "password",
      })).resolves.toBe(false);
    });

    it("never throws when recipient resolution itself fails", async () => {
      mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));

      await expect(sendAdminSignupAlert({
        userId: "user-1",
        email: "new@example.com",
        source: "password",
      })).resolves.toBe(false);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("keeps sending to remaining recipients when one send fails", async () => {
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com,ops@locateflow.com" });
      mocks.sendLoggedEmail
        .mockRejectedValueOnce(new Error("first recipient failed"))
        .mockResolvedValueOnce({ success: true, skipped: false });

      await expect(sendAdminSignupAlert({
        userId: "user-1",
        email: "new@example.com",
        source: "password",
      })).resolves.toBe(true);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendAdminPurchaseAlert", () => {
    it("sends with the purchase dedupe key derived from the caller's event key", async () => {
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });

      const sent = await sendAdminPurchaseAlert({
        userId: "user-1",
        email: "buyer@example.com",
        plan: "FAMILY",
        interval: "YEAR",
        provider: "stripe",
        dedupeKey: "stripe:evt_123",
      });

      expect(sent).toBe(true);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "owner@locateflow.com",
        subject: "[LocateFlow] New subscription: Family (stripe) - buyer@example.com",
        dedupeKey: "admin-alert:purchase:stripe:evt_123:owner@locateflow.com",
        metadata: expect.objectContaining({
          kind: "admin-purchase-alert",
          userId: "user-1",
          provider: "stripe",
          planLabel: "Family",
          billingInterval: "YEAR",
        }),
      }));
    });

    it("suppresses purchases by the allowlisted QA account", async () => {
      process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });

      const sent = await sendAdminPurchaseAlert({
        userId: "qa-user",
        email: "qa@example.com",
        plan: "PRO",
        interval: "MONTH",
        provider: "apple",
        dedupeKey: "iap:APP_STORE:txn-1:txn-2:ACTIVE",
      });

      expect(sent).toBe(false);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("never throws when the email layer rejects", async () => {
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });
      mocks.sendLoggedEmail.mockRejectedValue(new Error("resend down"));

      await expect(sendAdminPurchaseAlert({
        userId: "user-1",
        email: "buyer@example.com",
        plan: "INDIVIDUAL",
        interval: "MONTH",
        provider: "google",
        dedupeKey: "iap:PLAY_STORE:GPA.1:GPA.1:ACTIVE",
      })).resolves.toBe(false);
    });
  });
});
