import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/user-auth", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { GET } from "./route";

const getUserSessionMock = getUserSession as unknown as Mock;
const userFindUniqueMock = prisma.user.findUnique as unknown as Mock;

function makeRequest(path: string) {
  return new NextRequest(`https://locateflow.com${path}`);
}

describe("auth me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user session exists", async () => {
    getUserSessionMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "Unauthorized", user: null });
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns a quiet logged-out state for optional auth checks", async () => {
    getUserSessionMock.mockResolvedValue(null);

    const response = await GET(makeRequest("/api/auth/me?optional=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ authenticated: false, user: null });
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the session user no longer exists", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "user_1" });
    userFindUniqueMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a quiet logged-out state for optional checks when the session user no longer exists", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "user_1" });
    userFindUniqueMock.mockResolvedValue(null);

    const response = await GET(makeRequest("/api/auth/me?optional=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ authenticated: false, user: null });
  });
});
