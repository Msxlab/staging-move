import { describe, expect, it } from "vitest";
import { buildRestoreImportPayload } from "./backup-control-plane";

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
});

