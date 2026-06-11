import { createHash } from "node:crypto";
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
  getRequiredRuntimeConfigValues: async (keys: string[]) =>
    Object.fromEntries(
      await Promise.all(
        keys.map(async (key: string) => [key, await mocks.getRuntimeConfigValue(key)]),
      ),
    ),
}));
// admin-alerts (recipient resolution) and qa-account (account-dimension
// suppression) stay REAL — they drive behavior under test — but their prisma
// import must not touch a live client.
vi.mock("@/lib/db", () => ({ prisma: {}, rawPrisma: {} }));

import {
  __resetSecurityAlertsForTests,
  alertWebhookSignatureFailure,
  FAILED_LOGIN_ALERT_THRESHOLD,
  recordFailedLoginForAlerting,
} from "./security-alerts";

const originalEnv = { ...process.env };

function configureRuntimeConfig(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

function subjectHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function failNTimes(n: number, opts?: { email?: string; ip?: string }) {
  for (let i = 0; i < n; i++) {
    await recordFailedLoginForAlerting({
      email: opts?.email ?? "victim@example.com",
      ip: opts?.ip ?? "198.51.100.7",
      clientType: "web",
    });
  }
}

describe("security alerts (web alarm layer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSecurityAlertsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:00.000Z"));
    delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com" });
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe("recordFailedLoginForAlerting", () => {
    it("stays silent below the threshold", async () => {
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD - 1);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("fires account + IP alerts at the threshold with day-scoped dedupe keys", async () => {
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD);

      // Both dimensions trip on the same burst (one account, one IP).
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);

      const accountHash = subjectHash("acct:victim@example.com");
      const ipHash = subjectHash("ip:198.51.100.7");
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "owner@locateflow.com",
        subject: "[LocateFlow] Security alert: failed-login burst on account victim@example.com",
        dedupeKey: `security-alert:failed-login:account:${accountHash}:2026-06-09:owner@locateflow.com`,
        metadata: expect.objectContaining({ kind: "security-alert" }),
      }));
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        subject: "[LocateFlow] Security alert: failed-login burst from IP 198.51.100.7",
        dedupeKey: `security-alert:failed-login:ip:${ipHash}:2026-06-09:owner@locateflow.com`,
      }));

      // Body carries only the account email / IP — and a console.error
      // breadcrumb accompanied the dispatch.
      const html = mocks.sendLoggedEmail.mock.calls[0][0].html as string;
      expect(html).toContain("victim@example.com");
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });

    it("fires at most once per day per key, then again after the UTC day rolls over", async () => {
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD + 5);
      // Still exactly one email per dimension despite 5 over-threshold events.
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);

      // Next UTC day: a fresh burst alerts again under a new day key.
      vi.setSystemTime(new Date("2026-06-10T10:00:00.000Z"));
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(4);
      const accountHash = subjectHash("acct:victim@example.com");
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        dedupeKey: `security-alert:failed-login:account:${accountHash}:2026-06-10:owner@locateflow.com`,
      }));
    });

    it("forgets attempts once the 15-minute window expires", async () => {
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD - 1);
      vi.setSystemTime(new Date("2026-06-09T10:16:00.000Z"));
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD - 1);
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("suppresses the QA account dimension but still counts its IP", async () => {
      process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD, { email: "QA@Example.com" });

      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        dedupeKey: expect.stringContaining("security-alert:failed-login:ip:"),
      }));
    });

    it("fans out to every configured recipient with per-recipient dedupe keys", async () => {
      configureRuntimeConfig({ ADMIN_ALERT_EMAIL: "owner@locateflow.com,ops@locateflow.com" });
      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD);

      // 2 dimensions x 2 recipients.
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(4);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "ops@locateflow.com",
        dedupeKey: expect.stringMatching(/:ops@locateflow\.com$/),
      }));
    });

    it("does nothing when no recipients are configured (breadcrumb only) and never throws", async () => {
      configureRuntimeConfig({});
      await expect(failNTimes(FAILED_LOGIN_ALERT_THRESHOLD)).resolves.toBeUndefined();
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });

    it("swallows transport failures and retries on the next qualifying event", async () => {
      mocks.sendLoggedEmail.mockRejectedValue(new Error("resend down"));
      await expect(failNTimes(FAILED_LOGIN_ALERT_THRESHOLD)).resolves.toBeUndefined();
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);

      // Transport recovers — the day key was never marked, so the next
      // over-threshold failure re-attempts delivery.
      mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });
      await failNTimes(1);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(4);
    });

    it("never throws when recipient resolution itself fails", async () => {
      mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));
      await expect(failNTimes(FAILED_LOGIN_ALERT_THRESHOLD)).resolves.toBeUndefined();
      expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    });

    it("uses the shared Upstash window when configured", async () => {
      configureRuntimeConfig({
        ADMIN_ALERT_EMAIL: "owner@locateflow.com",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "token-1",
      });
      const counts = new Map<string, number>();
      const fetchMock = vi.fn(async (input: any) => {
        const url = String(input);
        const incrMatch = url.match(/\/incr\/([^/]+)$/);
        if (incrMatch) {
          const key = decodeURIComponent(incrMatch[1]);
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return { ok: true, json: async () => ({ result: next }) } as any;
        }
        return { ok: true, json: async () => ({ result: 1 }) } as any;
      });
      vi.stubGlobal("fetch", fetchMock);

      await failNTimes(FAILED_LOGIN_ALERT_THRESHOLD);

      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calledUrls.some((u) => u.includes("/incr/"))).toBe(true);
      // TTL set exactly once per counter (on the first INCR).
      expect(calledUrls.filter((u) => u.includes("/expire/")).length).toBe(2);
      vi.unstubAllGlobals();
    });
  });

  describe("alertWebhookSignatureFailure", () => {
    it("alerts on a single signature failure with a provider+reason day key", async () => {
      await alertWebhookSignatureFailure({
        provider: "stripe",
        reason: "signature_verification_failed",
      });

      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendLoggedEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "owner@locateflow.com",
        subject: "[LocateFlow] Security alert: stripe webhook signature/auth failure (signature_verification_failed)",
        dedupeKey:
          "security-alert:webhook-sig:stripe:signature_verification_failed:2026-06-09:owner@locateflow.com",
        metadata: expect.objectContaining({ kind: "security-alert", provider: "stripe" }),
      }));
    });

    it("dedupes repeats for the same provider+reason within the day, but not across reasons", async () => {
      await alertWebhookSignatureFailure({ provider: "appstore", reason: "outer_jws_verify_failed" });
      await alertWebhookSignatureFailure({ provider: "appstore", reason: "outer_jws_verify_failed" });
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);

      await alertWebhookSignatureFailure({ provider: "appstore", reason: "bundle_mismatch" });
      expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(2);
    });

    it("sanitizes a hostile reason before it reaches keys and subjects", async () => {
      await alertWebhookSignatureFailure({
        provider: "playstore",
        reason: "oidc verify failed: <script>",
      });
      const call = mocks.sendLoggedEmail.mock.calls[0][0];
      expect(call.dedupeKey).toContain("webhook-sig:playstore:oidc_verify_failed___script_");
      expect(call.subject).not.toContain("<");
    });

    it("swallows transport failures (never throws into the webhook path)", async () => {
      mocks.sendLoggedEmail.mockRejectedValue(new Error("resend down"));
      await expect(
        alertWebhookSignatureFailure({ provider: "stripe", reason: "signature_verification_failed" }),
      ).resolves.toBeUndefined();
    });
  });
});
