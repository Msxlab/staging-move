import { describe, expect, it } from "vitest";
import { buildSentryOptions } from "./sentry-options";

describe("web Sentry redaction", () => {
  it("redacts high-risk auth, recovery, OAuth, push, and backup metadata", () => {
    const options = buildSentryOptions("server");
    const event = options.beforeSend({
      request: {
        data: { password: "secret" },
        cookies: { user_session: "cookie-secret" },
        headers: {
          authorization: "Bearer auth-secret",
          cookie: "user_session=cookie-secret",
          "x-safe": "kept",
        },
      },
      extra: {
        passwordHash: "hash-secret",
        mfaSecret: "mfa-secret",
        mfaBackupCodes: ["one", "two"],
        providerId: "oauth-subject",
        pushToken: "push-secret",
        backupArchive: { objectKey: "backups/full.json" },
        safeCount: 2,
      },
      tags: {
        resetToken: "reset-secret",
        verificationToken: "verification-secret",
        archivePath: "r2://private/backups/full.json",
        safeFeature: "account-security",
      },
    });

    expect(event.request.data).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.headers.authorization).toBeUndefined();
    expect(event.request.headers.cookie).toBeUndefined();
    expect(event.request.headers["x-safe"]).toBe("kept");
    expect(event.extra.passwordHash).toBe("[Filtered]");
    expect(event.extra.mfaSecret).toBe("[Filtered]");
    expect(event.extra.mfaBackupCodes).toBe("[Filtered]");
    expect(event.extra.providerId).toBe("[Filtered]");
    expect(event.extra.pushToken).toBe("[Filtered]");
    expect(event.extra.backupArchive).toBe("[Filtered]");
    expect(event.extra.safeCount).toBe(2);
    expect(event.tags.resetToken).toBe("[Filtered]");
    expect(event.tags.verificationToken).toBe("[Filtered]");
    expect(event.tags.archivePath).toBe("[Filtered]");
    expect(event.tags.safeFeature).toBe("account-security");
  });
});
