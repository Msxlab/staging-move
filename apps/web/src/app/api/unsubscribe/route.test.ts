import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
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

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
  getRateLimitKey: vi.fn(() => "rate-key"),
}));

import { prisma } from "@/lib/db";

const userMock = prisma.user as unknown as { findFirst: Mock };
const prefMock = prisma.notificationPreference as unknown as { upsert: Mock };

const ORIGINAL_SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "a".repeat(32);
  userMock.findFirst.mockResolvedValue({ id: "user_1" });
  prefMock.upsert.mockResolvedValue({});
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  } else {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = ORIGINAL_SECRET;
  }
});

async function loadModule() {
  vi.resetModules();
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "a".repeat(32);
  const unsubscribeMod = await import("@/lib/unsubscribe");
  const { POST, GET } = await import("./route");
  return { POST, GET, signUnsubscribeToken: unsubscribeMod.signUnsubscribeToken };
}

describe("POST /api/unsubscribe", () => {
  it("opts the user out of all kinds for a valid token (browser link)", async () => {
    const { POST, signUnsubscribeToken } = await loadModule();
    const token = signUnsubscribeToken("user_1");

    const request = new NextRequest(`https://locateflow.com/api/unsubscribe?t=${token}`, {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prefMock.upsert).toHaveBeenCalledTimes(3); // MARKETING + REMINDER + LIFECYCLE
  });

  it("opts the user out of marketing only when k=marketing", async () => {
    const { POST, signUnsubscribeToken } = await loadModule();
    const token = signUnsubscribeToken("user_1");

    const request = new NextRequest(`https://locateflow.com/api/unsubscribe?t=${token}&k=marketing`, {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prefMock.upsert).toHaveBeenCalledTimes(1);
    expect(prefMock.upsert.mock.calls[0][0].where.userId_channel_type.type).toBe("MARKETING");
  });

  it("honors RFC 8058 one-click POST with form body", async () => {
    const { POST, signUnsubscribeToken } = await loadModule();
    const token = signUnsubscribeToken("user_1");

    const formBody = new URLSearchParams();
    formBody.set("List-Unsubscribe", "One-Click");
    const request = new NextRequest(`https://locateflow.com/api/unsubscribe?t=${token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prefMock.upsert).toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const { POST } = await loadModule();
    const request = new NextRequest("https://locateflow.com/api/unsubscribe?t=garbage", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });

  it("rejects when user is missing or soft-deleted", async () => {
    userMock.findFirst.mockResolvedValue(null);
    const { POST, signUnsubscribeToken } = await loadModule();
    const token = signUnsubscribeToken("user_1");
    const request = new NextRequest(`https://locateflow.com/api/unsubscribe?t=${token}`, {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
    expect(prefMock.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/unsubscribe", () => {
  it("returns valid:true for a valid token", async () => {
    const { GET, signUnsubscribeToken } = await loadModule();
    const token = signUnsubscribeToken("user_1");

    const request = new NextRequest(`https://locateflow.com/api/unsubscribe?t=${token}`);
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
  });

  it("returns valid:false for an invalid token", async () => {
    const { GET } = await loadModule();
    const request = new NextRequest("https://locateflow.com/api/unsubscribe?t=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});
