import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { PATCH } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockNotification = prisma.notification as unknown as {
  findUnique: Mock;
  update: Mock;
};

describe("single notification feed item auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockNotification.findUnique.mockResolvedValue({ id: "notif-1", userId: "user-1" });
    mockNotification.update.mockResolvedValue({});
  });

  it("returns 401 instead of a generic 500 when unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await PATCH(new Request("http://localhost/api/notifications/feed/notif-1") as any, {
      params: Promise.resolve({ id: "notif-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockNotification.findUnique).not.toHaveBeenCalled();
  });
});
