import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    supportTicket: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "ticket-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/email-service", () => ({
  sendSupportTicketCreatedEmail: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { GET, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockRateLimit = rateLimit as unknown as Mock;
const mockSupportTicket = prisma.supportTicket as unknown as {
  findMany: Mock;
  count: Mock;
  create: Mock;
};

function request(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/tickets", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

describe("support ticket collection auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockSupportTicket.findMany.mockResolvedValue([]);
    mockSupportTicket.count.mockResolvedValue(0);
    mockSupportTicket.create.mockResolvedValue({
      id: "ticket-1",
      user: null,
      messages: [],
    });
  });

  it("returns 401 instead of a generic 500 when listing unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockSupportTicket.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 before rate-limit or create work when creating unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await POST(request({
      subject: "Billing question",
      message: "Please help me understand my invoice.",
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockSupportTicket.create).not.toHaveBeenCalled();
  });
});
