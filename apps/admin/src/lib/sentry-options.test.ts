import { describe, expect, it } from "vitest";
import { buildSentryOptions } from "./sentry-options";

describe("admin Sentry redaction", () => {
  it("strips request bodies, cookies, auth headers, and user PII", () => {
    const options = buildSentryOptions("server");
    const event = options.beforeSend({
      request: {
        data: { password: "secret" },
        cookies: { admin_session: "cookie-secret" },
        headers: {
          authorization: "Bearer auth-secret",
          Authorization: "Bearer auth-secret-2",
          cookie: "admin_session=cookie-secret",
          "x-safe": "kept",
        },
      },
      user: { email: "admin@example.com", ip_address: "127.0.0.1", id: "adm_1" },
    });

    expect(event.request.data).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.headers.authorization).toBeUndefined();
    expect(event.request.headers.Authorization).toBeUndefined();
    expect(event.request.headers.cookie).toBeUndefined();
    expect(event.request.headers["x-safe"]).toBe("kept");
    expect(event.user.email).toBeUndefined();
    expect(event.user.ip_address).toBeUndefined();
    expect(event.user.id).toBe("adm_1");
  });

  it("redacts sensitive extras and tags recursively", () => {
    const options = buildSentryOptions("server");
    const event = options.beforeSend({
      extra: {
        passwordHash: "hash-secret",
        mfaBackupCodes: ["one", "two"],
        providerId: "oauth-subject",
        pushToken: "push-secret",
        backupArchive: { objectKey: "backups/full.json", rowCount: 10 },
        safeCount: 3,
      },
      tags: {
        resetToken: "reset-secret",
        verificationToken: "verification-secret",
        archivePath: "r2://private/backups/full.json",
        safeFeature: "notifications",
      },
    });

    expect(event.extra.passwordHash).toBe("[Filtered]");
    expect(event.extra.mfaBackupCodes).toBe("[Filtered]");
    expect(event.extra.providerId).toBe("[Filtered]");
    expect(event.extra.pushToken).toBe("[Filtered]");
    expect(event.extra.backupArchive).toBe("[Filtered]");
    expect(event.extra.safeCount).toBe(3);
    expect(event.tags.resetToken).toBe("[Filtered]");
    expect(event.tags.verificationToken).toBe("[Filtered]");
    expect(event.tags.archivePath).toBe("[Filtered]");
    expect(event.tags.safeFeature).toBe("notifications");
  });
});
