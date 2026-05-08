import { describe, expect, it } from "vitest";
import { redactAuditPayload } from "./audit-redaction";

describe("redactAuditPayload", () => {
  it("redacts nested secrets and PII without mutating input", () => {
    const input = {
      action: "UPDATE",
      accountNumber: "123456789",
      nested: {
        token: "raw-token",
        metadata: [{ STRIPE_SECRET_KEY: "sk_live_secret", ok: "value" }],
      },
    };
    const before = JSON.stringify(input);

    const out = redactAuditPayload(input);

    expect(out).toEqual({
      action: "UPDATE",
      accountNumber: "[REDACTED]",
      nested: {
        token: "[REDACTED]",
        metadata: [{ STRIPE_SECRET_KEY: "[REDACTED]", ok: "value" }],
      },
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("redacts address and note fields while preserving changed field names", () => {
    const out = redactAuditPayload({
      street: "123 Main St",
      street2: "Apt 4",
      city: "Austin",
      state: "TX",
      zip: "78701",
      notes: "private note",
      isPrimary: true,
    });

    expect(out).toEqual({
      street: "[REDACTED]",
      street2: "[REDACTED]",
      city: "[REDACTED]",
      state: "TX",
      zip: "[REDACTED]",
      notes: "[REDACTED]",
      isPrimary: true,
    });
  });
});
