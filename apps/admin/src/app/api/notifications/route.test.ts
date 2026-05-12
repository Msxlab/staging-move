import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    notificationQueue: {
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("admin notification send boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.prisma.user.count.mockResolvedValue(1);
  });

  it("rejects unsupported delivery channels before creating records", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      title: "Policy update",
      body: "Please review the latest policy.",
      channel: "SMS",
      userId: "user_1",
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid notification payload");
    // The Zod enum rejection should call out the channel field so the
    // operator knows which input was wrong — a generic 400 with no
    // detail is what regressed in the prior pass and what the original
    // assertion was guarding against.
    expect(JSON.stringify(body.details)).toContain("channel");
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
    expect(mocks.prisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  it("rejects future scheduling before creating records", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      title: "Maintenance",
      body: "Planned maintenance notice.",
      channel: "IN_APP",
      userId: "user_1",
      sendAt: new Date(Date.now() + 60_000).toISOString(),
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("Scheduled notification delivery is not enabled"),
    });
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
    expect(mocks.prisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  it("requires password step-up before irreversible EMAIL or PUSH broadcasts", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Confirm your password before broadcasting notifications.",
    });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      title: "Broadcast",
      body: "Important announcement.",
      channel: "EMAIL",
      broadcast: true,
    }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1" },
      undefined,
      { operation: "notification_broadcast" },
    );
    expect(mocks.prisma.notification.createMany).not.toHaveBeenCalled();
    expect(mocks.prisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  it("does not require step-up for IN_APP-only broadcasts (reversible feed writes)", async () => {
    // Channel IN_APP just inserts rows in the user feed which an admin
    // can soft-delete from the queue UI. Forcing a password modal every
    // time turned the broadcast button into "operators avoid using it"
    // — see the May 2026 admin-friction audit. Step-up still gates the
    // EMAIL and PUSH channels (test above) where delivery is one-way.
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.count.mockResolvedValue(0);
    mocks.prisma.notificationQueue.create.mockResolvedValue({ id: "q1" });
    mocks.prisma.adminAuditLog.create.mockResolvedValue({ id: "a1" });

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      title: "Broadcast",
      body: "Important announcement.",
      channel: "IN_APP",
      broadcast: true,
    }));

    expect(res.status).toBe(200);
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
    expect(mocks.prisma.notificationQueue.create).toHaveBeenCalled();
  });
});
