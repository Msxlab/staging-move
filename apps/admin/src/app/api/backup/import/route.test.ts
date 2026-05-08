import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentBackupEnvironmentMetadata,
} from "@/lib/backup-metadata";
import {
  getProductionRestoreConfirmationPhrase,
  getReplaceConfirmationPhrase,
} from "@/lib/backup-restore-guard";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    profile: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    serviceProvider: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    serviceProviderCoverage: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    address: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    movingPlan: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    userCustomProvider: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    service: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    moveTask: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    budget: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    subscription: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    notification: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    auditLog: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    providerGovernanceIssue: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
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

// `prismaUnsafe` is imported by the route for REPLACE so deleteMany is a
// real delete instead of being rewritten to soft-delete by the default
// extension. The test fixture aliases both names to the same mock object.
vi.mock("@/lib/db", () => ({
  prisma: mocks.prisma,
  prismaUnsafe: mocks.prisma,
  rawPrisma: mocks.prisma,
}));
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
    vi.unstubAllEnvs();
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

  it("rejects signed MERGE restore into the wrong target environment", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://admin:target-secret@target.example.com:3306/staging",
    );
    const rawContent = JSON.stringify({
      metadata: {
        environment: {
          name: "production",
          nodeEnv: "production",
          appEnv: "production",
          vercelEnv: null,
          digitalOceanAppIdPresent: true,
          databaseFingerprint: "different-fingerprint",
        },
      },
      data: { users: [{ id: "user_1" }] },
    });

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "MERGE",
      confirmPassword: "correct horse",
      targetEnvironment: "staging",
      signature: "good",
      rawContent,
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "RESTORE_ENVIRONMENT_MISMATCH",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires a strong REPLACE confirmation phrase", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DATABASE_URL", "mysql://admin:secret@target.example.com/staging");
    const target = getCurrentBackupEnvironmentMetadata();
    const rawContent = JSON.stringify({
      metadata: {
        environment: {
          name: target.name,
          databaseFingerprint: target.databaseFingerprint,
        },
      },
      data: { users: [{ id: "user_1" }] },
    });

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "REPLACE",
      confirmPassword: "correct horse",
      targetEnvironment: "staging",
      signature: "good",
      rawContent,
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "RESTORE_REPLACE_CONFIRMATION_REQUIRED",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks production REPLACE without the approved production restore flag", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://admin:secret@target.example.com/prod");
    const target = getCurrentBackupEnvironmentMetadata();
    const rawContent = JSON.stringify({
      metadata: {
        environment: {
          name: target.name,
          databaseFingerprint: target.databaseFingerprint,
        },
      },
      data: { users: [{ id: "user_1" }] },
    });

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "REPLACE",
      confirmPassword: "correct horse",
      targetEnvironment: "production",
      replaceConfirmation: getReplaceConfirmationPhrase(target),
      signature: "good",
      rawContent,
    }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "RESTORE_PRODUCTION_REPLACE_BLOCKED",
      details: { approvedByEnv: false },
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows production REPLACE only when the flag and confirmations are present", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://admin:secret@target.example.com/prod");
    vi.stubEnv("ALLOW_PRODUCTION_REPLACE_RESTORE", "true");
    const target = getCurrentBackupEnvironmentMetadata();
    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        user: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({}),
        },
      }),
    );
    const rawContent = JSON.stringify({
      metadata: {
        environment: {
          name: target.name,
          databaseFingerprint: target.databaseFingerprint,
        },
      },
      data: { users: [{ id: "user_1" }] },
    });

    const { POST } = await import("./route");
    const res = await POST(jsonRequest({
      mode: "REPLACE",
      confirmPassword: "correct horse",
      targetEnvironment: "production",
      replaceConfirmation: getReplaceConfirmationPhrase(target),
      productionRestoreConfirmation:
        getProductionRestoreConfirmationPhrase(target),
      signature: "good",
      rawContent,
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      mode: "REPLACE",
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalled();
  });
});
