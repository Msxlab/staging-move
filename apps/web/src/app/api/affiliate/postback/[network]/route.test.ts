import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/db", () => ({
  prisma: {
    affiliateClick: { findUnique: vi.fn() },
    serviceProvider: { findUnique: vi.fn() },
    affiliateConversion: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
  resolveClientIP: () => "203.0.113.9",
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const mockPrisma = {
  affiliateClick: { findUnique: prisma.affiliateClick.findUnique as Mock },
  serviceProvider: { findUnique: (prisma as any).serviceProvider.findUnique as Mock },
  affiliateConversion: { upsert: (prisma as any).affiliateConversion.upsert as Mock },
};

const SECRET = "test-postback-secret";

function makeRequest(network: string, body: Record<string, unknown>, opts?: { signature?: string }) {
  const raw = JSON.stringify(body);
  const signature = opts?.signature ?? createHmac("sha256", SECRET).update(raw).digest("hex");
  return new Request(`http://localhost/api/affiliate/postback/${network}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-affiliate-signature": signature },
    body: raw,
  }) as any;
}

const params = (network: string) => ({ params: Promise.resolve({ network }) });

describe("affiliate postback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AFFILIATE_POSTBACK_SECRET = SECRET;
    mockPrisma.serviceProvider.findUnique.mockResolvedValue({ id: "prov-1" });
    mockPrisma.affiliateConversion.upsert.mockResolvedValue({ id: "conv-1", status: "APPROVED" });
  });

  afterEach(() => {
    delete process.env.AFFILIATE_POSTBACK_SECRET;
  });

  it("records a conversion when the HMAC signature is valid", async () => {
    const response = await POST(
      makeRequest("impact", {
        externalTransactionId: "tx-123",
        providerId: "prov-1",
        amountCents: 2599,
        status: "approved",
      }),
      params("impact"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.affiliateConversion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { network_externalTransactionId: { network: "impact", externalTransactionId: "tx-123" } },
        create: expect.objectContaining({ providerId: "prov-1", network: "impact", amountCents: 2599, status: "APPROVED" }),
      }),
    );
  });

  it("rejects an invalid signature without touching the database", async () => {
    const response = await POST(
      makeRequest("impact", { externalTransactionId: "tx-123", providerId: "prov-1" }, { signature: "deadbeef" }),
      params("impact"),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.affiliateConversion.upsert).not.toHaveBeenCalled();
  });

  it("returns 503 when no secret is configured for the network", async () => {
    delete process.env.AFFILIATE_POSTBACK_SECRET;
    const response = await POST(
      makeRequest("impact", { externalTransactionId: "tx-123", providerId: "prov-1" }),
      params("impact"),
    );

    expect(response.status).toBe(503);
    expect(mockPrisma.affiliateConversion.upsert).not.toHaveBeenCalled();
  });

  it("requires an externalTransactionId", async () => {
    const response = await POST(makeRequest("impact", { providerId: "prov-1" }), params("impact"));
    expect(response.status).toBe(400);
    expect(mockPrisma.affiliateConversion.upsert).not.toHaveBeenCalled();
  });

  it("rejects when a resolvable clickId is owned by a different provider (no cross-attribution)", async () => {
    mockPrisma.affiliateClick.findUnique.mockResolvedValue({ id: "click-1", providerId: "prov-A" });
    const response = await POST(
      makeRequest("impact", { externalTransactionId: "tx-x", clickId: "click-1", providerId: "prov-B" }),
      params("impact"),
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.affiliateConversion.upsert).not.toHaveBeenCalled();
  });

  it("attributes to the click's owner provider when only a clickId is given", async () => {
    mockPrisma.affiliateClick.findUnique.mockResolvedValue({ id: "click-1", providerId: "prov-A" });
    await POST(
      makeRequest("impact", { externalTransactionId: "tx-y", clickId: "click-1" }),
      params("impact"),
    );
    const arg = mockPrisma.affiliateConversion.upsert.mock.calls[0][0];
    expect(arg.create.providerId).toBe("prov-A");
    expect(arg.create.affiliateClickId).toBe("click-1");
  });

  it("resolves the provider (and links the click) from an echoed clickId", async () => {
    mockPrisma.affiliateClick.findUnique.mockResolvedValue({ id: "click-9", providerId: "prov-7" });

    const response = await POST(
      makeRequest("cj", { externalTransactionId: "tx-9", clickId: "click-9", amountCents: 100 }),
      params("cj"),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.affiliateConversion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ providerId: "prov-7", affiliateClickId: "click-9", network: "cj" }),
      }),
    );
  });
});
