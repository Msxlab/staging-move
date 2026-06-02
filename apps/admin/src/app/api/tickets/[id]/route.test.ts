import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  ticketFindUnique: vi.fn(),
  ticketUpdate: vi.fn(),
  messageCreate: vi.fn(),
  auditCreate: vi.fn(),
  adminFindFirst: vi.fn(),
  sendReplyEmail: vi.fn(),
  sendStatusEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    supportTicket: {
      findUnique: (...args: unknown[]) => mocks.ticketFindUnique(...args),
      update: (...args: unknown[]) => mocks.ticketUpdate(...args),
    },
    ticketMessage: {
      create: (...args: unknown[]) => mocks.messageCreate(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
    adminUser: {
      findFirst: (...args: unknown[]) => mocks.adminFindFirst(...args),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendSupportTicketReplyEmail: (...args: unknown[]) => mocks.sendReplyEmail(...args),
  sendSupportTicketStatusEmail: (...args: unknown[]) => mocks.sendStatusEmail(...args),
}));

import { PATCH, POST } from "./route";

function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/tickets/ticket_1", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.30" },
    body: JSON.stringify(body),
  });
}

function ticket(status = "OPEN") {
  return {
    id: "ticket_1",
    subject: "Billing issue",
    status,
    priority: "MEDIUM",
    category: "BILLING",
    assignedTo: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    user: {
      email: "user@example.com",
      firstName: "User",
      deletedAt: null,
    },
  };
}

describe("admin ticket detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.ticketFindUnique.mockResolvedValue(ticket());
    mocks.ticketUpdate.mockResolvedValue({ id: "ticket_1", status: "IN_PROGRESS" });
    mocks.messageCreate.mockResolvedValue({ id: "msg_1", ticketId: "ticket_1" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.adminFindFirst.mockResolvedValue({ id: "admin_2" });
    mocks.sendReplyEmail.mockResolvedValue({});
    mocks.sendStatusEmail.mockResolvedValue({});
  });

  it("blocks external replies on closed tickets instead of reopening them", async () => {
    mocks.ticketFindUnique.mockResolvedValue(ticket("CLOSED"));

    const response = await POST(request("POST", { message: "Can you send more detail?" }), {
      params: Promise.resolve({ id: "ticket_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/internal notes/);
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
    expect(mocks.sendReplyEmail).not.toHaveBeenCalled();
  });

  it("still allows internal notes on closed tickets", async () => {
    mocks.ticketFindUnique.mockResolvedValue(ticket("CLOSED"));

    const response = await POST(
      request("POST", { message: "Historical note for support only.", isInternal: true }),
      { params: Promise.resolve({ id: "ticket_1" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: "ticket_1",
        senderType: "ADMIN",
        isInternal: true,
      }),
    });
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
    expect(mocks.sendReplyEmail).not.toHaveBeenCalled();
  });

  it("rejects assignment to a missing or inactive admin", async () => {
    mocks.adminFindFirst.mockResolvedValue(null);

    const response = await PATCH(request("PATCH", { assignedTo: "admin_missing" }), {
      params: Promise.resolve({ id: "ticket_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Assigned admin not found");
    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
  });

  it("allows assignment to an active admin", async () => {
    const response = await PATCH(request("PATCH", { assignedTo: "admin_2" }), {
      params: Promise.resolve({ id: "ticket_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.adminFindFirst).toHaveBeenCalledWith({
      where: { id: "admin_2", isActive: true },
      select: { id: true },
    });
    expect(mocks.ticketUpdate).toHaveBeenCalledWith({
      where: { id: "ticket_1" },
      data: { assignedTo: "admin_2" },
    });
  });
});
