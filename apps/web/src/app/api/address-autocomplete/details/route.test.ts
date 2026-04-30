import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  lookupAddressAutocomplete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "places:details:203.0.113.10"),
  resolveClientIP: vi.fn(() => "203.0.113.10"),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/address-autocomplete", () => ({
  lookupAddressAutocomplete: (...args: unknown[]) => mocks.lookupAddressAutocomplete(...args),
}));

import { GET } from "./route";

function request() {
  return new NextRequest("https://app.locateflow.com/api/address-autocomplete/details?placeId=place_1&sessionToken=session_1", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

describe("address autocomplete details route cost controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    mocks.rateLimit.mockResolvedValue({ success: true, remaining: 10, resetAt: Date.now() + 1000 });
    mocks.lookupAddressAutocomplete.mockResolvedValue({
      enabled: true,
      result: { placeId: "place_1", street: "123 Main St", city: "Austin", state: "TX", zip: "78701" },
    });
  });

  it("honors the runtime kill switch without calling Google Places details", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("false");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      enabled: false,
      result: null,
      code: "PLACES_AUTOCOMPLETE_DISABLED",
    });
    expect(mocks.lookupAddressAutocomplete).not.toHaveBeenCalled();
  });

  it("blocks safely when the per-user daily details cap is reached", async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({ success: true, remaining: 44, resetAt: Date.now() + 1000 })
      .mockResolvedValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 86_400_000 })
      .mockResolvedValueOnce({ success: true, remaining: 999, resetAt: Date.now() + 86_400_000 });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("PLACES_DAILY_CAP_REACHED");
    expect(mocks.lookupAddressAutocomplete).not.toHaveBeenCalled();
  });

  it("looks up details only after minute, per-user, and per-IP caps pass", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.placeId).toBe("place_1");
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.stringContaining("places:details:daily:user:user-1:"),
      expect.objectContaining({ windowSeconds: 24 * 60 * 60 }),
    );
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.stringContaining("places:details:daily:ip:203.0.113.10:"),
      expect.objectContaining({ windowSeconds: 24 * 60 * 60 }),
    );
  });
});
