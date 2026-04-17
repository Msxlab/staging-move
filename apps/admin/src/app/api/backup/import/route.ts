import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBackupArchive } from "@/lib/backup-archive";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { decryptBackup, verifyBackupSignature } from "@/lib/shared-encryption";

const MODEL_MAP: Record<string, string> = {
  users: "user",
  profiles: "profile",
  addresses: "address",
  services: "service",
  providers: "serviceProvider",
  movingPlans: "movingPlan",
  tasks: "task",
  reviews: "review",
  documents: "document",
  badges: "badge",
  budgets: "budget",
  subscriptions: "subscription",
  auditLogs: "auditLog",
  notifications: "notification",
};

// Allowed table names — reject anything not in this set (prevents injection via dynamic model access)
const ALLOWED_TABLES = new Set(Object.keys(MODEL_MAP));

const IMPORT_MODEL_OPS = {
  users: {
    count: () => prisma.user.count(),
    findUniqueById: (id: string) => prisma.user.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.user.create({ data }),
  },
  profiles: {
    count: () => prisma.profile.count(),
    findUniqueById: (id: string) => prisma.profile.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.profile.create({ data }),
  },
  addresses: {
    count: () => prisma.address.count(),
    findUniqueById: (id: string) => prisma.address.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.address.create({ data }),
  },
  services: {
    count: () => prisma.service.count(),
    findUniqueById: (id: string) => prisma.service.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.service.create({ data }),
  },
  providers: {
    count: () => prisma.serviceProvider.count(),
    findUniqueById: (id: string) => prisma.serviceProvider.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.serviceProvider.create({ data }),
  },
  movingPlans: {
    count: () => prisma.movingPlan.count(),
    findUniqueById: (id: string) => prisma.movingPlan.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.movingPlan.create({ data }),
  },
  tasks: {
    count: () => prisma.task.count(),
    findUniqueById: (id: string) => prisma.task.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.task.create({ data }),
  },
  budgets: {
    count: () => prisma.budget.count(),
    findUniqueById: (id: string) => prisma.budget.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.budget.create({ data }),
  },
  subscriptions: {
    count: () => prisma.subscription.count(),
    findUniqueById: (id: string) => prisma.subscription.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.subscription.create({ data }),
  },
  auditLogs: {
    count: () => prisma.auditLog.count(),
    findUniqueById: (id: string) => prisma.auditLog.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.auditLog.create({ data }),
  },
  notifications: {
    count: () => prisma.notification.count(),
    findUniqueById: (id: string) => prisma.notification.findUnique({ where: { id } }),
    createRecord: (data: any) => prisma.notification.create({ data }),
  },
} as const;

function normalizeBackupData(input: unknown): Record<string, any[]> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, any[]] => Array.isArray(entry[1]))
  );
}

function resolveImportPayload(body: any) {
  const archive = parseBackupArchive(body.archive ?? body);

  if (!archive) {
    return {
      data: normalizeBackupData(body.data ?? body),
      signature: typeof body.signature === "string" ? body.signature : undefined,
      rawContent: typeof body.rawContent === "string" ? body.rawContent : undefined,
      encryptedArchive: false,
    };
  }

  if (archive.payload.type === "encrypted") {
    const decrypted = decryptBackup(archive.payload.encryptedData, archive.payload.iv, archive.payload.authTag);
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
  };
}

// POST /api/backup/import — import data from a backup JSON
// Supports modes: MERGE (default), REPLACE, DRY_RUN
// Requires HMAC signature verification for integrity
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const body = await request.json();
    const { tables, mode = "MERGE", confirmPassword } = body;
    const { data, signature, rawContent, encryptedArchive } = resolveImportPayload(body);

    // Step-up auth: require password for destructive operations
    if (mode !== "DRY_RUN") {
      const confirm = await requirePasswordConfirm(session, confirmPassword);
      if (!confirm.confirmed) {
        return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
      }
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid backup data. Expected { data: { tableName: [...records] } }" }, { status: 400 });
    }

    if (!["MERGE", "REPLACE", "DRY_RUN"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Must be MERGE, REPLACE, or DRY_RUN." }, { status: 400 });
    }

    // Verify HMAC signature if provided (required for REPLACE mode)
    if (mode === "REPLACE" && !signature) {
      return NextResponse.json({ error: "REPLACE mode requires a backup signature for integrity verification. Use a backup exported from this system." }, { status: 400 });
    }
    if (signature && rawContent) {
      const isValid = verifyBackupSignature(rawContent, signature);
      if (!isValid) {
        return NextResponse.json({ error: "Backup signature verification failed. The backup file may have been tampered with." }, { status: 400 });
      }
    }

    // Filter to allowed tables only
    const requestedTables = tables && tables.length > 0 ? tables : Object.keys(data);
    const selectedTables = requestedTables.filter((t: string) => ALLOWED_TABLES.has(t));

    if (selectedTables.length === 0) {
      return NextResponse.json({ error: "No valid tables found in backup data." }, { status: 400 });
    }

    const results: Record<string, { imported: number; skipped: number; errors: number; deleted?: number }> = {};
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // === DRY_RUN MODE: Report what would happen without making changes ===
    if (mode === "DRY_RUN") {
      for (const tableName of selectedTables) {
        const records = data[tableName];
        if (!records || !Array.isArray(records)) {
          results[tableName] = { imported: 0, skipped: 0, errors: 0 };
          continue;
        }
        const modelOps = IMPORT_MODEL_OPS[tableName as keyof typeof IMPORT_MODEL_OPS];
        if (!modelOps) { results[tableName] = { imported: 0, skipped: records.length, errors: 0 }; continue; }

        const existingCount = await modelOps.count();
        let wouldImport = 0;
        let wouldSkip = 0;

        for (const record of records) {
          if (!record.id) { wouldSkip++; continue; }
          const existing = await modelOps.findUniqueById(record.id).catch(() => null);
          if (existing) { wouldSkip++; } else { wouldImport++; }
        }

        results[tableName] = { imported: wouldImport, skipped: wouldSkip, errors: 0, deleted: existingCount };
        totalImported += wouldImport;
        totalSkipped += wouldSkip;
      }

      return NextResponse.json({
        success: true,
        mode: "DRY_RUN",
        message: "No changes were made. This is a preview of what would happen.",
        tables: selectedTables,
        results,
        summary: { totalImported, totalSkipped, totalErrors: 0 },
      });
    }

    // === REPLACE MODE: Atomic transaction — all or nothing ===
    if (mode === "REPLACE") {
      try {
        await prisma.$transaction(async (tx: any) => {
          for (const tableName of selectedTables) {
            const records = data[tableName];
            if (!records || !Array.isArray(records)) {
              results[tableName] = { imported: 0, skipped: 0, errors: 0 };
              continue;
            }
            const modelName = MODEL_MAP[tableName];
            if (!modelName) { results[tableName] = { imported: 0, skipped: records.length, errors: 0 }; totalSkipped += records.length; continue; }
            const model = tx[modelName];
            if (!model) { results[tableName] = { imported: 0, skipped: records.length, errors: 0 }; totalSkipped += records.length; continue; }

            // Delete all existing, then insert within same transaction
            const deleteResult = await model.deleteMany({});
            let imported = 0;
            let errors = 0;

            for (const record of records) {
              try {
                const cleanRecord = { ...record };
                delete cleanRecord.createdAt;
                delete cleanRecord.updatedAt;
                await model.create({ data: cleanRecord });
                imported++;
              } catch (err) {
                errors++;
                // In REPLACE mode, any error aborts the whole transaction
                if (errors > 0) {
                  throw new Error(`Failed to import record in ${tableName}: ${err}`);
                }
              }
            }

            results[tableName] = { imported, skipped: 0, errors, deleted: deleteResult.count };
            totalImported += imported;
            totalErrors += errors;
          }
        }, { timeout: 120000 }); // 2 minute timeout for large imports
      } catch (txError: any) {
        // Transaction rolled back — no data was changed
        await prisma.adminAuditLog.create({
          data: {
            adminUserId: session.adminId,
            action: "IMPORT_BACKUP_FAILED",
            entityType: "BackupRecord",
            entityId: "import",
            changes: JSON.stringify({ mode, tables: selectedTables, error: txError?.message?.slice(0, 500) }),
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          },
        });
        return NextResponse.json({
          error: "REPLACE import failed — all changes have been rolled back. No data was lost.",
          detail: txError?.message?.slice(0, 500),
        }, { status: 500 });
      }
    }

    // === MERGE MODE: Skip existing records, insert new ones ===
    if (mode === "MERGE") {
      for (const tableName of selectedTables) {
        const records = data[tableName];
        if (!records || !Array.isArray(records)) {
          results[tableName] = { imported: 0, skipped: 0, errors: 0 };
          continue;
        }

        const modelName = MODEL_MAP[tableName];
        if (!modelName) { results[tableName] = { imported: 0, skipped: records.length, errors: 0 }; totalSkipped += records.length; continue; }
        const modelOps = IMPORT_MODEL_OPS[tableName as keyof typeof IMPORT_MODEL_OPS];
        if (!modelOps) { results[tableName] = { imported: 0, skipped: records.length, errors: 0 }; totalSkipped += records.length; continue; }

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const record of records) {
          try {
            if (!record.id) { skipped++; continue; }
            const existing = await modelOps.findUniqueById(record.id);
            if (existing) { skipped++; continue; }
            const cleanRecord = { ...record };
            delete cleanRecord.createdAt;
            delete cleanRecord.updatedAt;
            await modelOps.createRecord(cleanRecord);
            imported++;
          } catch {
            errors++;
          }
        }

        results[tableName] = { imported, skipped, errors };
        totalImported += imported;
        totalSkipped += skipped;
        totalErrors += errors;
      }
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "IMPORT_BACKUP",
        entityType: "BackupRecord",
        entityId: "import",
        changes: JSON.stringify({ mode, tables: selectedTables, totalImported, totalSkipped, totalErrors, signatureVerified: !!signature, encryptedArchive }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      tables: selectedTables,
      results,
      summary: { totalImported, totalSkipped, totalErrors },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "BACKUP_DECRYPT_FAILED") {
      return NextResponse.json({ error: "Encrypted backup could not be decrypted. Check FIELD_ENCRYPTION_KEY before importing." }, { status: 400 });
    }
    if (error?.message === "BACKUP_PARSE_FAILED") {
      return NextResponse.json({ error: "Encrypted backup payload is corrupted or invalid JSON." }, { status: 400 });
    }
    console.error("Failed to import backup:", error);
    return NextResponse.json({ error: "Failed to import backup" }, { status: 500 });
  }
}
