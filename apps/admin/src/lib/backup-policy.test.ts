import { describe, expect, it } from "vitest";
import {
  BACKUP_ARCHIVE_MAX_BYTES,
  BACKUP_ARCHIVE_WARN_BYTES,
  BackupPolicyError,
  MAX_BACKUP_DOWNLOAD_BYTES,
  MAX_BACKUP_IMPORT_BYTES,
  MAX_BACKUP_VERIFY_BYTES,
  evaluateBackupArchiveSize,
  requestBodyTooLarge,
} from "./backup-policy";

describe("backup archive size policy", () => {
  it("allows normal backup archive sizes", () => {
    expect(evaluateBackupArchiveSize(1024)).toEqual({ ok: true, warning: null });
  });

  it("warns once archives exceed the cost guard threshold", () => {
    const result = evaluateBackupArchiveSize(BACKUP_ARCHIVE_WARN_BYTES);
    expect(result.ok).toBe(true);
    expect(result.warning).toContain("500 MB");
  });

  it("rejects archives over the hard safety limit", () => {
    expect(() => evaluateBackupArchiveSize(BACKUP_ARCHIVE_MAX_BYTES + 1)).toThrow(
      BackupPolicyError,
    );
  });

  it("sets lower synchronous route limits for import, verify, and download", () => {
    expect(MAX_BACKUP_IMPORT_BYTES).toBeLessThan(BACKUP_ARCHIVE_MAX_BYTES);
    expect(MAX_BACKUP_VERIFY_BYTES).toBeLessThan(BACKUP_ARCHIVE_MAX_BYTES);
    expect(MAX_BACKUP_DOWNLOAD_BYTES).toBeLessThan(BACKUP_ARCHIVE_MAX_BYTES);
  });

  it("detects oversized request bodies from content-length", () => {
    const request = new Request("https://admin.locateflow.com/api/backup/import", {
      headers: { "Content-Length": `${MAX_BACKUP_IMPORT_BYTES + 1}` },
    });

    expect(requestBodyTooLarge(request, MAX_BACKUP_IMPORT_BYTES)).toBe(true);
  });
});
