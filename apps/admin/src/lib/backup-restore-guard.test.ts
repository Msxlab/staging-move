import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/backup-metadata", () => ({
  getCurrentBackupEnvironmentMetadata: vi.fn(),
}));

import { getCurrentBackupEnvironmentMetadata } from "@/lib/backup-metadata";
import { assertRestoreTargetAllowed, RestoreTargetGuardError } from "./backup-restore-guard";

const currentEnvMock = getCurrentBackupEnvironmentMetadata as unknown as ReturnType<typeof vi.fn>;

const STAGING_ENV = {
  name: "staging" as const,
  databaseFingerprint: "fingerprint-staging-aaaaaaaa",
  databaseProvider: "mysql",
  appUrl: null,
};

beforeEach(() => {
  currentEnvMock.mockReturnValue(STAGING_ENV);
});

describe("assertRestoreTargetAllowed — fingerprint missing", () => {
  it("rejects MERGE without an archive fingerprint", () => {
    expect(() =>
      assertRestoreTargetAllowed({
        mode: "MERGE",
        body: {
          targetEnvironment: "staging",
        },
        archiveMetadata: null,
        env: { ALLOW_PRODUCTION_REPLACE_RESTORE: "false" } as any,
      }),
    ).toThrowError(RestoreTargetGuardError);
  });

  it("rejects REPLACE without an archive fingerprint", () => {
    expect(() =>
      assertRestoreTargetAllowed({
        mode: "REPLACE",
        body: {
          targetEnvironment: "staging",
          replaceConfirmation: `REPLACE staging fingerprint-st`,
        },
        archiveMetadata: { environment: null } as any,
        env: { ALLOW_PRODUCTION_REPLACE_RESTORE: "false" } as any,
      }),
    ).toThrowError(/RESTORE_FINGERPRINT_MISSING|fingerprint/i);
  });

  it("allows missing fingerprint with explicit override phrase", () => {
    const result = assertRestoreTargetAllowed({
      mode: "MERGE",
      body: {
        targetEnvironment: "staging",
        allowMissingFingerprint: true,
        missingFingerprintConfirmation: `IMPORT WITHOUT FINGERPRINT INTO staging`,
      },
      archiveMetadata: null,
      env: { ALLOW_PRODUCTION_REPLACE_RESTORE: "false" } as any,
    });
    expect(result.warnings.some((w) => w.includes("fingerprint"))).toBe(true);
  });

  it("DRY_RUN bypasses fingerprint requirements", () => {
    const result = assertRestoreTargetAllowed({
      mode: "DRY_RUN",
      body: {},
      archiveMetadata: null,
      env: {} as any,
    });
    expect(result.warnings).toEqual([]);
  });
});
