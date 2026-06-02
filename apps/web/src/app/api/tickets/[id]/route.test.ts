import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    supportTicket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "ticket-reply-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { GET, PATCH, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockRateLimit = rateLimit as unknown as Mock;
const mockSupportTicket = prisma.supportTicket as unknown as {
  findUnique: Mock;
  update: Mock;
};
const mockTicketMessage = (prisma as any).ticketMessage as { create: Mock };

function params() {
  return { params: Promise.resolve({ id: "ticket-1" }) };
}

function request(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/tickets/ticket-1", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

describe("support ticket detail auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockSupportTicket.findUnique.mockResolvedValue({ id: "ticket-1", userId: "user-1", status: "OPEN" });
    mockSupportTicket.update.mockResolvedValue({});
    mockTicketMessage.create.mockResolvedValue({});
  });

  it("returns 401 instead of a generic 500 when reading unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request(), params());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockSupportTicket.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 before rate-limit or reply work when replying unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await POST(request({ message: "Thanks for the update." }), params());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockTicketMessage.create).not.toHaveBeenCalled();
  });

  it("returns 401 before closing work when closing unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await PATCH(request(), params());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockSupportTicket.update).not.toHaveBeenCalled();
  });
});
