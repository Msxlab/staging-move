import { describe, expect, it } from "vitest";
import {
  MAX_BACKUP_UI_UPLOAD_BYTES,
  buildDryRunImportPayload,
  buildRestoreImportPayload,
  buildStepUpPayload,
  isStepUpSubmitDisabled,
} from "./backup-control-plane";

describe("backup restore UI payload", () => {
  it("sends the target environment confirmation for MERGE restores", () => {
    const payload = buildRestoreImportPayload({
      importPayload: { archive: { version: 1 } },
      tables: ["users"],
      mode: "MERGE",
      targetEnvironment: "staging",
    });

    expect(payload).toMatchObject({
      archive: { version: 1 },
      tables: ["users"],
      mode: "MERGE",
      targetEnvironment: "staging",
    });
    expect(payload).not.toHaveProperty("replaceConfirmation");
  });

  it("sends replace and production restore confirmations for REPLACE restores", () => {
    const payload = buildRestoreImportPayload({
      importPayload: { archive: { version: 1 } },
      tables: ["users"],
      mode: "REPLACE",
      targetEnvironment: "production",
      replaceConfirmation: "REPLACE production abcdef123456",
      productionRestoreConfirmation: "RESTORE PRODUCTION abcdef123456",
    });

    expect(payload).toMatchObject({
      mode: "REPLACE",
      targetEnvironment: "production",
      replaceConfirmation: "REPLACE production abcdef123456",
      productionRestoreConfirmation: "RESTORE PRODUCTION abcdef123456",
    });
  });

  it("sends MFA and backup code fields with step-up payloads", () => {
    const payload = buildStepUpPayload(
      { mode: "MERGE", tables: ["users"] },
      {
        confirmPassword: "correct horse",
        mfaCode: "123456",
        backupCode: "backup-code-1",
      },
    );

    expect(payload).toMatchObject({
      mode: "MERGE",
      tables: ["users"],
      confirmPassword: "correct horse",
      mfaCode: "123456",
      backupCode: "backup-code-1",
    });
  });

  it("builds dry-run import payloads through the shared restore step-up flow", () => {
    expect(
      buildDryRunImportPayload({
        importPayload: { archive: { version: 1 } },
        tables: ["users"],
      }),
    ).toMatchObject({
      archive: { version: 1 },
      tables: ["users"],
      mode: "DRY_RUN",
    });
  });

  it("keeps browser import reads under the synchronous upload limit", () => {
    expect(MAX_BACKUP_UI_UPLOAD_BYTES).toBeLessThanOrEqual(25 * 1024 * 1024);
  });

  it("matches the server step-up rule by requiring MFA or a backup code when requested", () => {
    expect(
      isStepUpSubmitDisabled({
        password: "",
        requireMfa: true,
      }),
    ).toBe(true);
    expect(
      isStepUpSubmitDisabled({
        password: "correct horse",
        requireMfa: true,
      }),
    ).toBe(true);
    expect(
      isStepUpSubmitDisabled({
        password: "correct horse",
        mfaCode: "123456",
        requireMfa: true,
      }),
    ).toBe(false);
    expect(
      isStepUpSubmitDisabled({
        password: "correct horse",
        backupCode: "backup-code-1",
        requireMfa: true,
      }),
    ).toBe(false);
    expect(
      isStepUpSubmitDisabled({
        password: "correct horse",
        requireMfa: false,
      }),
    ).toBe(false);
  });
});
