import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractRecipientEmail,
  type ResendEvent,
  verifyResendSignature,
} from "./resend-webhook";

function signPayload(secret: string, id: string, ts: string, body: string): string {
  const stripped = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(stripped, "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

const BASE_SECRET = "whsec_" + Buffer.from("a".repeat(32)).toString("base64");

describe("verifyResendSignature", () => {
  it("accepts a payload signed with the configured secret", () => {
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.bounced" });
    const signature = signPayload(BASE_SECRET, id, ts, body);

    const result = verifyResendSignature(BASE_SECRET, { id, timestamp: ts, signature }, body);
    expect(result.valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.bounced" });
    const signature = signPayload(BASE_SECRET, id, ts, body);

    const result = verifyResendSignature(BASE_SECRET, { id, timestamp: ts, signature }, body + "x");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no_match");
  });

  it("rejects a different secret", () => {
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "{}";
    const signature = signPayload(BASE_SECRET, id, ts, body);

    const otherSecret = "whsec_" + Buffer.from("b".repeat(32)).toString("base64");
    const result = verifyResendSignature(otherSecret, { id, timestamp: ts, signature }, body);
    expect(result.valid).toBe(false);
  });

  it("rejects expired timestamps outside the 5-minute window", () => {
    const id = "msg_1";
    const now = new Date();
    const tooOldTs = String(Math.floor(now.getTime() / 1000) - 600);
    const body = "{}";
    const signature = signPayload(BASE_SECRET, id, tooOldTs, body);

    const result = verifyResendSignature(BASE_SECRET, { id, timestamp: tooOldTs, signature }, body, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("returns missing_headers for incomplete header sets", () => {
    expect(verifyResendSignature(BASE_SECRET, { id: null, timestamp: "1", signature: "v1,abc" }, "{}").valid).toBe(false);
    expect(verifyResendSignature(BASE_SECRET, { id: "x", timestamp: null, signature: "v1,abc" }, "{}").valid).toBe(false);
    expect(verifyResendSignature(BASE_SECRET, { id: "x", timestamp: "1", signature: null }, "{}").valid).toBe(false);
    expect(verifyResendSignature(BASE_SECRET, { id: "x", timestamp: "not-a-number", signature: "v1,abc" }, "{}").valid).toBe(false);
  });

  it("accepts when at least one signature in a rotated set matches", () => {
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "{}";
    const goodSig = signPayload(BASE_SECRET, id, ts, body);
    const composite = `v1,abc ${goodSig}`;

    const result = verifyResendSignature(BASE_SECRET, { id, timestamp: ts, signature: composite }, body);
    expect(result.valid).toBe(true);
  });
});

describe("extractRecipientEmail", () => {
  it("normalizes emails and tolerates string or array `to` shapes", () => {
    const baseEvent = (data: Record<string, unknown>): ResendEvent => ({ type: "email.bounced", data });
    expect(extractRecipientEmail(baseEvent({ email: "USER@example.com" }))).toBe("user@example.com");
    expect(extractRecipientEmail(baseEvent({ to: ["First@Example.com"] }))).toBe("first@example.com");
    expect(extractRecipientEmail(baseEvent({ to: "single@example.com" }))).toBe("single@example.com");
    expect(extractRecipientEmail(baseEvent({}))).toBeNull();
    expect(extractRecipientEmail(baseEvent({ email: "no-at-symbol" }))).toBeNull();
  });
});
