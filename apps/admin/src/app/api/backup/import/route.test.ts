import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    requirePermission: vi.fn(),
    requirePasswordConfirm: vi.fn(),
    parseBackupArchive: vi.fn(),
    verifyBackupSignature: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));
vi.mock("@/lib/backup-archive", () => ({
  parseBackupArchive: mocks.parseBackupArchive,
}));
vi.mock("@/lib/backup-tables", () => ({
  BACKUP_TABLES: {
    users: { model: "user" },
  },
  getBackupDependencyWarnings: vi.fn(() => []),
  getReplaceSafetyIssues: vi.fn(() => []),
  normalizeBackupTables: vi.fn((tables: string[]) => tables.filter((table) => table === "users")),
}));
vi.mock("@/lib/shared-encryption", () => ({
  decryptBackup: vi.fn(),
  verifyBackupSignature: mocks.verifyBackupSignature,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/backup/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("backup import signature enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.parseBackupArchive.mockReturnValue(null);
    mocks.verifyBackupSignature.mockReturnValue(true);
    mocks.prisma.user.count.mockResolvedValue(0);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
  });

  it("rejects unsigned MERGE imports", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "MERGE",
      confirmPassword: "correct horse",
      data: { users: [{ id: "user_1" }] },
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("MERGE mode requires a backup signature"),
    });
  });

  it("rejects tampered signed MERGE imports", async () => {
    mocks.verifyBackupSignature.mockReturnValue(false);
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "MERGE",
      confirmPassword: "correct horse",
      signature: "bad",
      rawContent: "{\"data\":{\"users\":[]}}",
      data: { users: [{ id: "user_1" }] },
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("signature verification failed"),
    });
  });

  it("allows unsigned DRY_RUN and reports signatureVerified false", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "DRY_RUN",
      data: { users: [{ id: "user_1" }] },
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      mode: "DRY_RUN",
      signatureVerified: false,
    });
  });
});
