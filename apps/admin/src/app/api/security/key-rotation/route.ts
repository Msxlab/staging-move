import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { isEncrypted, reEncrypt, validateKeyFormat } from "@/lib/shared-encryption";
import { acquireLock, type LockResult } from "@/lib/distributed-lock";

const ENCRYPTED_FIELDS: Record<string, { fields: string[] }> = {
  services: {
    fields: ["accountNumber", "username", "phone", "email", "notes"],
  },
  addresses: {
    fields: ["formattedAddress"],
  },
};

const BATCH_SIZE = 100;
// Worst-case rotation should complete inside this window. The lock auto-
// expires after the TTL so a crashed handler doesn't wedge rotations
// forever, but the value should comfortably exceed any expected scan.
const KEY_ROTATION_LOCK_TTL_SEC = 30 * 60;

type RotationStats = Record<string, { total: number; rotated: number; skipped: number; errors: number }>;

class KeyRotationFailure extends Error {
  reasonCode: string;
  tableName?: string;
  fieldName?: string;

  constructor(reasonCode: string, details: { tableName?: string; fieldName?: string } = {}) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.tableName = details.tableName;
    this.fieldName = details.fieldName;
  }
}

function safeFailureMetadata(error: unknown) {
  if (error instanceof KeyRotationFailure) {
    return {
      reasonCode: error.reasonCode,
      tableName: error.tableName,
      fieldName: error.fieldName,
    };
  }
  return { reasonCode: "unexpected_exception" };
}

async function scanAndRotateEncryptedFields(oldKey: string, dryRun: boolean): Promise<RotationStats> {
  const results: RotationStats = {};

  for (const [tableName, config] of Object.entries(ENCRYPTED_FIELDS)) {
    const stats = { total: 0, rotated: 0, skipped: 0, errors: 0 };
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      if (tableName === "services") {
        // rawPrisma: soft-deleted Service rows are still restorable during the
        // deletion grace window, so their ciphertext MUST be re-encrypted too —
        // otherwise it becomes permanently undecryptable once the old key is
        // retired. orderBy makes offset pagination stable (no skipped/repeated
        // rows, which would otherwise re-feed an already-rotated row to reEncrypt
        // and fail mid-rotation).
        const records = await rawPrisma.service.findMany({
          skip,
          take: BATCH_SIZE,
          orderBy: { id: "asc" },
          select: { id: true, accountNumber: true, username: true, phone: true, email: true, notes: true },
        });
        if (records.length < BATCH_SIZE) hasMore = false;
        skip += BATCH_SIZE;

        for (const record of records) {
          stats.total++;
          const updates: Record<string, string> = {};
          const serviceFields = {
            accountNumber: record.accountNumber,
            username: record.username,
            phone: record.phone,
            email: record.email,
            notes: record.notes,
          };

          for (const field of config.fields) {
            const value = serviceFields[field as keyof typeof serviceFields];
            if (!value || !isEncrypted(value)) {
              stats.skipped++;
              continue;
            }

            const rotated = reEncrypt(value, oldKey);
            if (rotated === null) {
              stats.errors++;
              throw new KeyRotationFailure("reencrypt_failed", { tableName, fieldName: field });
            }
            updates[field] = rotated;
          }

          if (Object.keys(updates).length === 0) continue;

          if (!dryRun) {
            try {
              await rawPrisma.service.update({
                where: { id: record.id },
                data: {
                  ...(updates.accountNumber ? { accountNumber: updates.accountNumber } : {}),
                  ...(updates.username ? { username: updates.username } : {}),
                  ...(updates.phone ? { phone: updates.phone } : {}),
                  ...(updates.email ? { email: updates.email } : {}),
                  ...(updates.notes ? { notes: updates.notes } : {}),
                },
              });
            } catch {
              stats.errors++;
              throw new KeyRotationFailure("record_update_failed", { tableName });
            }
          }
          stats.rotated++;
        }
      } else {
        const records = await rawPrisma.address.findMany({
          skip,
          take: BATCH_SIZE,
          orderBy: { id: "asc" },
          select: { id: true, formattedAddress: true },
        });
        if (records.length < BATCH_SIZE) hasMore = false;
        skip += BATCH_SIZE;

        for (const record of records) {
          stats.total++;
          const value = record.formattedAddress;
          if (!value || !isEncrypted(value)) {
            stats.skipped++;
            continue;
          }

          const rotated = reEncrypt(value, oldKey);
          if (rotated === null) {
            stats.errors++;
            throw new KeyRotationFailure("reencrypt_failed", { tableName, fieldName: "formattedAddress" });
          }

          if (!dryRun) {
            try {
              await rawPrisma.address.update({
                where: { id: record.id },
                data: { formattedAddress: rotated },
              });
            } catch {
              stats.errors++;
              throw new KeyRotationFailure("record_update_failed", { tableName });
            }
          }
          stats.rotated++;
        }
      }
    }

    results[tableName] = stats;
  }

  return results;
}

export async function POST(request: NextRequest) {
  const requestMeta = getAuditRequestMeta(request);
  let session: any = null;
  let lockHandle: LockResult | null = null;
  let dryRun = false;
  let started = false;
  let mutationStarted = false;
  let results: RotationStats | null = null;

  try {
    session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const body = await request.json().catch(() => ({}));
    const { oldKey, confirmPassword, mfaCode, backupCode } = body;
    dryRun = body?.dryRun === true;

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "key_rotation",
      requireMfa: true,
      mfaCode: typeof mfaCode === "string" ? mfaCode : undefined,
      backupCode: typeof backupCode === "string" ? backupCode : undefined,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: {
          status: "failed",
          dryRun,
          reasonCode: confirm.requiresMfa ? "mfa_required_or_invalid" : "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json({
        error: confirm.error || "Password and MFA confirmation required",
        requiresPassword: true,
        requiresMfa: confirm.requiresMfa || undefined,
      }, { status: confirm.rateLimited ? 429 : 403 });
    }

    if (!oldKey || !validateKeyFormat(oldKey)) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: { status: "failed", dryRun, reasonCode: "invalid_old_key_format" },
        request: requestMeta,
      });
      return NextResponse.json({
        error: "oldKey is required and must be a 64-character hex string (256-bit key)",
      }, { status: 400 });
    }

    const newKey = process.env.FIELD_ENCRYPTION_KEY;
    if (!newKey || !validateKeyFormat(newKey)) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: { status: "failed", dryRun, reasonCode: "new_key_not_configured" },
        request: requestMeta,
      });
      return NextResponse.json({
        error: "FIELD_ENCRYPTION_KEY env var must be set to the new key before rotation",
      }, { status: 400 });
    }

    if (oldKey === newKey) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: { status: "failed", dryRun, reasonCode: "same_old_and_new_key" },
        request: requestMeta,
      });
      return NextResponse.json({
        error: "Old and new keys are the same. Set FIELD_ENCRYPTION_KEY to the new key first.",
      }, { status: 400 });
    }

    // Distributed single-writer lock. The previous module-scope
    // boolean only protected one Node process; a multi-instance deploy
    // could run two concurrent rotations and corrupt mid-flight rows
    // (audit P0-3). Backed by Redis when configured, with a memory
    // fallback for dev/test/single-instance.
    lockHandle = await acquireLock("key-rotation", { ttlSec: KEY_ROTATION_LOCK_TTL_SEC });
    if (!lockHandle.acquired) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: {
          status: "failed",
          dryRun,
          reasonCode: "rotation_already_in_progress",
          retryAfterSec: lockHandle.retryAfterSec,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Key rotation is already in progress", retryAfterSec: lockHandle.retryAfterSec },
        { status: 409, headers: { "Retry-After": String(lockHandle.retryAfterSec) } },
      );
    }

    await writeAdminAudit(session, {
      action: "KEY_ROTATION_STARTED",
      entityType: "Encryption",
      entityId: "FIELD_ENCRYPTION_KEY",
      metadata: {
        status: "started",
        dryRun,
        tables: Object.keys(ENCRYPTED_FIELDS),
      },
      request: requestMeta,
    });
    started = true;

    const preflight = await scanAndRotateEncryptedFields(oldKey, true);
    if (dryRun) {
      results = preflight;
    } else {
      mutationStarted = true;
      results = await scanAndRotateEncryptedFields(oldKey, false);
    }

    await writeAdminAudit(session, {
      action: "KEY_ROTATION_COMPLETED",
      entityType: "Encryption",
      entityId: "FIELD_ENCRYPTION_KEY",
      metadata: {
        status: "success",
        dryRun,
        tables: Object.keys(results),
        results,
      },
      request: requestMeta,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? "Dry run complete. No data was modified."
        : "Key rotation complete. All encrypted fields have been re-encrypted with the new key.",
      results,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session && started) {
      await writeAdminAudit(session, {
        action: "KEY_ROTATION_FAILED",
        entityType: "Encryption",
        entityId: "FIELD_ENCRYPTION_KEY",
        metadata: {
          status: "failed",
          dryRun,
          partialRotationPossible: mutationStarted,
          results,
          ...safeFailureMetadata(error),
        },
        request: requestMeta,
      }).catch(() => null);
    }
    return NextResponse.json(
      {
        error: "Key rotation failed",
        partialRotationPossible: mutationStarted,
      },
      { status: 500 },
    );
  } finally {
    if (lockHandle && lockHandle.acquired) {
      await lockHandle.release().catch(() => undefined);
    }
  }
}
