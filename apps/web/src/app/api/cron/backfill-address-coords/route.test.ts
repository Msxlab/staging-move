import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  addressFindMany: vi.fn(),
  addressUpdate: vi.fn(),
  geocode: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...args: unknown[]) => mocks.guardCronRequest(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findMany: (...args: unknown[]) => mocks.addressFindMany(...args),
      update: (...args: unknown[]) => mocks.addressUpdate(...args),
    },
  },
}));

vi.mock("@/lib/census-geocoder", () => ({
  geocodeFallbackForPersist: (...args: unknown[]) => mocks.geocode(...args),
}));

import { GET, POST } from "./route";

function cronRequest(method: "GET" | "POST" = "POST") {
  return new NextRequest("https://app.locateflow.com/api/cron/backfill-address-coords", {
    method,
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("backfill-address-coords cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.addressFindMany.mockResolvedValue([]);
    mocks.addressUpdate.mockResolvedValue({});
    mocks.geocode.mockResolvedValue(null);
  });

  it("rejects requests that fail the route-level cron guard", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await POST(cronRequest());
    expect(response.status).toBe(401);
    expect(mocks.addressFindMany).not.toHaveBeenCalled();
  });

  it("geocodes coordinate-less addresses and persists the result; skips unresolvable ones", async () => {
    mocks.addressFindMany.mockResolvedValue([
      { id: "a1", street: "1 New St", city: "Austin", state: "TX", zip: "78701" },
      { id: "a2", street: "2 Bad St", city: "Nowhere", state: "ZZ", zip: "00000" },
    ]);
    mocks.geocode
      .mockResolvedValueOnce({ latitude: 30.27, longitude: -97.74 }) // a1 resolves
      .mockResolvedValueOnce(null); // a2 fails — skipped

    const response = await POST(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, scanned: 2, updated: 1, moreLikely: false });
    expect(mocks.addressUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.addressUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { latitude: 30.27, longitude: -97.74 },
    });
    // Only incomplete-coord rows are selected.
    expect(mocks.addressFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          OR: [{ latitude: null }, { longitude: null }],
        }),
      }),
    );
  });

  it("uses the same guarded implementation for GET", async () => {
    const response = await GET(cronRequest("GET"));
    expect(response.status).toBe(200);
    expect(mocks.guardCronRequest).toHaveBeenCalledWith(expect.any(NextRequest), "backfill-address-coords");
  });
});
