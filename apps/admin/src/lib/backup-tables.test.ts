import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, BACKUP_TABLE_ORDER } from "./backup-tables";

describe("backup table catalog", () => {
  it("includes recoverable admin, consent, email, and OAuth evidence tables", () => {
    expect(BACKUP_TABLES.adminUsers.model).toBe("adminUser");
    expect(BACKUP_TABLES.adminPermissions.model).toBe("adminPermission");
    expect(BACKUP_TABLES.adminAuditLogs.model).toBe("adminAuditLog");
    expect(BACKUP_TABLES.adminLoginLogs.model).toBe("adminLoginLog");
    expect(BACKUP_TABLES.dataConsents.model).toBe("dataConsent");
    expect(BACKUP_TABLES.emailLogs.model).toBe("emailLog");
    expect(BACKUP_TABLES.oauthAccounts.model).toBe("oAuthAccount");
    expect(BACKUP_TABLES.providerLogoCandidates.model).toBe(
      "providerLogoCandidate",
    );
  });

  it("keeps runtime secrets and active sessions out of app-level backups", () => {
    const tableNames = new Set(BACKUP_TABLE_ORDER);

    expect(tableNames.has("adminUsers")).toBe(true);
    expect(tableNames.has("adminAuditLogs")).toBe(true);
    expect(tableNames.has("adminLoginLogs")).toBe(true);

    expect(tableNames.has("adminSessions" as never)).toBe(false);
    expect(tableNames.has("userLoginSessions" as never)).toBe(false);
    expect(tableNames.has("runtimeConfigEntries" as never)).toBe(false);
    expect(tableNames.has("passwordResetTokens" as never)).toBe(false);
  });
});
