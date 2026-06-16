import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/lib/store-review-account", () => ({
  provisionConfiguredStoreReviewAccounts: vi.fn(() =>
    Promise.resolve({
      configured: 1,
      matched: 1,
      verified: 1,
      provisioned: 1,
      missing: [],
    }),
  ),
}));

import { guardCronRequest } from "@/lib/cron-guard";
import { provisionConfiguredStoreReviewAccounts } from "@/lib/store-review-account";
import { GET, POST } from "./route";

const guardCronRequestMock = guardCronRequest as unknown as Mock;
const provisionMock = provisionConfiguredStoreReviewAccounts as unknown as Mock;

function makeRequest(method = "GET") {
  return new NextRequest("https://locateflow.com/api/cron/store-review-accounts", {
    method,
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("store-review-accounts cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardCronRequestMock.mockResolvedValue({ ok: true });
    provisionMock.mockResolvedValue({
      configured: 1,
      matched: 1,
      verified: 1,
      provisioned: 1,
      missing: [],
    });
  });

  it("provisions configured store review accounts", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      configured: 1,
      matched: 1,
      verified: 1,
      provisioned: 1,
    });
    expect(guardCronRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "store-review-accounts",
      { limit: 6, windowSeconds: 60 },
    );
    expect(provisionMock).toHaveBeenCalledWith({ request: expect.any(NextRequest) });
  });

  it("returns the cron guard denial response", async () => {
    guardCronRequestMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeRequest("POST"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(provisionMock).not.toHaveBeenCalled();
  });
});
