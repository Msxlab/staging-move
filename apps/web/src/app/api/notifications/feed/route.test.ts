import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { GET, PATCH } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockNotification = prisma.notification as unknown as {
  findMany: Mock;
  count: Mock;
  updateMany: Mock;
};

function request(path = "http://localhost/api/notifications/feed") {
  return new Request(path) as any;
}

describe("notification feed auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockNotification.findMany.mockResolvedValue([]);
    mockNotification.count.mockResolvedValue(0);
    mockNotification.updateMany.mockResolvedValue({ count: 0 });
  });

  it("returns 401 instead of a generic 500 when the feed is read unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockNotification.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 instead of a generic 500 when read-all is unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await PATCH(request("http://localhost/api/notifications/feed?action=read-all"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockNotification.updateMany).not.toHaveBeenCalled();
  });
});
