import { describe, expect, it, vi } from "vitest";
import { createRedactingLogger, redactSecrets } from "./logger";

describe("redactSecrets", () => {
  it("scrubs bearer tokens, encrypted blobs, emails, and long numbers", () => {
    expect(redactSecrets("Authorization: Bearer abc.def-123xyz")).toContain("Bearer [redacted]");
    expect(redactSecrets("blob enc_v1:aaa:bbb:ccc tail")).toContain("[encrypted]");
    expect(redactSecrets("mail john.doe@example.com here")).toContain("[email]");
    expect(redactSecrets("acct 1234567890")).toContain("[number]");
  });

  it("leaves harmless text intact", () => {
    expect(redactSecrets("opening partner page")).toBe("opening partner page");
  });
});

describe("createRedactingLogger", () => {
  it("redacts the message and meta, and drops sensitive keys", () => {
    const sink = vi.fn();
    const logger = createRedactingLogger(sink);

    logger.info("user john@example.com opened", {
      accessToken: "Bearer s3cret",
      note: "call 5551234567",
      nested: { confirmation: "Z9", safe: "ok" },
    });

    expect(sink).toHaveBeenCalledTimes(1);
    const call = sink.mock.calls[0]!;
    const level = call[0] as string;
    const message = call[1] as string;
    const meta = call[2] as Record<string, unknown>;

    expect(level).toBe("info");
    expect(message).toContain("[email]");
    expect(meta.accessToken).toBe("[redacted]");
    expect(meta.note).toContain("[number]");
    expect((meta.nested as Record<string, unknown>).confirmation).toBe("[redacted]");
    expect((meta.nested as Record<string, unknown>).safe).toBe("ok");
  });
});
