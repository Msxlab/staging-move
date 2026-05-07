import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("./db", () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "admin-audit-1" }),
    },
  },
}));

import { prisma } from "./db";
import { writeAdminAudit } from "./audit";
import type { AdminSession } from "./auth";

const session: AdminSession = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
};

describe("writeAdminAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts before/after metadata before writing AdminAuditLog", async () => {
    await writeAdminAudit(session, {
      action: "UPDATE",
      entityType: "RuntimeConfig",
      entityId: "cfg-1",
      before: {
        STRIPE_SECRET_KEY: "sk_live_secret",
        publicLabel: "Stripe",
      },
      after: {
        STRIPE_SECRET_KEY: "sk_live_new",
        nested: { databaseUrl: "mysql://user:pass@example/db" },
      },
      metadata: {
        accountNumber: "123456789",
        notes: "private operator note",
      },
      request: {
        ipAddress: "203.0.113.10",
        userAgent: "AdminBrowser/1.0",
      },
    });

    const call = (prisma.adminAuditLog.create as Mock).mock.calls[0][0];
    const stored = call.data.changes as string;

    expect(stored).not.toContain("sk_live_secret");
    expect(stored).not.toContain("sk_live_new");
    expect(stored).not.toContain("mysql://");
    expect(stored).not.toContain("123456789");
    expect(stored).not.toContain("private operator note");
    expect(JSON.parse(stored)).toMatchObject({
      actor: {
        adminId: "admin-1",
        email: "[REDACTED]",
        role: "ADMIN",
        userAgent: "AdminBrowser/1.0",
      },
      before: {
        STRIPE_SECRET_KEY: "[REDACTED]",
        publicLabel: "Stripe",
      },
      after: {
        STRIPE_SECRET_KEY: "[REDACTED]",
        nested: { databaseUrl: "[REDACTED]" },
      },
      metadata: {
        accountNumber: "[REDACTED]",
        notes: "[REDACTED]",
      },
    });
  });
});
