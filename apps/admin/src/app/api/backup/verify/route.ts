import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBackupArchive } from "@/lib/backup-archive";
import { requirePermission } from "@/lib/auth";
import { decryptBackup, verifyBackupSignature } from "@/lib/shared-encryption";

const ALLOWED_TABLES = new Set([
  "users", "profiles", "addresses", "services", "providers",
  "movingPlans", "tasks", "reviews", "documents", "badges",
  "budgets", "subscriptions", "auditLogs", "notifications",
]);

const BACKUP_TABLE_COUNTERS = {
  users: () => prisma.user.count(),
  profiles: () => prisma.profile.count(),
  addresses: () => prisma.address.count(),
  services: () => prisma.service.count(),
  providers: () => prisma.serviceProvider.count(),
  movingPlans: () => prisma.movingPlan.count(),
  tasks: () => prisma.task.count(),
  budgets: () => prisma.budget.count(),
  subscriptions: () => prisma.subscription.count(),
  auditLogs: () => prisma.auditLog.count(),
  notifications: () => prisma.notification.count(),
} as const;

function normalizeBackupData(input: unknown): Record<string, any[]> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, any[]] => Array.isArray(entry[1]))
  );
}

// POST /api/backup/verify — verify backup integrity without importing
// Checks: JSON structure, HMAC signature, encryption, table counts, schema compatibility
export async function POST(request: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const body = await request.json();
    const archive = parseBackupArchive(body.archive ?? body);
    const legacySignature = typeof body.signature === "string" ? body.signature : undefined;
    const legacyRawContent = typeof body.rawContent === "string" ? body.rawContent : undefined;
    const legacyEncrypted = typeof body.encrypted === "string" ? body.encrypted : undefined;
    const legacyIv = typeof body.iv === "string" ? body.iv : undefined;
    const legacyAuthTag = typeof body.authTag === "string" ? body.authTag : undefined;

    const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

    // ── Check 1: Decryption (if encrypted) ─────────────────
    let backupData: Record<string, any[]> | null = null;
    let signature = legacySignature;
    let rawContent = legacyRawContent;

    if (archive) {
      signature = archive.signature || undefined;
      if (archive.payload.type === "encrypted") {
        try {
          const decrypted = decryptBackup(archive.payload.encryptedData, archive.payload.iv, archive.payload.authTag);
          if (decrypted) {
            const parsed = JSON.parse(decrypted);
            backupData = normalizeBackupData(parsed?.data ?? parsed);
            rawContent = decrypted;
            checks.push({ name: "Archive Format", status: "pass", detail: `Version 1 archive (${archive.payload.type}) parsed successfully` });
            checks.push({ name: "Decryption", status: "pass", detail: "Backup decrypted successfully" });
          } else {
            checks.push({ name: "Decryption", status: "fail", detail: "Decryption returned null. Check FIELD_ENCRYPTION_KEY." });
            return NextResponse.json({ success: false, checks });
          }
        } catch {
          checks.push({ name: "Decryption", status: "fail", detail: "Decryption failed. Key mismatch or corrupted data." });
          return NextResponse.json({ success: false, checks });
        }
      } else {
        backupData = normalizeBackupData(archive.payload.data);
        rawContent = archive.payload.rawContent;
        checks.push({ name: "Archive Format", status: "pass", detail: `Version 1 archive (${archive.payload.type}) parsed successfully` });
        checks.push({ name: "Decryption", status: "warn", detail: "Backup archive is plaintext" });
      }
    } else if (legacyEncrypted && legacyIv && legacyAuthTag) {
      try {
        const decrypted = decryptBackup(legacyEncrypted, legacyIv, legacyAuthTag);
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          backupData = normalizeBackupData(parsed?.data ?? parsed);
          rawContent = decrypted;
          checks.push({ name: "Decryption", status: "pass", detail: "Backup decrypted successfully" });
        } else {
          checks.push({ name: "Decryption", status: "fail", detail: "Decryption returned null. Check FIELD_ENCRYPTION_KEY." });
          return NextResponse.json({ success: false, checks });
        }
      } catch {
        checks.push({ name: "Decryption", status: "fail", detail: "Decryption failed. Key mismatch or corrupted data." });
        return NextResponse.json({ success: false, checks });
      }
    } else {
      backupData = normalizeBackupData(body.data ?? body);
      checks.push({ name: "Decryption", status: "warn", detail: "Backup is not encrypted (plaintext)" });
    }

    // ── Check 2: JSON Structure ─────────────────────────────
    if (!backupData || typeof backupData !== "object") {
      checks.push({ name: "JSON Structure", status: "fail", detail: "Invalid backup data. Expected an object with table names as keys." });
      return NextResponse.json({ success: false, checks });
    }
    checks.push({ name: "JSON Structure", status: "pass", detail: "Valid JSON object" });

    // ── Check 3: HMAC Signature ─────────────────────────────
    if (signature && rawContent) {
      const valid = verifyBackupSignature(rawContent, signature);
      checks.push({
        name: "HMAC Signature",
        status: valid ? "pass" : "fail",
        detail: valid ? "Signature verified — data integrity confirmed" : "Signature mismatch — data may be tampered",
      });
    } else {
      checks.push({ name: "HMAC Signature", status: "warn", detail: "No signature provided. Cannot verify integrity." });
    }

    // ── Check 4: Table Validation ───────────────────────────
    const tableNames = Object.keys(backupData);
    const validTables = tableNames.filter((t) => ALLOWED_TABLES.has(t));
    const unknownTables = tableNames.filter((t) => !ALLOWED_TABLES.has(t));

    if (unknownTables.length > 0) {
      checks.push({
        name: "Table Validation",
        status: "warn",
        detail: `Unknown tables will be skipped: ${unknownTables.join(", ")}`,
      });
    }
    checks.push({
      name: "Table Coverage",
      status: validTables.length > 0 ? "pass" : "fail",
      detail: `${validTables.length}/${ALLOWED_TABLES.size} known tables present`,
    });

    // ── Check 5: Record Counts & Schema ─────────────────────
    const tableStats: Record<string, { count: number; sampleFields: string[]; dbCount?: number }> = {};
    let totalRecords = 0;

    for (const table of validTables) {
      const records = backupData[table];
      if (!Array.isArray(records)) {
        checks.push({
          name: `Table: ${table}`,
          status: "fail",
          detail: `Expected array, got ${typeof records}`,
        });
        continue;
      }

      const sampleFields = records.length > 0 ? Object.keys(records[0]).slice(0, 10) : [];
      totalRecords += records.length;

      // Compare with current DB count
      let dbCount: number | undefined;
      try {
        const countRecords = BACKUP_TABLE_COUNTERS[table as keyof typeof BACKUP_TABLE_COUNTERS];
        if (countRecords) {
          dbCount = await countRecords();
        }
      } catch { /* ignore */ }

      tableStats[table] = { count: records.length, sampleFields, dbCount };
    }

    checks.push({
      name: "Total Records",
      status: "pass",
      detail: `${totalRecords} records across ${validTables.length} tables`,
    });

    // ── Check 6: ID Uniqueness ──────────────────────────────
    let duplicateIds = 0;
    for (const table of validTables) {
      const records = backupData[table];
      if (!Array.isArray(records)) continue;
      const ids = records.map((r: any) => r.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      if (uniqueIds.size < ids.length) {
        duplicateIds += ids.length - uniqueIds.size;
      }
    }

    checks.push({
      name: "ID Uniqueness",
      status: duplicateIds === 0 ? "pass" : "warn",
      detail: duplicateIds === 0
        ? "All record IDs are unique"
        : `${duplicateIds} duplicate ID(s) found — MERGE mode may skip these`,
    });

    // ── Overall verdict ─────────────────────────────────────
    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");

    return NextResponse.json({
      success: !hasFail,
      verdict: hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS",
      message: hasFail
        ? "Backup verification failed. Do NOT import this backup."
        : hasWarn
          ? "Backup has warnings but can be imported. Review warnings carefully."
          : "Backup is valid and safe to import.",
      checks,
      tableStats,
      totalRecords,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Backup verify failed:", error);
    return NextResponse.json({ error: "Backup verification failed" }, { status: 500 });
  }
}
