import { NextRequest, NextResponse } from "next/server";
// `prisma` is the soft-delete-extended client (reads/audit). `prismaUnsafe`
// is the raw client, used wherever the import must see PHYSICAL rows so a
// backup id that collides with a SOFT-DELETED target row is detected (and
// skipped) rather than mis-created: REPLACE (so `deleteMany` truly removes
// rows), and the MERGE + DRY_RUN existence checks (an extended findUnique
// hides soft-deleted rows, so it would report "new" → create() → PK
// collision → the whole MERGE rolls back).
import { prisma, prismaUnsafe } from "@/lib/db";
import { parseBackupArchive } from "@/lib/backup-archive";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import {
  BACKUP_TABLE_ORDER,
  BACKUP_TABLES,
  getBackupDependencyWarnings,
  getReplaceSafetyIssues,
  normalizeBackupTables,
} from "@/lib/backup-tables";
import { decryptBackup, verifyBackupSignature } from "@/lib/shared-encryption";
import {
  RestoreTargetGuardError,
  assertRestoreTargetAllowed,
} from "@/lib/backup-restore-guard";
import { redactBackupSecretText } from "@/lib/backup-metadata";
import {
  MAX_BACKUP_IMPORT_BYTES,
  requestBodyTooLarge,
} from "@/lib/backup-policy";
import {
  RestoreRunLockError,
  acquireRestoreRunLock,
  markRestoreRunLockFailed,
  releaseRestoreRunLock,
} from "@/lib/backup-lock";
import { createBackupJob } from "@/lib/backup-job";
import { writeBackupAudit } from "@/lib/backup-audit";
import { getAuditRequestMeta } from "@/lib/audit";

const IMPORT_MODEL_OPS = {
  users: {
    count: () => prisma.user.count(),
    findUniqueById: (id: string) => prismaUnsafe.user.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.user.create({ data }),
  },
  oauthAccounts: {
    count: () => prisma.oAuthAccount.count(),
    findUniqueById: (id: string) =>
      prisma.oAuthAccount.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.oAuthAccount.create({ data }),
  },
  profiles: {
    count: () => prisma.profile.count(),
    findUniqueById: (id: string) =>
      prisma.profile.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.profile.create({ data }),
  },
  dataConsents: {
    count: () => prisma.dataConsent.count(),
    findUniqueById: (id: string) =>
      prisma.dataConsent.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.dataConsent.create({ data }),
  },
  workspaces: {
    count: () => prisma.workspace.count(),
    // Workspace is a soft-delete model — use the raw client so a backup id
    // colliding with a soft-deleted target row is detected (see header).
    findUniqueById: (id: string) =>
      prismaUnsafe.workspace.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.workspace.create({ data }),
  },
  workspaceMembers: {
    count: () => prisma.workspaceMember.count(),
    findUniqueById: (id: string) =>
      prisma.workspaceMember.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.workspaceMember.create({ data }),
  },
  notificationPreferences: {
    count: () => prisma.notificationPreference.count(),
    findUniqueById: (id: string) =>
      prisma.notificationPreference.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.notificationPreference.create({ data }),
  },
  providers: {
    count: () => prisma.serviceProvider.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.serviceProvider.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.serviceProvider.create({ data }),
  },
  providerLogoCandidates: {
    count: () => prisma.providerLogoCandidate.count(),
    findUniqueById: (id: string) =>
      prisma.providerLogoCandidate.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.providerLogoCandidate.create({ data }),
  },
  providerCoverages: {
    count: () => prisma.serviceProviderCoverage.count(),
    findUniqueById: (id: string) =>
      prisma.serviceProviderCoverage.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.serviceProviderCoverage.create({ data }),
  },
  addresses: {
    count: () => prisma.address.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.address.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.address.create({ data }),
  },
  addressChangeEvents: {
    count: () => prisma.addressChangeEvent.count(),
    findUniqueById: (id: string) =>
      prisma.addressChangeEvent.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.addressChangeEvent.create({ data }),
  },
  movingPlans: {
    count: () => prisma.movingPlan.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.movingPlan.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.movingPlan.create({ data }),
  },
  customProviders: {
    count: () => prisma.userCustomProvider.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.userCustomProvider.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.userCustomProvider.create({ data }),
  },
  services: {
    count: () => prisma.service.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.service.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.service.create({ data }),
  },
  reminders: {
    count: () => prisma.reminder.count(),
    findUniqueById: (id: string) =>
      prisma.reminder.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.reminder.create({ data }),
  },
  moveTasks: {
    count: () => prisma.moveTask.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.moveTask.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.moveTask.create({ data }),
  },
  budgets: {
    count: () => prisma.budget.count(),
    findUniqueById: (id: string) => prismaUnsafe.budget.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.budget.create({ data }),
  },
  subscriptions: {
    count: () => prisma.subscription.count(),
    findUniqueById: (id: string) =>
      prisma.subscription.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.subscription.create({ data }),
  },
  notifications: {
    count: () => prisma.notification.count(),
    findUniqueById: (id: string) =>
      prisma.notification.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.notification.create({ data }),
  },
  emailTemplates: {
    count: () => prisma.emailTemplate.count(),
    findUniqueById: (id: string) =>
      prisma.emailTemplate.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.emailTemplate.create({ data }),
  },
  emailLogs: {
    count: () => prisma.emailLog.count(),
    findUniqueById: (id: string) =>
      prisma.emailLog.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.emailLog.create({ data }),
  },
  auditLogs: {
    count: () => prisma.auditLog.count(),
    findUniqueById: (id: string) =>
      prisma.auditLog.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.auditLog.create({ data }),
  },
  providerGovernanceIssues: {
    count: () => prisma.providerGovernanceIssue.count(),
    findUniqueById: (id: string) =>
      prisma.providerGovernanceIssue.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.providerGovernanceIssue.create({ data }),
  },
  connectorFallbackActions: {
    count: () => prisma.connectorFallbackAction.count(),
    findUniqueById: (id: string) =>
      prisma.connectorFallbackAction.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.connectorFallbackAction.create({ data }),
  },
  supportTickets: {
    count: () => prisma.supportTicket.count(),
    findUniqueById: (id: string) =>
      prisma.supportTicket.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.supportTicket.create({ data }),
  },
  ticketMessages: {
    count: () => prisma.ticketMessage.count(),
    findUniqueById: (id: string) =>
      prisma.ticketMessage.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.ticketMessage.create({ data }),
  },
  adminUsers: {
    count: () => prisma.adminUser.count(),
    findUniqueById: (id: string) =>
      prisma.adminUser.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.adminUser.create({ data }),
  },
  adminPermissions: {
    count: () => prisma.adminPermission.count(),
    findUniqueById: (id: string) =>
      prisma.adminPermission.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.adminPermission.create({ data }),
  },
  adminLoginLogs: {
    count: () => prisma.adminLoginLog.count(),
    findUniqueById: (id: string) =>
      prisma.adminLoginLog.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.adminLoginLog.create({ data }),
  },
  adminAuditLogs: {
    count: () => prisma.adminAuditLog.count(),
    findUniqueById: (id: string) =>
      prisma.adminAuditLog.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.adminAuditLog.create({ data }),
  },
  acquisitionCampaigns: {
    count: () => prisma.acquisitionCampaign.count(),
    findUniqueById: (id: string) =>
      prisma.acquisitionCampaign.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.acquisitionCampaign.create({ data }),
  },
  acquisitionRedemptions: {
    count: () => prisma.acquisitionRedemption.count(),
    findUniqueById: (id: string) =>
      prisma.acquisitionRedemption.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.acquisitionRedemption.create({ data }),
  },
  affiliateClicks: {
    count: () => prisma.affiliateClick.count(),
    findUniqueById: (id: string) =>
      prisma.affiliateClick.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.affiliateClick.create({ data }),
  },
  affiliateConversions: {
    count: () => prisma.affiliateConversion.count(),
    findUniqueById: (id: string) =>
      prisma.affiliateConversion.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.affiliateConversion.create({ data }),
  },
  blogCategories: {
    count: () => prisma.blogCategory.count(),
    findUniqueById: (id: string) =>
      prisma.blogCategory.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.blogCategory.create({ data }),
  },
  blogTags: {
    count: () => prisma.blogTag.count(),
    findUniqueById: (id: string) =>
      prisma.blogTag.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.blogTag.create({ data }),
  },
  blogPosts: {
    count: () => prisma.blogPost.count(),
    findUniqueById: (id: string) =>
      prismaUnsafe.blogPost.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.blogPost.create({ data }),
  },
  sponsoredPlacements: {
    count: () => prisma.sponsoredPlacement.count(),
    findUniqueById: (id: string) =>
      prisma.sponsoredPlacement.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.sponsoredPlacement.create({ data }),
  },
  helpArticles: {
    count: () => prisma.helpArticle.count(),
    findUniqueById: (id: string) =>
      prisma.helpArticle.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.helpArticle.create({ data }),
  },
  faqs: {
    count: () => prisma.fAQ.count(),
    findUniqueById: (id: string) => prisma.fAQ.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.fAQ.create({ data }),
  },
  stateRules: {
    count: () => prisma.stateRule.count(),
    findUniqueById: (id: string) =>
      prisma.stateRule.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.stateRule.create({ data }),
  },
  ipRules: {
    count: () => prisma.iPRule.count(),
    findUniqueById: (id: string) =>
      prisma.iPRule.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.iPRule.create({ data }),
  },
  waitlistSignups: {
    count: () => prisma.waitlistSignup.count(),
    findUniqueById: (id: string) =>
      prisma.waitlistSignup.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.waitlistSignup.create({ data }),
  },
  moverApplications: {
    count: () => prisma.moverApplication.count(),
    findUniqueById: (id: string) =>
      prisma.moverApplication.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.moverApplication.create({ data }),
  },
  moverDocuments: {
    count: () => prisma.moverDocument.count(),
    findUniqueById: (id: string) =>
      prisma.moverDocument.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.moverDocument.create({ data }),
  },
  leads: {
    count: () => prisma.lead.count(),
    findUniqueById: (id: string) => prisma.lead.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.lead.create({ data }),
  },
  leadDispatches: {
    count: () => prisma.leadDispatch.count(),
    findUniqueById: (id: string) => prisma.leadDispatch.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.leadDispatch.create({ data }),
  },
  partners: {
    count: () => prisma.partner.count(),
    findUniqueById: (id: string) => prisma.partner.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.partner.create({ data }),
  },
  partnerDocuments: {
    count: () => prisma.partnerDocument.count(),
    findUniqueById: (id: string) => prisma.partnerDocument.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.partnerDocument.create({ data }),
  },
  partnerInvoices: {
    count: () => prisma.partnerInvoice.count(),
    findUniqueById: (id: string) => prisma.partnerInvoice.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.partnerInvoice.create({ data }),
  },
  partnerLedgerEntries: {
    count: () => prisma.partnerLedgerEntry.count(),
    findUniqueById: (id: string) => prisma.partnerLedgerEntry.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.partnerLedgerEntry.create({ data }),
  },
} as const;

function normalizeBackupData(input: unknown): Record<string, any[]> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, any[]] =>
      Array.isArray(entry[1]),
    ),
  );
}

function normalizeArchiveMetadata(input: unknown) {
  return input && typeof input === "object" ? (input as any).metadata || null : null;
}

function parseSignedRawContent(rawContent: string | undefined) {
  if (!rawContent) return { data: {}, metadata: null };
  try {
    const parsed = JSON.parse(rawContent);
    return {
      data: normalizeBackupData(parsed?.data ?? parsed),
      metadata: normalizeArchiveMetadata(parsed),
    };
  } catch {
    return { data: {}, metadata: null };
  }
}

function resolveImportPayload(body: any) {
  const archive = parseBackupArchive(body.archive ?? body);

  if (!archive) {
    const signedRaw = parseSignedRawContent(
      typeof body.rawContent === "string" ? body.rawContent : undefined,
    );
    return {
      data:
        Object.keys(signedRaw.data).length > 0
          ? signedRaw.data
          : normalizeBackupData(body.data ?? body),
      signature:
        typeof body.signature === "string" ? body.signature : undefined,
      rawContent:
        typeof body.rawContent === "string" ? body.rawContent : undefined,
      encryptedArchive: false,
      metadata: signedRaw.metadata,
    };
  }

  if (archive.payload.type === "encrypted") {
    const decrypted = decryptBackup(
      archive.payload.encryptedData,
      archive.payload.iv,
      archive.payload.authTag,
    );
    if (!decrypted) {
      throw new Error("BACKUP_DECRYPT_FAILED");
    }

    try {
      const parsed = JSON.parse(decrypted);
      return {
        data: normalizeBackupData(parsed?.data ?? parsed),
        signature: archive.signature || undefined,
        rawContent: decrypted,
        encryptedArchive: true,
        metadata: normalizeArchiveMetadata(parsed) || archive.metadata,
      };
    } catch {
      throw new Error("BACKUP_PARSE_FAILED");
    }
  }

  return {
    data: normalizeBackupData(archive.payload.data),
    signature: archive.signature || undefined,
    rawContent: archive.payload.rawContent,
    encryptedArchive: false,
    metadata:
      parseSignedRawContent(archive.payload.rawContent).metadata ||
      archive.metadata,
  };
}

function getTransactionModel(tx: any, tableName: keyof typeof BACKUP_TABLES) {
  return tx[BACKUP_TABLES[tableName].model];
}

const TABLES_WITH_EVIDENCE_TIMESTAMPS = new Set<keyof typeof BACKUP_TABLES>([
  "oauthAccounts",
  "dataConsents",
  "providerLogoCandidates",
  "emailLogs",
  "auditLogs",
  "adminLoginLogs",
  "adminAuditLogs",
]);

function cleanImportRecord(tableName: keyof typeof BACKUP_TABLES, record: any) {
  const cleanRecord = { ...record };
  if (!TABLES_WITH_EVIDENCE_TIMESTAMPS.has(tableName)) {
    delete cleanRecord.createdAt;
  }
  delete cleanRecord.updatedAt;

  if (tableName === "providerGovernanceIssues") {
    cleanRecord.reviewedByAdminId = null;
  }

  return cleanRecord;
}

const ADMIN_IDENTITY_TABLES = new Set(["adminUsers", "adminPermissions"]);
const ADMIN_RELATED_TABLES = new Set([
  "adminUsers",
  "adminPermissions",
  "adminLoginLogs",
  "adminAuditLogs",
]);

async function assertAdminRestorePreflight(input: {
  mode: "MERGE" | "REPLACE" | "DRY_RUN";
  selectedTables: string[];
  data: Record<string, any[]>;
  currentAdminId: string;
}) {
  const touchesAdminTables = input.selectedTables.some((table) =>
    ADMIN_RELATED_TABLES.has(table),
  );
  if (!touchesAdminTables || input.mode === "DRY_RUN") return;

  const breakGlass = process.env.ALLOW_ADMIN_TABLE_RESTORE === "true";
  const replacingIdentity =
    input.mode === "REPLACE" &&
    input.selectedTables.some((table) => ADMIN_IDENTITY_TABLES.has(table));

  if (replacingIdentity && !breakGlass) {
    throw new RestoreTargetGuardError(
      "ADMIN_IDENTITY_RESTORE_BLOCKED",
      "REPLACE restore of admin users or permissions requires the offline break-glass runbook.",
      403,
      { tables: input.selectedTables.filter((table) => ADMIN_IDENTITY_TABLES.has(table)) },
    );
  }

  const archiveAdminUsers = Array.isArray(input.data.adminUsers)
    ? input.data.adminUsers
    : null;
  const activeSuperAdminInArchive = archiveAdminUsers?.some(
    (admin: any) => admin?.role === "SUPER_ADMIN" && admin?.isActive !== false,
  );
  const currentAdminInArchive = archiveAdminUsers?.find(
    (admin: any) => admin?.id === input.currentAdminId,
  );

  if (archiveAdminUsers && !activeSuperAdminInArchive) {
    throw new RestoreTargetGuardError(
      "ADMIN_SUPER_ADMIN_MISSING_AFTER_RESTORE",
      "Admin table restore would leave the target without an active SUPER_ADMIN.",
      403,
    );
  }

  if (
    archiveAdminUsers &&
    (!currentAdminInArchive ||
      currentAdminInArchive.role !== "SUPER_ADMIN" ||
      currentAdminInArchive.isActive === false) &&
    !breakGlass
  ) {
    throw new RestoreTargetGuardError(
      "CURRENT_ADMIN_RESTORE_BLOCKED",
      "Admin table restore would delete, deactivate, or downgrade the current admin.",
      403,
    );
  }

  if (!archiveAdminUsers) {
    const activeSuperAdmin = await prisma.adminUser.count({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    if (activeSuperAdmin < 1) {
      throw new RestoreTargetGuardError(
        "ADMIN_SUPER_ADMIN_MISSING",
        "No active SUPER_ADMIN exists before admin-related restore.",
        403,
      );
    }
  }
}

function getImportAuditAction(mode: string, success: boolean) {
  if (mode === "DRY_RUN") {
    return success
      ? "BACKUP_IMPORT_DRY_RUN_SUCCESS"
      : "BACKUP_IMPORT_DRY_RUN_FAILED";
  }
  if (mode === "REPLACE") {
    return success
      ? "BACKUP_RESTORE_REPLACE_SUCCESS"
      : "BACKUP_RESTORE_REPLACE_FAILED";
  }
  return success
    ? "BACKUP_RESTORE_MERGE_SUCCESS"
    : "BACKUP_RESTORE_MERGE_FAILED";
}

// POST /api/backup/import — import data from a backup JSON
// Supports modes: MERGE (default), REPLACE, DRY_RUN
// Requires HMAC signature verification for integrity
export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let restoreLock: any = null;
  let safetyBackupId: string | null = null;
  let selectedTablesForAudit: string[] = [];
  let modeForAudit = "MERGE";
  try {
    session = await requirePermission("settings", "canUpdate", {
      minimumRole: "SUPER_ADMIN",
    });
    if (requestBodyTooLarge(request, MAX_BACKUP_IMPORT_BYTES)) {
      await writeBackupAudit({
        session,
        action: "BACKUP_IMPORT_DRY_RUN_FAILED",
        entityId: "import",
        request,
        metadata: { maxBytes: MAX_BACKUP_IMPORT_BYTES },
        error: "backup import payload too large",
      });
      return NextResponse.json(
        { error: "Backup archive is too large to import synchronously." },
        { status: 413 },
      );
    }
    const body = await request.json();
    const { tables, mode = "MERGE", confirmPassword, mfaCode, backupCode } = body;
    modeForAudit = mode;
    const { data, signature, rawContent, encryptedArchive, metadata: archiveMetadata } =
      resolveImportPayload(body);

    // DRY_RUN does not mutate the DB but still inspects backup payload
    // contents (which may include encrypted PII). Require step-up here
    // too, scoped under a separate operation so a confirmed dry-run does
    // not silently authorize a follow-up REPLACE.
    const stepUpOperation = mode === "DRY_RUN" ? "backup_import_dry_run" : "backup_import";
    const requireMfaForOp = true;
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: stepUpOperation,
      requireMfa: requireMfaForOp,
      mfaCode: typeof mfaCode === "string" ? mfaCode : undefined,
      backupCode: typeof backupCode === "string" ? backupCode : undefined,
      ipAddress: getAuditRequestMeta(request).ipAddress,
      userAgent: getAuditRequestMeta(request).userAgent,
    });
    if (!confirm.confirmed) {
      await writeBackupAudit({
        session,
        action:
          mode === "DRY_RUN"
            ? "BACKUP_IMPORT_DRY_RUN_FAILED"
            : mode === "REPLACE"
              ? "BACKUP_RESTORE_REPLACE_FAILED"
              : "BACKUP_RESTORE_MERGE_FAILED",
        entityId: "import",
        request,
        metadata: { mode },
        error: confirm.error || "step-up failed",
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa },
        { status: 403 },
      );
    }

    if (!data || typeof data !== "object") {
      await writeBackupAudit({
        session,
        action: getImportAuditAction(mode, false),
        entityId: "import",
        request,
        metadata: { mode },
        error: "invalid backup data",
      });
      return NextResponse.json(
        {
          error:
            "Invalid backup data. Expected { data: { tableName: [...records] } }",
        },
        { status: 400 },
      );
    }

    if (!["MERGE", "REPLACE", "DRY_RUN"].includes(mode)) {
      await writeBackupAudit({
        session,
        action: getImportAuditAction(mode, false),
        entityId: "import",
        request,
        metadata: { mode },
        error: "invalid import mode",
      });
      return NextResponse.json(
        { error: "Invalid mode. Must be MERGE, REPLACE, or DRY_RUN." },
        { status: 400 },
      );
    }

    if (mode === "REPLACE" && !signature) {
      await writeBackupAudit({
        session,
        action: "BACKUP_RESTORE_REPLACE_FAILED",
        entityId: "import",
        request,
        metadata: { mode },
        error: "missing backup signature",
      });
      return NextResponse.json(
        {
          error:
            "REPLACE mode requires a backup signature for integrity verification. Use a backup exported from this system.",
        },
        { status: 400 },
      );
    }
    if ((mode === "MERGE" || mode === "REPLACE") && (!signature || !rawContent)) {
      await writeBackupAudit({
        session,
        action: getImportAuditAction(mode, false),
        entityId: "import",
        request,
        metadata: { mode },
        error: "missing signed raw content",
      });
      return NextResponse.json(
        {
          error:
            `${mode} mode requires a backup signature and raw signed content for integrity verification. Use a backup exported from this system.`,
        },
        { status: 400 },
      );
    }
    let signatureVerified = false;
    if (signature && rawContent) {
      const isValid = verifyBackupSignature(rawContent, signature);
      if (!isValid) {
        await writeBackupAudit({
          session,
          action: getImportAuditAction(mode, false),
          entityId: "import",
          request,
          metadata: { mode },
          error: "signature verification failed",
        });
        return NextResponse.json(
          {
            error:
              "Backup signature verification failed. The backup file may have been tampered with.",
          },
          { status: 400 },
        );
      }
      signatureVerified = true;
    }

    const restoreGuard = assertRestoreTargetAllowed({
      mode: mode as "MERGE" | "REPLACE" | "DRY_RUN",
      body,
      archiveMetadata,
    });

    const requestedTables =
      Array.isArray(tables) && tables.length > 0 ? tables : Object.keys(data);
    const selectedTables = normalizeBackupTables(requestedTables);
    selectedTablesForAudit = selectedTables;

    if (selectedTables.length === 0) {
      await writeBackupAudit({
        session,
        action: getImportAuditAction(mode, false),
        entityId: "import",
        request,
        metadata: { mode },
        error: "no valid tables",
      });
      return NextResponse.json(
        { error: "No valid tables found in backup data." },
        { status: 400 },
      );
    }

    const dependencyWarnings = getBackupDependencyWarnings(selectedTables);
    if (mode === "REPLACE") {
      const replaceSafetyIssues = getReplaceSafetyIssues(selectedTables);
      if (replaceSafetyIssues.length > 0) {
        await writeBackupAudit({
          session,
          action: "BACKUP_RESTORE_REPLACE_FAILED",
          entityId: "import",
          request,
          metadata: { mode, selectedTables, replaceSafetyIssues },
          error: "unsafe replace table selection",
        });
        return NextResponse.json(
          {
            error:
              "Selected REPLACE tables are unsafe because parent-table deletion would cascade into unselected child tables.",
            details: replaceSafetyIssues,
          },
          { status: 400 },
        );
      }
    }

    await assertAdminRestorePreflight({
      mode: mode as "MERGE" | "REPLACE" | "DRY_RUN",
      selectedTables,
      data,
      currentAdminId: session.adminId,
    });

    const results: Record<
      string,
      { imported: number; skipped: number; errors: number; deleted?: number }
    > = {};
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    if (mode === "MERGE" || mode === "REPLACE") {
      try {
        restoreLock = await acquireRestoreRunLock({
          prismaClient: prisma as any,
          adminId: session.adminId,
          mode,
          tables: selectedTables,
          metadata: {
            targetEnvironment:
              typeof body.targetEnvironment === "string"
                ? body.targetEnvironment
                : null,
          },
        });
      } catch (lockError) {
        await writeBackupAudit({
          session,
          action: "BACKUP_RESTORE_LOCK_REJECTED",
          entityId: "restore-lock",
          request,
          metadata: { mode, selectedTables },
          error: lockError,
        });
        if (lockError instanceof RestoreRunLockError) {
          return NextResponse.json(
            {
              error: lockError.message,
              code: "RESTORE_ALREADY_RUNNING",
              activeRestoreId: lockError.activeRestoreId,
            },
            { status: 409 },
          );
        }
        throw lockError;
      }

      try {
        const safety = await createBackupJob({
          actor: { adminId: session.adminId, email: session.email },
          type: `PRE_RESTORE_${mode}`,
          tables: BACKUP_TABLE_ORDER,
          format: "JSON",
          request,
          lockIgnoreActiveIds: [restoreLock.id],
        });
        safetyBackupId = safety.backup.id;
      } catch (safetyError) {
        await markRestoreRunLockFailed({
          prismaClient: prisma as any,
          restoreId: restoreLock.id,
          error: safetyError,
          metadata: { mode, selectedTables },
        });
        await writeBackupAudit({
          session,
          action:
            mode === "REPLACE"
              ? "BACKUP_RESTORE_REPLACE_FAILED"
              : "BACKUP_RESTORE_MERGE_FAILED",
          entityId: restoreLock.id,
          request,
          metadata: { mode, selectedTables, safetyBackupId },
          error: safetyError,
        });
        if (process.env.ALLOW_RESTORE_WITHOUT_SAFETY_BACKUP === "true") {
          safetyBackupId = null;
        } else {
          return NextResponse.json(
            {
              error:
                "Pre-restore safety backup failed. Restore was blocked before mutating data.",
              detail: redactBackupSecretText(safetyError).slice(0, 500),
            },
            { status: 503 },
          );
        }
      }
    }

    if (mode === "DRY_RUN") {
      for (const tableName of selectedTables) {
        const records = data[tableName];
        if (!records || !Array.isArray(records)) {
          results[tableName] = { imported: 0, skipped: 0, errors: 0 };
          continue;
        }

        const modelOps = IMPORT_MODEL_OPS[tableName];
        const existingCount = await modelOps.count();
        let wouldImport = 0;
        let wouldSkip = 0;

        for (const record of records) {
          if (!record.id) {
            wouldSkip++;
            continue;
          }
          const existing = await modelOps
            .findUniqueById(record.id)
            .catch(() => null);
          if (existing) {
            wouldSkip++;
          } else {
            wouldImport++;
          }
        }

        results[tableName] = {
          imported: wouldImport,
          skipped: wouldSkip,
          errors: 0,
          deleted: existingCount,
        };
        totalImported += wouldImport;
        totalSkipped += wouldSkip;
      }

      await writeBackupAudit({
        session,
        action: "BACKUP_IMPORT_DRY_RUN_SUCCESS",
        entityId: "import",
        request,
        metadata: {
          mode,
          selectedTables,
          totalImported,
          totalSkipped,
          signatureVerified,
          encryptedArchive,
          dependencyWarnings,
          restoreWarnings: restoreGuard.warnings,
        },
      });

      return NextResponse.json({
        success: true,
        mode: "DRY_RUN",
        signatureVerified,
        message:
          "No changes were made. This is a preview of what would happen.",
        tables: selectedTables,
        warnings: dependencyWarnings,
        restoreWarnings: restoreGuard.warnings,
        results,
        summary: { totalImported, totalSkipped, totalErrors: 0 },
      });
    }

    if (mode === "REPLACE") {
      // The default `prisma` client has the soft-delete extension, which
      // rewrites `deleteMany({})` on User/Address/Service/etc. into an
      // `updateMany({deletedAt: now})`. That would silently orphan rows in
      // a REPLACE: we'd "delete" then re-create with the same id and hit a
      // unique constraint, or worse, end up with a half-purged DB. Use the
      // raw `prismaUnsafe` so REPLACE is what it says on the tin.
      try {
        await prismaUnsafe.$transaction(
          async (tx: any) => {
            for (const tableName of selectedTables) {
              const records = data[tableName];
              if (!records || !Array.isArray(records)) {
                results[tableName] = { imported: 0, skipped: 0, errors: 0 };
                continue;
              }

              const model = getTransactionModel(tx, tableName);
              const deleteResult = await model.deleteMany({});
              let imported = 0;

              for (const record of records) {
                const cleanRecord = cleanImportRecord(tableName, record);
                await model.create({ data: cleanRecord });
                imported++;
              }

              results[tableName] = {
                imported,
                skipped: 0,
                errors: 0,
                deleted: deleteResult.count,
              };
              totalImported += imported;
            }
          },
          { timeout: 120000 },
        );
      } catch (txError: any) {
        if (restoreLock) {
          await markRestoreRunLockFailed({
            prismaClient: prisma as any,
            restoreId: restoreLock.id,
            error: txError,
            metadata: { mode, selectedTables, safetyBackupId },
          });
        }
        await writeBackupAudit({
          session,
          action: "BACKUP_RESTORE_REPLACE_FAILED",
          entityId: restoreLock?.id ?? "import",
          request,
          metadata: { mode, selectedTables, safetyBackupId },
          error: txError,
        });
        return NextResponse.json(
          {
            error:
              "REPLACE import failed — all changes have been rolled back. No data was lost.",
            detail: redactBackupSecretText(txError).slice(0, 500),
          },
          { status: 500 },
        );
      }
    }

    if (mode === "MERGE") {
      try {
        // prismaUnsafe (raw): the existence check below must see PHYSICAL rows.
        // The extended client's findUnique hides soft-deleted rows, so a backup
        // id colliding with a soft-deleted target row would read as "new", then
        // create() would hit a PK collision and roll back the entire MERGE.
        await prismaUnsafe.$transaction(
          async (tx: any) => {
            for (const tableName of selectedTables) {
              const records = data[tableName];
              if (!records || !Array.isArray(records)) {
                results[tableName] = { imported: 0, skipped: 0, errors: 0 };
                continue;
              }

              const model = getTransactionModel(tx, tableName);
              let imported = 0;
              let skipped = 0;
              let errors = 0;

              for (const record of records) {
                try {
                  if (!record.id) {
                    skipped++;
                    continue;
                  }
                  const existing = await model
                    .findUnique({ where: { id: record.id } })
                    .catch(() => null);
                  if (existing) {
                    skipped++;
                    continue;
                  }
                  const cleanRecord = cleanImportRecord(tableName, record);
                  await model.create({ data: cleanRecord });
                  imported++;
                } catch {
                  // A single-record failure aborts the whole MERGE so the DB
                  // is never left in a partial state. We re-throw to roll back.
                  errors++;
                  throw new Error(
                    `MERGE failed on ${tableName} id=${record?.id ?? "unknown"}`,
                  );
                }
              }

              results[tableName] = { imported, skipped, errors };
              totalImported += imported;
              totalSkipped += skipped;
              totalErrors += errors;
            }
          },
          { timeout: 120000 },
        );
      } catch (txError: any) {
        if (restoreLock) {
          await markRestoreRunLockFailed({
            prismaClient: prisma as any,
            restoreId: restoreLock.id,
            error: txError,
            metadata: { mode, selectedTables, safetyBackupId },
          });
        }
        await writeBackupAudit({
          session,
          action: "BACKUP_RESTORE_MERGE_FAILED",
          entityId: restoreLock?.id ?? "import",
          request,
          metadata: { mode, selectedTables, safetyBackupId },
          error: txError,
        });
        return NextResponse.json(
          {
            error:
              "MERGE import failed — all changes have been rolled back. No data was imported.",
            detail: redactBackupSecretText(txError).slice(0, 500),
          },
          { status: 500 },
        );
      }
    }

    if (restoreLock) {
      await releaseRestoreRunLock({
        prismaClient: prisma as any,
        restoreId: restoreLock.id,
        metadata: {
          mode,
          selectedTables,
          safetyBackupId,
          totalImported,
          totalSkipped,
          totalErrors,
        },
      });
    }

    await writeBackupAudit({
      session,
      action: getImportAuditAction(mode, true),
      entityId: restoreLock?.id ?? "import",
      request,
      metadata: {
        mode,
        selectedTables,
        safetyBackupId,
        totalImported,
        totalSkipped,
        totalErrors,
        signatureVerified,
        encryptedArchive,
        dependencyWarnings,
        restoreWarnings: restoreGuard.warnings,
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      signatureVerified,
      tables: selectedTables,
      warnings: dependencyWarnings,
      restoreWarnings: restoreGuard.warnings,
      results,
      summary: { totalImported, totalSkipped, totalErrors },
    });
  } catch (error: any) {
    if (restoreLock) {
      await markRestoreRunLockFailed({
        prismaClient: prisma as any,
        restoreId: restoreLock.id,
        error,
        metadata: {
          mode: modeForAudit,
          selectedTables: selectedTablesForAudit,
          safetyBackupId,
        },
      }).catch(() => null);
    }
    if (session) {
      await writeBackupAudit({
        session,
        action: getImportAuditAction(modeForAudit, false),
        entityId: restoreLock?.id ?? "import",
        request,
        metadata: {
          mode: modeForAudit,
          selectedTables: selectedTablesForAudit,
          safetyBackupId,
        },
        error,
      });
    }
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "BACKUP_DECRYPT_FAILED") {
      return NextResponse.json(
        {
          error:
            "Encrypted backup could not be decrypted. Check FIELD_ENCRYPTION_KEY before importing.",
        },
        { status: 400 },
      );
    }
    if (error?.message === "BACKUP_PARSE_FAILED") {
      return NextResponse.json(
        { error: "Encrypted backup payload is corrupted or invalid JSON." },
        { status: 400 },
      );
    }
    if (error instanceof RestoreTargetGuardError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }
    console.error(`Failed to import backup: ${redactBackupSecretText(error)}`);
    return NextResponse.json(
      { error: "Failed to import backup" },
      { status: 500 },
    );
  }
}
