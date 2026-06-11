import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminRuntimeConfigValues: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValues: (...args: unknown[]) =>
    mocks.getAdminRuntimeConfigValues(...args),
}));
vi.mock("@/lib/backup-metadata", () => ({
  redactBackupMetadata: (metadata: unknown) => metadata,
}));

import {
  deleteBackupArchive,
  isOffsiteRetentionDeleteEnabled,
  type BackupOffsiteMetadata,
} from "./backup-storage";

const READY_STORAGE_CONFIG = {
  BACKUP_STORAGE_PROVIDER: "s3",
  BACKUP_STORAGE_BUCKET: "locateflow-backups",
  BACKUP_STORAGE_REGION: "us-east-1",
  BACKUP_STORAGE_ENDPOINT: "https://storage.example.com",
  BACKUP_STORAGE_ACCESS_KEY_ID: "AKIAEXAMPLE12345",
  BACKUP_STORAGE_SECRET_ACCESS_KEY: "super-secret-backup-key-123456",
};

function storedOffsite(
  overrides: Partial<BackupOffsiteMetadata> = {},
): BackupOffsiteMetadata {
  return {
    status: "stored",
    provider: "s3",
    bucket: "locateflow-backups",
    region: "us-east-1",
    endpoint: "https://storage.example.com",
    objectKey: "backups/20260601/backup_1/backup-file.json",
    location:
      "s3://locateflow-backups/backups/20260601/backup_1/backup-file.json",
    uploadedAt: "2026-06-01T00:00:00.000Z",
    reason: null,
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminRuntimeConfigValues.mockResolvedValue({
    ...READY_STORAGE_CONFIG,
  });
  fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => "" });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isOffsiteRetentionDeleteEnabled", () => {
  it("defaults to false when the flag is unset", async () => {
    mocks.getAdminRuntimeConfigValues.mockResolvedValue({
      BACKUP_RETENTION_DELETE_OFFSITE: null,
    });
    await expect(isOffsiteRetentionDeleteEnabled()).resolves.toBe(false);
  });

  it("only the exact string 'true' enables deletion", async () => {
    for (const value of ["false", "TRUE", "1", "yes", " enabled "]) {
      mocks.getAdminRuntimeConfigValues.mockResolvedValue({
        BACKUP_RETENTION_DELETE_OFFSITE: value,
      });
      await expect(isOffsiteRetentionDeleteEnabled()).resolves.toBe(false);
    }

    mocks.getAdminRuntimeConfigValues.mockResolvedValue({
      BACKUP_RETENTION_DELETE_OFFSITE: "true",
    });
    await expect(isOffsiteRetentionDeleteEnabled()).resolves.toBe(true);
  });
});

describe("deleteBackupArchive safety rails", () => {
  it("refuses keys outside the backups/ prefix without contacting storage", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite({
        objectKey: "uploads/backup_1/backup-file.json",
      }),
    });

    expect(result.outcome).toBe("refused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses keys that do not belong to the backup record", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite({
        objectKey: "backups/20260601/another_backup/backup-file.json",
      }),
    });

    expect(result.outcome).toBe("refused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses traversal-shaped keys", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite({
        objectKey: "backups/../private/backup_1/backup-file.json",
      }),
    });

    expect(result.outcome).toBe("refused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses missing object keys", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite({ objectKey: null }),
    });

    expect(result.outcome).toBe("refused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses cross-bucket deletes when the record's bucket differs from config", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite({ bucket: "some-other-bucket" }),
    });

    expect(result.outcome).toBe("refused");
    expect(result.reason).toContain("some-other-bucket");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails (row preserved) when backup storage is not configured", async () => {
    mocks.getAdminRuntimeConfigValues.mockResolvedValue({
      BACKUP_STORAGE_PROVIDER: null,
      BACKUP_STORAGE_BUCKET: null,
      BACKUP_STORAGE_REGION: null,
      BACKUP_STORAGE_ENDPOINT: null,
      BACKUP_STORAGE_ACCESS_KEY_ID: null,
      BACKUP_STORAGE_SECRET_ACCESS_KEY: null,
    });

    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite(),
    });

    expect(result.outcome).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deleteBackupArchive delete request", () => {
  it("issues a single SigV4 DELETE for the exact stored key", async () => {
    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite(),
    });

    expect(result.outcome).toBe("deleted");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe(
      "https://storage.example.com/locateflow-backups/backups/20260601/backup_1/backup-file.json",
    );
    expect(requestInit.method).toBe("DELETE");
    expect(requestInit.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(requestInit.headers["x-amz-content-sha256"]).toBeTruthy();
    expect(requestInit.headers["x-amz-date"]).toBeTruthy();
  });

  it("treats 404 as already deleted offsite", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "NoSuchKey",
    });

    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite(),
    });

    expect(result.outcome).toBe("deleted");
    expect(result.reason).toContain("already absent");
  });

  it("reports failure on a non-OK storage response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "InternalError",
    });

    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite(),
    });

    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("500");
  });

  it("reports failure when the storage request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await deleteBackupArchive({
      backupId: "backup_1",
      offsite: storedOffsite(),
    });

    expect(result.outcome).toBe("failed");
    expect(result.reason).toBe("network down");
  });
});
