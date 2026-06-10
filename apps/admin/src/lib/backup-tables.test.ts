import { describe, expect, it } from "vitest";
import { Prisma } from "@locateflow/db";
import {
  BACKUP_TABLES,
  BACKUP_TABLE_ORDER,
  fetchAllRecords,
  MAX_BACKUP_ROWS_PER_TABLE,
} from "./backup-tables";

// The set of Prisma models that the team has explicitly decided to
// EXCLUDE from app-level backups. Anything here is documented; anything
// missing both from BACKUP_TABLES and from this set will fail the
// coverage test below — the goal is that NO Prisma model can quietly
// be added to the schema without a deliberate inclusion or exclusion
// decision.
//
// Sessions/tokens/runtime-config/webhook-event tables are intentionally
// excluded so backups don't carry credentials or already-revoked auth
// state. Add any future models here with a one-line reason.
const INTENTIONALLY_EXCLUDED_MODELS: ReadonlySet<string> = new Set([
  "AdminSession", // active admin JWTs — would re-grant access on restore
  "UserLoginSession", // user JWT tokens — same reason
  "UserSession", // analytics session rows; rebuilt from user activity
  "RuntimeConfigEntry", // secrets are managed via the runtime-config UI, not restored
  "PasswordResetToken", // already-issued reset tokens — never restore live tokens
  "EmailVerificationToken", // same as above
  "MobileOAuthCode", // single-use OAuth exchange codes
  "OAuthState", // short-lived OAuth state/nonce replay guard
  "ProcessedWebhookEvent", // dedupe ledger; safe to rebuild
  "RateLimitLog", // observability table, low value at restore time
  "UserEvent", // analytics events; rebuild via re-instrumentation
  "GDPRRequest", // pending request rows; restoring stale ones is harmful
  "BackupRecord", // never back up the backup index — chicken/egg
  "BlogView", // analytics, ephemeral
  "BlogRevision", // editorial history; large; not part of recovery scope
  "PushDevice", // device tokens rotate; restore is harmful
  "Notification", // user-facing notifications; intentionally excluded
  "NotificationQueue",
  "NotificationPreference",
  "WaitlistSignup",
  "BlogPostTag", // composite-key join table; reconstructed from BlogPost rebuild
  "HelpArticle",
  "FAQ",
  "EmailTemplate",
  "FeatureFlag",
  "IPRule",
  "StateRule",
  "SupportTicket",
  "TicketMessage",
  "Reminder",
  "PartnerConsent", // holds encrypted OAuth tokens — restoring stale grants re-grants revoked partner access (same rationale as session/token tables)
  "ConnectorConfig", // runtime control-plane config managed via the admin UI, not restored (same as FeatureFlag)
  "ConnectorDispatch", // operational connector-sync ledger; restoring stale rows could re-trigger processing and carries stale encrypted confirmations
  // Workspace foundation (Family/Pro). Empty + flag-off in Phase 1. TODO: when
  // the workspace backfill runs and the feature launches, promote Workspace and
  // WorkspaceMember to BACKUP_TABLES (ordered after `users`); they are core data.
  "Workspace",
  "WorkspaceMember",
  "WorkspaceInvitation", // pending invites with hashed tokens — transient/expiring, not restored (token-table rationale)
  "WorkspaceAuthChallenge", // short-lived step-up challenges — never restore live auth state
  "AdminSetPasswordToken", // single-use, expiring admin invite/set-password tokens — never restore live token state (same rationale as PasswordResetToken)
  "AdminActionOtp", // single-use, expiring admin step-up OTP hashes — never restore live token state (same token-table rationale)
  "ServiceCostLog", // per-service monthly cost history; derived budget telemetry rebuilt as services accrue — PITR covers point-in-time recovery
  "SavedProvider", // convenience provider shortlist; user-rebuildable, low disaster-recovery value (same rationale as NotificationPreference)
  "RecommendationFeedback", // per-user recommendation dismiss/snooze signal; regenerates through use, low recovery value (same rationale as UserEvent)
  "IntegrationDailyStat", // rebuildable telemetry counters (trend-grade observability); PITR covers recovery (same rationale as RateLimitLog)
  "MovingCompany", // re-importable from the public FMCSA census via scripts/etl-fmcsa-movers.mjs — source of truth is external
]);

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
    expect(BACKUP_TABLES.addressChangeEvents.model).toBe("addressChangeEvent");
    expect(BACKUP_TABLES.connectorFallbackActions.model).toBe(
      "connectorFallbackAction",
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

  it("accounts for every Prisma model — included or explicitly excluded", () => {
    // Iterate the live Prisma DMMF so adding a model to schema.prisma
    // forces a decision: include it in BACKUP_TABLES or list it in
    // INTENTIONALLY_EXCLUDED_MODELS with a one-line reason. This is the
    // mechanism that prevents future "I forgot to add the new table to
    // backups" gaps from re-emerging.
    const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name);

    // Model names backed by BACKUP_TABLES — Prisma DMMF uses PascalCase,
    // BACKUP_TABLES values use camelCase, so normalise via simple capitalisation.
    const includedPrismaNames = new Set(
      Object.values(BACKUP_TABLES).map((entry) => {
        const m = entry.model;
        return m.charAt(0).toUpperCase() + m.slice(1);
      }),
    );

    const orphans: string[] = [];
    for (const modelName of dmmfModels) {
      if (includedPrismaNames.has(modelName)) continue;
      if (INTENTIONALLY_EXCLUDED_MODELS.has(modelName)) continue;
      orphans.push(modelName);
    }

    expect(
      orphans,
      `Models lack a backup decision: add to BACKUP_TABLES or to INTENTIONALLY_EXCLUDED_MODELS with a reason.`,
    ).toEqual([]);
  });
});

describe("fetchAllRecords", () => {
  it("paginates with a cursor and stops when a batch is short", async () => {
    // Synthesize 12_001 rows; page size is 5_000 so we expect 3 batches
    // (5000, 5000, 2001) with the third being short and ending the loop.
    const rows = Array.from({ length: 12_001 }, (_, i) => ({ id: `id_${i.toString().padStart(6, "0")}` }));
    const calls: Array<{ take: number; cursor?: string }> = [];
    const mockClient = {
      user: {
        findMany: async (args: any) => {
          calls.push({ take: args.take, cursor: args.cursor?.id });
          let start = 0;
          if (args.cursor?.id) {
            const idx = rows.findIndex((r) => r.id === args.cursor.id);
            if (idx >= 0) start = idx + 1;
          }
          return rows.slice(start, start + args.take);
        },
      },
    };
    const result = await fetchAllRecords(mockClient as any, "users");
    expect(result.fetched).toBe(12_001);
    expect(result.truncated).toBe(false);
    expect(calls.length).toBe(3);
  });

  it("flags truncated when the per-table ceiling is hit", async () => {
    // Generate just past the ceiling so the post-loop probe finds another row.
    const total = MAX_BACKUP_ROWS_PER_TABLE + 1;
    const mockClient = {
      user: {
        findMany: async (args: any) => {
          // Simplified: return up to `take` rows from a virtual range until
          // we've yielded `total` distinct ids.
          const cursorId = args.cursor?.id as string | undefined;
          const startIdx = cursorId ? Number.parseInt(cursorId, 10) + 1 : 0;
          const endIdx = Math.min(startIdx + args.take, total);
          if (startIdx >= total) return [];
          return Array.from({ length: endIdx - startIdx }, (_, i) => ({
            id: String(startIdx + i),
          }));
        },
      },
    };
    const result = await fetchAllRecords(mockClient as any, "users");
    expect(result.fetched).toBe(MAX_BACKUP_ROWS_PER_TABLE);
    expect(result.truncated).toBe(true);
  });
});
