import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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

  it("returns 401 when the session user no longer exists", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "user_1" });
    userFindUniqueMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
