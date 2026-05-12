import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "backup-audit-1" }),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  redactBackupAuditMetadata,
  writeBackupAudit,
} from "./backup-audit";

describe("writeBackupAudit metadata redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts dangerous metadata recursively while preserving safe restore metadata", async () => {
    await writeBackupAudit({
      session: {
        adminId: "admin_1",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
      },
      action: "BACKUP_RESTORE_MERGE_FAILED",
      entityId: "restore_1",
      request: new Request("https://admin.locateflow.com/api/backup/import", {
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "user-agent": "vitest",
        },
      }),
      metadata: {
        backupId: "backup_1",
        mode: "MERGE",
        selectedTables: ["users", "profiles"],
        targetEnvironment: "production",
        safetyBackupId: "backup_safety_1",
        rowCounts: { users: 2, profiles: 1 },
        status: "FAILED",
        operation: "restore",
        password: "admin-password",
        nested: {
          mfaCode: "123456",
          backupCode: "recovery-code",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          archive: { data: { users: [{ email: "user@example.com" }] } },
          archiveContent: "{\"data\":{\"users\":[]}}",
          rawContent: "{\"data\":{\"profiles\":[]}}",
          signatureInput: "signed bytes",
          credential: "provider-secret",
          authorization: "Bearer secret-token",
          cookie: "session=secret",
          encryptionKey: "0123456789abcdef",
          privateKey: "private-key",
        },
      },
    });

    const call = (prisma.adminAuditLog.create as Mock).mock.calls[0][0];
    const changes = JSON.parse(call.data.changes);
    const serialized = call.data.changes as string;

    expect(serialized).not.toContain("admin-password");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("recovery-code");
    expect(serialized).not.toContain("access-token");
    expect(serialized).not.toContain("refresh-token");
    expect(serialized).not.toContain("user@example.com");
    expect(serialized).not.toContain("signed bytes");
    expect(serialized).not.toContain("provider-secret");
    expect(serialized).not.toContain("Bearer secret-token");
    expect(serialized).not.toContain("session=secret");
    expect(serialized).not.toContain("0123456789abcdef");
    expect(serialized).not.toContain("private-key");

    expect(changes).toMatchObject({
      backupId: "backup_1",
      mode: "MERGE",
      selectedTables: ["users", "profiles"],
      targetEnvironment: "production",
      safetyBackupId: "backup_safety_1",
      rowCounts: { users: 2, profiles: 1 },
      status: "FAILED",
      operation: "restore",
      password: "[REDACTED]",
      nested: {
        mfaCode: "[REDACTED]",
        backupCode: "[REDACTED]",
        accessToken: "[REDACTED]",
        refreshToken: "[REDACTED]",
        archive: "[REDACTED]",
        archiveContent: "[REDACTED]",
        rawContent: "[REDACTED]",
        signatureInput: "[REDACTED]",
        credential: "[REDACTED]",
        authorization: "[REDACTED]",
        cookie: "[REDACTED]",
        encryptionKey: "[REDACTED]",
        privateKey: "[REDACTED]",
      },
    });
  });

  it("handles unusual metadata values without throwing", () => {
    const circular: Record<string, unknown> = { backupId: "backup_1" };
    circular.self = circular;

    expect(() =>
      redactBackupAuditMetadata({
        backupId: "backup_1",
        count: BigInt(3),
        callback: () => undefined,
        marker: Symbol("marker"),
        circular,
      }),
    ).not.toThrow();

    expect(
      redactBackupAuditMetadata({
        backupId: "backup_1",
        count: BigInt(3),
        callback: () => undefined,
        circular,
      }),
    ).toMatchObject({
      backupId: "backup_1",
      count: "3",
      callback: "[UNSERIALIZABLE]",
      circular: {
        backupId: "backup_1",
        self: "[CIRCULAR]",
      },
    });
  });
});
