import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: () => "rate-key",
  rateLimit: vi.fn(),
}));

vi.mock("@/i18n/config", () => ({
  LOCALE_COOKIE: "NEXT_LOCALE",
  LOCALE_COOKIE_MAX_AGE: 31536000,
  isLocale: (value: string) => value === "en" || value === "es",
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const mockUser = (prisma as unknown as { user: { update: Mock; findUnique: Mock } }).user;
const mockGetUserSession = getUserSession as unknown as Mock;
const mockRateLimit = rateLimit as unknown as Mock;

function postRequest(body: unknown) {
  return new NextRequest("https://app.locateflow.com/api/user/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("user locale route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true });
    mockGetUserSession.mockResolvedValue({ userId: "user-1" });
    mockUser.update.mockResolvedValue({});
  });

  it("persists a supported locale for a logged-in user and sets the cookie", async () => {
    const response = await POST(postRequest({ locale: "es" }));

    expect(response.status).toBe(200);
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { preferredLocale: "es" },
    });
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("es");
  });

  it("rejects an unsupported locale without touching the database", async () => {
    const response = await POST(postRequest({ locale: "zz" }));

    expect(response.status).toBe(400);
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it("rejects writes once the rate limit is exhausted", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(postRequest({ locale: "en" }));

    expect(response.status).toBe(429);
    expect(mockGetUserSession).not.toHaveBeenCalled();
    expect(mockUser.update).not.toHaveBeenCalled();
  });
});
