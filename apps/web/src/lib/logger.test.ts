import { describe, expect, it } from "vitest";
import { redactLogValue } from "./logger";

describe("logger redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const redacted = redactLogValue({
      headers: {
        authorization: "Bearer secret-token",
        cookie: "user_session=abc123; theme=dark",
      },
      resetToken: "reset-secret",
      nested: { mfaBackupCodes: ["one", "two"] },
    }) as any;

    expect(redacted.headers.authorization).toBe("[REDACTED]");
    expect(redacted.headers.cookie).toBe("[REDACTED]");
    expect(redacted.resetToken).toBe("[REDACTED]");
    expect(redacted.nested.mfaBackupCodes).toBe("[REDACTED]");
  });

  it("redacts bearer tokens and session cookies inside strings", () => {
    const redacted = redactLogValue(
      "Authorization: Bearer eyJhbGciOiJIUzI1Ni.fake; Cookie: user_session=session-secret;",
    );

    expect(redacted).toContain("Bearer [REDACTED]");
    expect(redacted).toContain("user_session=[REDACTED]");
    expect(redacted).not.toContain("session-secret");
    expect(redacted).not.toContain("eyJhbGci");
  });
});
