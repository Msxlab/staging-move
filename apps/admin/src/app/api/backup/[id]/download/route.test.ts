import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  backupFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  parseBackupRecordMetadata: vi.fn(),
  downloadBackupArchive: vi.fn(),
  isValidBackupObjectKey: vi.fn(),
  sanitizeBackupFileName: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    backupRecord: {
      findUnique: (...args: unknown[]) => mocks.backupFindUnique(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

vi.mock("@/lib/backup-storage", () => ({
  parseBackupRecordMetadata: (...args: unknown[]) => mocks.parseBackupRecordMetadata(...args),
  downloadBackupArchive: (...args: unknown[]) => mocks.downloadBackupArchive(...args),
  isValidBackupObjectKey: (...args: unknown[]) => mocks.isValidBackupObjectKey(...args),
  sanitizeBackupFileName: (...args: unknown[]) => mocks.sanitizeBackupFileName(...args),
}));

import { GET, POST } from "./route";

function request(body: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/backup/backup_1/download", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });
}

describe("backup archive download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.backupFindUnique.mockResolvedValue({
      id: "backup_1",
      fileName: "backup.json",
      errorMessage: "{}",
    });
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: {
        status: "stored",
        objectKey: "backups/2026-04-24/backup_1/backup.json",
      },
    });
    mocks.isValidBackupObjectKey.mockReturnValue(true);
    mocks.sanitizeBackupFileName.mockImplementation((value: string) => value || "backup.json");
    mocks.downloadBackupArchive.mockResolvedValue({
      content: "{\"ok\":true}",
      contentType: "application/json",
    });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("does not allow GET archive downloads without step-up", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.downloadBackupArchive).not.toHaveBeenCalled();
  });

  it("requires password confirmation before downloading the archive", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required for this operation.",
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "backup_1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.downloadBackupArchive).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: "backup_1",
      }),
    });
  });

  it("downloads and audits the archive after password confirmation", async () => {
    const response = await POST(
      request({ confirmPassword: "admin-password" }),
      { params: Promise.resolve({ id: "backup_1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("{\"ok\":true}");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="backup.json"; filename*=UTF-8\'\'backup.json',
    );
    expect(mocks.downloadBackupArchive).toHaveBeenCalledWith({
      status: "stored",
      objectKey: "backups/2026-04-24/backup_1/backup.json",
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "admin_1",
        action: "BACKUP_DOWNLOAD_SUCCESS",
        entityType: "BackupRecord",
        entityId: "backup_1",
        ipAddress: "203.0.113.10",
      }),
    });
  });

  it("sanitizes hostile backup filenames before emitting download headers", async () => {
    mocks.backupFindUnique.mockResolvedValueOnce({
      id: "backup_1",
      fileName: 'backup"\r\nInjected: yes.json',
      errorMessage: "{}",
    });
    mocks.sanitizeBackupFileName.mockImplementationOnce((value: string) => value || "backup.json");

    const response = await POST(
      request({ confirmPassword: "admin-password" }),
      { params: Promise.resolve({ id: "backup_1" }) },
    );
    const contentDisposition = response.headers.get("Content-Disposition") || "";

    expect(response.status).toBe(200);
    expect(contentDisposition).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.json"; filename\*=UTF-8''[A-Za-z0-9._~-]+\.json$/,
    );
    expect(contentDisposition).not.toContain("\r");
    expect(contentDisposition).not.toContain("\n");
    expect(contentDisposition).not.toContain("Injected:");
  });

  it("rejects invalid offsite object keys before downloading", async () => {
    mocks.isValidBackupObjectKey.mockReturnValue(false);

    const response = await POST(
      request({ confirmPassword: "admin-password", mfaCode: "123456" }),
      { params: Promise.resolve({ id: "backup_1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.downloadBackupArchive).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: "backup_1",
      }),
    });
  });
});
