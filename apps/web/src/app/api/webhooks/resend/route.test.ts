import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    notificationPreference: {
      upsert: vi.fn(() => Promise.resolve({})),
    },
    auditLog: {
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(),
}));

const securityMocks = vi.hoisted(() => ({
  emitSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: (...args: any[]) => securityMocks.emitSecurityEvent(...args),
}));

import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; findFirst: Mock };
const prefMock = prisma.notificationPreference as unknown as { upsert: Mock };
const getRuntimeConfigValueMock = getRuntimeConfigValue as unknown as Mock;

const SECRET_BASE64 = Buffer.from("a".repeat(32)).toString("base64");
const SECRET = `whsec_${SECRET_BASE64}`;

function sign(id: string, ts: string, body: string): string {
  const key = Buffer.from(SECRET_BASE64, "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

function makeRequest(body: string, signature: string, id = "msg_1", ts?: string): NextRequest {
  const timestamp = ts ?? String(Math.floor(Date.now() / 1000));
  return new NextRequest("https://locateflow.com/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeConfigValueMock.mockResolvedValue(SECRET);
  userMock.findUnique.mockResolvedValue({ id: "user_1", deletedAt: null });
  userMock.findFirst.mockResolvedValue({ id: "user_1" });
  prefMock.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/resend", () => {
  it("suppresses marketing for the recipient on email.bounced", async () => {
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: "email.bounced",
      data: { email: "user@example.com", email_id: "abc" },
    });
    const sig = sign(id, ts, body);
    const response = await POST(makeRequest(body, sig, id, ts));

    expect(response.status).toBe(200);
    expect(userMock.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      select: { id: true },
    });
    // upsert called for MARKETING and REMINDER (kind: "all")
    expect(prefMock.upsert).toHaveBeenCalledTimes(2);
  });

  it("suppresses marketing on email.complained", async () => {
    const id = "msg_2";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: "email.complained",
      data: { to: ["spam@example.com"] },
    });
    const sig = sign(id, ts, body);
    const response = await POST(makeRequest(body, sig, id, ts));

    expect(response.status).toBe(200);
    expect(prefMock.upsert).toHaveBeenCalledTimes(2);
  });

  it("acks but does not write for non-suppression events", async () => {
    const id = "msg_3";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.delivered", data: { email: "user@example.com" } });
    const sig = sign(id, ts, body);
    const response = await POST(makeRequest(body, sig, id, ts));

    expect(response.status).toBe(200);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature without writes", async () => {
    const id = "msg_4";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.bounced", data: { email: "user@example.com" } });
    const response = await POST(makeRequest(body, "v1,bogus", id, ts));

    expect(response.status).toBe(401);
    expect(prefMock.upsert).not.toHaveBeenCalled();
    expect(securityMocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "WEBHOOK_SIG_FAILURE",
      context: expect.objectContaining({
        provider: "resend",
        reason: expect.any(String),
        signatureLength: "v1,bogus".length,
        correlationId: id,
      }),
    }));
  });

  it("returns 503 when RESEND_WEBHOOK_SECRET is unset", async () => {
    getRuntimeConfigValueMock.mockResolvedValue(null);
    const id = "msg_5";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "{}";
    const response = await POST(makeRequest(body, "v1,whatever", id, ts));

    expect(response.status).toBe(503);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });

  it("ignores events with no recipient field", async () => {
    const id = "msg_6";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.bounced", data: {} });
    const sig = sign(id, ts, body);
    const response = await POST(makeRequest(body, sig, id, ts));

    expect(response.status).toBe(200);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });

  it("ignores events for soft-deleted users", async () => {
    // Under the soft-delete client extension, a soft-deleted row is
    // hidden from `prisma.user.findUnique` and returns null — same
    // shape as an unknown recipient. One ignore branch covers both.
    userMock.findUnique.mockResolvedValue(null);
    const id = "msg_7";
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "email.bounced", data: { email: "user@example.com" } });
    const sig = sign(id, ts, body);
    const response = await POST(makeRequest(body, sig, id, ts));

    expect(response.status).toBe(200);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });
});
