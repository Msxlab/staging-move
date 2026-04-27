import { describe, expect, it } from "vitest";
import {
  BACKUP_ARCHIVE_MAX_BYTES,
  BACKUP_ARCHIVE_WARN_BYTES,
  BackupPolicyError,
  evaluateBackupArchiveSize,
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
});
