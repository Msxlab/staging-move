import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  searchAddressAutocomplete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "places:autocomplete:203.0.113.10"),
  resolveClientIP: vi.fn(() => "203.0.113.10"),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/address-autocomplete", () => ({
  isPlacesProviderConfigError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PLACES_PROVIDER_CONFIG_ERROR",
  searchAddressAutocomplete: (...args: unknown[]) => mocks.searchAddressAutocomplete(...args),
}));

import { GET } from "./route";

function request() {
  return new NextRequest("https://app.locateflow.com/api/address-autocomplete?input=123%20Main&sessionToken=session_1", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

describe("address autocomplete route cost controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    mocks.rateLimit.mockResolvedValue({ success: true, remaining: 10, resetAt: Date.now() + 1000 });
    mocks.searchAddressAutocomplete.mockResolvedValue({
      enabled: true,
      predictions: [{ placeId: "place_1", description: "123 Main St" }],
    });
  });

  it("honors the runtime kill switch without calling Google Places", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("false");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      enabled: false,
      predictions: [],
      code: "PLACES_AUTOCOMPLETE_DISABLED",
    });
    expect(mocks.searchAddressAutocomplete).not.toHaveBeenCalled();
  });

  it("blocks safely when the per-user daily autocomplete cap is reached", async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({ success: true, remaining: 44, resetAt: Date.now() + 1000 })
      .mockResolvedValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 86_400_000 })
      .mockResolvedValueOnce({ success: true, remaining: 999, resetAt: Date.now() + 86_400_000 });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("PLACES_DAILY_CAP_REACHED");
    expect(mocks.searchAddressAutocomplete).not.toHaveBeenCalled();
  });

  it("searches only after minute, per-user, and per-IP caps pass", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.predictions).toHaveLength(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.stringContaining("places:autocomplete:daily:user:user-1:"),
      expect.objectContaining({ windowSeconds: 24 * 60 * 60 }),
    );
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.stringContaining("places:autocomplete:daily:ip:203.0.113.10:"),
      expect.objectContaining({ windowSeconds: 24 * 60 * 60 }),
    );
  });

  it("returns suggestions disabled when the Google Places key is rejected", async () => {
    mocks.searchAddressAutocomplete.mockRejectedValueOnce(
      Object.assign(new Error("API keys with referer restrictions cannot be used with this API."), {
        code: "PLACES_PROVIDER_CONFIG_ERROR",
      }),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      enabled: false,
      predictions: [],
      code: "PLACES_PROVIDER_CONFIG_ERROR",
    });
  });
});
